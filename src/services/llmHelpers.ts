import { reportModelLoad, useModelLoadStore } from '../stores/modelLoadStore';
import { initLlama,LlamaContext } from 'llama.rn';
import RNFS from 'react-native-fs';
import { APP_CONFIG } from '../constants';
import { Message,INFERENCE_BACKENDS } from '../types';
import { MultimodalSupport,LLMPerformanceStats } from './llmTypes';
import logger from '../utils/logger';


export const SYSTEM_PROMPT_RESERVE = 256;
export const RESPONSE_RESERVE = 512;
export const CONTEXT_SAFETY_MARGIN = 0.85;
const DEFAULT_THREADS = 4; // targets performance cores only; over-threading onto efficiency cores (A520) hurts
const DEFAULT_BATCH = 512;
export const DEFAULT_GPU_LAYERS = (99);
export function getOptimalThreadCount(): number { return DEFAULT_THREADS; }
export function getOptimalBatchSize(): number { return DEFAULT_BATCH; }
/** Detect repackable quant formats where disabling mmap improves inference speed. */
export function shouldDisableMmap(_modelPath: string): boolean { return false; }

export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.codePointAt(i) ?? 0;
    // eslint-disable-next-line no-bitwise
    hash = ((hash << 5) - hash) + char;
    // eslint-disable-next-line no-bitwise
    hash = hash & hash;
  }
  return hash.toString(16);
}
export async function ensureSessionCacheDir(cacheDir: string): Promise<void> {
  try {
    if (!await RNFS.exists(cacheDir)) await RNFS.mkdir(cacheDir);
  } catch (e) {
    logger.log('[LLM] Failed to create session cache dir:', e);
  }
}
export function getSessionPath(cacheDir: string, promptHash: string): string {
  return `${cacheDir}/session-${promptHash}.bin`;
}
export interface ModelLoadParams {
  baseParams: object;
  nThreads: number;
  nBatch: number;
  ctxLen: number;
  nGpuLayers: number;
}

export function buildModelParams(
  modelPath: string,
  settings: { nThreads?: number; nBatch?: number; contextLength?: number; flashAttn?: boolean; enableGpu?: boolean; gpuLayers?: number; cacheType?: string; inferenceBackend?: string },
): ModelLoadParams {
  const nThreads = settings.nThreads || getOptimalThreadCount();
  const nBatch = settings.nBatch || getOptimalBatchSize();
  const ctxLen = settings.contextLength || APP_CONFIG.maxContextLength;
  // inferenceBackend takes precedence; fall back to legacy enableGpu flag
  const backend = settings.inferenceBackend;
  const flash_attn_type = settings.flashAttn === false ? 'off' : 'auto';
  const gpuEnabled = backend ? backend !== INFERENCE_BACKENDS.CPU : settings.enableGpu !== false;
  const nGpuLayers = gpuEnabled ? (settings.gpuLayers ?? DEFAULT_GPU_LAYERS) : 0;
  const cacheType = settings.cacheType || (flash_attn_type === 'off' ? 'f16' : 'q8_0');
  return {
    baseParams: {
      model: modelPath, use_mlock: false, n_batch: nBatch, n_ubatch: nBatch, n_threads: nThreads,
      use_mmap: !shouldDisableMmap(modelPath), vocab_only: false, flash_attn_type,
      kv_unified: true, no_extra_bufts: false,
      cache_type_k: cacheType, cache_type_v: cacheType,
    },
    nThreads, nBatch, ctxLen, nGpuLayers,
  };
}
export interface ContextInitResult {
  context: LlamaContext;
  gpuAttemptFailed: boolean;
  actualLength: number;
}
/** Try the requested device, then CPU; a final retry never increases context memory. */
export async function initContextWithFallback(
  params: object,
  contextLength: number,
  nGpuLayers: number,
): Promise<ContextInitResult> {
  const ticket=useModelLoadStore.getState().ticket;
  const onProgress=(progress:number)=>reportModelLoad(ticket, progress>=100?'Preparing runtime':'Loading model file',progress>=100?null:progress);
  const modelPath = (params as any).model || 'unknown';
  logger.log(`[LLM] initContextWithFallback: model=${modelPath}, ctx=${contextLength}, gpuLayers=${nGpuLayers}`);
  const fallbackLength = Math.min(contextLength, 2048);
  let gpuAttemptFailed = false;
  try {
    logger.log(`[LLM] Attempt 1/3: GPU init (ctx=${contextLength}, gpu_layers=${nGpuLayers})`);
    const gpuInitPromise = initLlama({ ...params, n_ctx: contextLength, n_gpu_layers: nGpuLayers } as any, onProgress);
    const context = await gpuInitPromise;
    logger.log('[LLM] GPU init succeeded');
    return { context, gpuAttemptFailed, actualLength: contextLength };
  } catch (gpuError: any) {
    const gpuMsg = gpuError?.message || String(gpuError);
    if (nGpuLayers > 0) {
      logger.warn(`[LLM] Attempt 1/3 failed (GPU): ${gpuMsg}`);
      gpuAttemptFailed = true;
    } else {
      logger.warn(`[LLM] Attempt 1/3 failed (no GPU requested): ${gpuMsg}`);
    }
    try {
      logger.log(`[LLM] Attempt 2/3: CPU init (ctx=${contextLength}, gpu_layers=0)`);
      // A CPU retry must not request accelerator devices.
      const cpuParams = { ...(params as Record<string, unknown>) };
      delete cpuParams.devices;
      const context = await initLlama({ ...cpuParams, n_ctx: contextLength, n_gpu_layers: 0 } as any, onProgress);
      logger.log('[LLM] CPU init succeeded');
      return { context, gpuAttemptFailed, actualLength: contextLength };
    } catch (cpuError: any) {
      const cpuMsg = cpuError?.message || String(cpuError);
      logger.warn(`[LLM] Attempt 2/3 failed (CPU, ctx=${contextLength}): ${cpuMsg}`);
      try {
        logger.log(`[LLM] Attempt 3/3: CPU init (ctx=${fallbackLength}, gpu_layers=0)`);
        const cpuMinParams = { ...(params as Record<string, unknown>) };
        delete cpuMinParams.devices;
        const context = await initLlama({ ...cpuMinParams, n_ctx: fallbackLength, n_gpu_layers: 0 } as any, onProgress);
        logger.log(`[LLM] CPU init with ctx=${fallbackLength} succeeded`);
        return { context, gpuAttemptFailed, actualLength: fallbackLength };
      } catch (finalError: any) {
        const finalMsg = finalError?.message || String(finalError);
        logger.error(`[LLM] Attempt 3/3 failed (CPU, ctx=${fallbackLength}): ${finalMsg}`);
        logger.error(`[LLM] All 3 init attempts failed for model: ${modelPath}`);
        logger.error(`[LLM] Error chain — GPU: "${gpuMsg}" | CPU: "${cpuMsg}" | min-ctx: "${finalMsg}"`);
        const errorParts = [
          gpuMsg && gpuMsg !== finalMsg ? `GPU: ${gpuMsg}` : null,
          cpuMsg && cpuMsg !== finalMsg ? `CPU: ${cpuMsg}` : null,
          `min-ctx: ${finalMsg}`,
        ].filter(Boolean).join(' | ');
        throw new Error(`Failed to load model after CPU retries (context ${fallbackLength}). This may indicate insufficient memory, a corrupted model file, or an unsupported model format.\n\nError chain: ${errorParts}`);
      }
    }
  }
}
export interface GpuInfo {
  gpuEnabled: boolean;
  gpuReason: string;
  gpuDevices: string[];
  activeGpuLayers: number;
}

export function captureGpuInfo(
  context: LlamaContext,
  gpuAttemptFailed: boolean,
  nGpuLayers: number,
): GpuInfo {
  const nativeGpuAvailable = context.gpu ?? false;
  const gpuReason = (context as any).reasonNoGPU ?? '';
  const gpuDevices = (context as any).devices ?? [];
  const activeGpuLayers = gpuAttemptFailed ? 0 : nGpuLayers;
  const gpuEnabled = nativeGpuAvailable && activeGpuLayers > 0;
  return { gpuEnabled, gpuReason, gpuDevices, activeGpuLayers };
}
export function supportsNativeThinking(context: LlamaContext | null): boolean {
  if (!context) return false;
  try {
    if (typeof context.isJinjaSupported === 'function') {
      return context.isJinjaSupported();
    }
    const jinja = (context as any)?.model?.chatTemplates?.jinja;
    return !!(jinja?.default || jinja?.toolUse);
  } catch {
    return false;
  }
}
export function buildThinkingCompletionParams(enableThinking: boolean, isGemma4: boolean = false): { enable_thinking: boolean; reasoning_format: 'none' | 'deepseek' } {
  // Gemma 4 uses its own <|channel>thought\n...<channel|> format — not DeepSeek's <think> tags.
  // Set reasoning_format:'none' so llama.rn doesn't try to strip DeepSeek tags; we parse it ourselves.
  return { enable_thinking: enableThinking, reasoning_format: (enableThinking && !isGemma4) ? 'deepseek' : 'none' };
}
export function getStreamingDelta(nextValue: string | undefined, previousValue: string): string | undefined {
  if (!nextValue) return undefined;
  if (!previousValue) return nextValue;
  return nextValue.startsWith(previousValue) ? nextValue.slice(previousValue.length) || undefined : nextValue;
}

/** Reads the model's trained context length from metadata, or null if unavailable. */
export function getModelMaxContext(context: LlamaContext): number | null {
  try {
    const metadata = (context as any).model?.metadata;
    if (!metadata) return null;
    const trainCtx = metadata['llama.context_length'] || metadata['general.context_length'] || metadata.context_length;
    if (!trainCtx) return null;
    const maxModelCtx = Number.parseInt(trainCtx, 10);
    return Number.isNaN(maxModelCtx) || maxModelCtx <= 0 ? null : maxModelCtx;
  } catch {
    return null;
  }
}
export function logContextMetadata(context: LlamaContext, contextLength: number): void {
  const maxModelCtx = getModelMaxContext(context);
  if (maxModelCtx == null) return;
  logger.log(`[LLM] Model trained context: ${maxModelCtx}, using: ${contextLength}`);
  if (contextLength > maxModelCtx) logger.warn(`[LLM] Requested context (${contextLength}) exceeds model max (${maxModelCtx})`);
}
export interface MultimodalInitResult {
  initialized: boolean;
  support: MultimodalSupport;
}
export async function initMultimodal(
  context: LlamaContext,
  mmProjPath: string,
  useGpuForClip: boolean,
): Promise<MultimodalInitResult> {
  const noSupport: MultimodalInitResult = { initialized: false, support: { vision: false, audio: false } };
  try {
    const success = await context.initMultimodal({ path: mmProjPath, use_gpu: useGpuForClip });
    if (!success) {
      logger.warn('[LLM] initMultimodal returned false - mmproj may be incompatible with model');
      return noSupport;
    }
    let support: MultimodalSupport = { vision: true, audio: false };
    try {
      const s = await context.getMultimodalSupport();
      support = { vision: s?.vision || true, audio: s?.audio || false };
    } catch {
      // getMultimodalSupport not available, keep defaults
    }
    logger.log('[LLM] Multimodal initialized successfully, vision:', support.vision);
    return { initialized: true, support };
  } catch (error: any) {
    logger.error('[LLM] Multimodal init exception:', error?.message || error);
    return noSupport;
  }
}
export async function checkContextMultimodal(context: LlamaContext): Promise<MultimodalSupport> {
  try {
    // @ts-ignore - llama.rn may have this method
    if (typeof context.getMultimodalSupport === 'function') {
      const s = await context.getMultimodalSupport();
      return { vision: s?.vision || false, audio: s?.audio || false };
    }
  } catch {
    logger.log('Multimodal support check not available');
  }
  return { vision: false, audio: false };
}
export async function estimateTokens(context: LlamaContext, text: string): Promise<number> {
  try {
    return (await context.tokenize(text)).tokens?.length || 0;
  } catch {
    return Math.ceil(text.length / 4);
  }
}
export async function fitMessagesInBudget(
  context: LlamaContext,
  messages: Message[],
  budget: number,
): Promise<Message[]> {
  const result: Message[] = [];
  let remaining = budget;
  for (let i = messages.length - 1; i >= 0 && remaining > 0; i--) {
    const msg = messages[i];
    let tokens: number;
    try {
      tokens = ((await context.tokenize(msg.content)).tokens?.length || 0) + 10;
    } catch {
      tokens = Math.ceil(msg.content.length / 4) + 10;
    }
    if (tokens <= remaining) {
      result.unshift(msg);
      remaining -= tokens;
    } else if (result.length === 0) {
      result.unshift(msg);
      break;
    } else {
      break;
    }
  }
  return result;
}
/** Max safe context length based on device RAM to prevent OOM on low-RAM devices. */
export const BYTES_PER_GB = 1024 * 1024 * 1024;
export function getMaxContextForDevice(totalMemoryBytes: number): number {
  const gb = totalMemoryBytes / BYTES_PER_GB;
  if (gb <= 6) return 2048;
  if (gb <= 8) return 4096;
  return 8192;
}
/** Safe GPU layer count based on device RAM. Skips GPU on ≤4 GB to prevent abort(). */
export function getGpuLayersForDevice(totalMemoryBytes: number, requestedLayers: number): number {
  const totalGB = totalMemoryBytes / BYTES_PER_GB;
  if (totalGB <= 4) return 0;

  return requestedLayers;
}
export { validateModelFile, checkMemoryForModel, safeCompletion } from './llmSafetyChecks';
export const STOP_TOKENS = ['</s>', '<|end|>', '<|eot_id|>'];
export function buildCompletionParams(settings: {
  maxTokens?: number; temperature?: number; topP?: number; repeatPenalty?: number;
}, options?: { disableCtxShift?: boolean }): Record<string, any> {
  return {
    n_predict: settings.maxTokens || RESPONSE_RESERVE,
    temperature: settings.temperature ?? 0.7,
    top_k: 40,
    top_p: settings.topP ?? 0.95,
    penalty_repeat: settings.repeatPenalty ?? 1.1,
    stop: STOP_TOKENS,
    ctx_shift: options?.disableCtxShift ? false : true,
  };
}
export function recordGenerationStats(
  startTime: number,
  firstTokenMs: number,
  tokenCount: number,
): LLMPerformanceStats {
  const elapsed = (Date.now() - startTime) / 1000;
  const tokensPerSec = elapsed > 0 ? tokenCount / elapsed : 0;
  const ttft = firstTokenMs / 1000;
  const decodeTime = elapsed - ttft;
  const decodeTokensPerSec = decodeTime > 0 && tokenCount > 1 ? (tokenCount - 1) / decodeTime : 0;
  logger.log(`[LLM] Generated ${tokenCount} tokens in ${elapsed.toFixed(1)}s (${tokensPerSec.toFixed(1)} tok/s, TTFT ${ttft.toFixed(2)}s)`);
  return {
    lastTokensPerSecond: tokensPerSec,
    lastDecodeTokensPerSecond: decodeTokensPerSec,
    lastTimeToFirstToken: ttft,
    lastGenerationTime: elapsed,
    lastTokenCount: tokenCount,
  };
}
