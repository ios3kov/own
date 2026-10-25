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
const DEFAULT_THREADS = 4; // Conservative fallback when device facts are unavailable.
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
  settings: { nThreads?: number; nBatch?: number; nUbatch?: number; contextLength?: number; flashAttn?: boolean; enableGpu?: boolean; gpuLayers?: number; cacheType?: string; inferenceBackend?: string },
): ModelLoadParams {
  const nThreads = settings.nThreads || getOptimalThreadCount();
  const nBatch = settings.nBatch || getOptimalBatchSize();
  const requestedMicroBatch = settings.nUbatch;
  const nUbatch = typeof requestedMicroBatch === 'number' && Number.isFinite(requestedMicroBatch) && requestedMicroBatch > 0
    ? Math.min(nBatch,Math.max(1,Math.floor(requestedMicroBatch))) : Math.min(nBatch,128);
  const ctxLen = settings.contextLength || APP_CONFIG.maxContextLength;
  // inferenceBackend takes precedence; fall back to legacy enableGpu flag
  const backend = settings.inferenceBackend;
  const flash_attn_type = settings.flashAttn === false ? 'off' : 'auto';
  const gpuEnabled = backend ? backend !== INFERENCE_BACKENDS.CPU : settings.enableGpu !== false;
  const nGpuLayers = gpuEnabled ? (settings.gpuLayers ?? DEFAULT_GPU_LAYERS) : 0;
  const cacheType = settings.cacheType || (flash_attn_type === 'off' ? 'f16' : 'q8_0');
  return {
    baseParams: {
      model: modelPath, use_mlock: false, n_batch: nBatch, n_ubatch: nUbatch, n_threads: nThreads,
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
  actualGpuLayers?: number;
  fallbackReason?: string;
}
export type ModelLoadFailureKind = 'memory' | 'architecture' | 'file' | 'transient';
export function classifyModelLoadFailure(error: unknown): ModelLoadFailureKind {
  const message = error instanceof Error ? error.message : String(error);
  if (/unsupported.*(?:arch|model|format)|unknown.*arch|architecture.*(?:unsupported|not supported)/i.test(message)) return 'architecture';
  if (/invalid.*(?:magic|gguf|header)|corrupt|truncated|file.*not found|failed to read|tensor.*(?:missing|not found)/i.test(message)) return 'file';
  if (/out of memory|\boom\b|alloc|insufficient.*memory|not enough.*memory|memory.*(?:exhaust|limit)/i.test(message)) return 'memory';
  return 'transient';
}
export class ModelLoadFailure extends Error {
  constructor(public readonly kind: ModelLoadFailureKind, message: string) {
    super(message); this.name = 'ModelLoadFailure';
  }
}
/** Bounded, distinct configurations. Permanent file/architecture failures never retry. */
export async function initContextWithFallback(
  params: object,
  contextLength: number,
  configuration: number | {nGpuLayers: number; signal?: AbortSignal},
): Promise<ContextInitResult> {
  const nGpuLayers = typeof configuration === 'number' ? configuration : configuration.nGpuLayers;
  const signal = typeof configuration === 'number' ? undefined : configuration.signal;
  const ticket = useModelLoadStore.getState().ticket;
  const onProgress = (progress: number) => reportModelLoad(ticket, progress >= 100 ? 'Preparing runtime' : 'Loading model file', progress >= 100 ? null : progress);
  const fallbackLength = Math.min(contextLength, 2048);
  const candidates = [{length: contextLength, layers: nGpuLayers}];
  const attempted = new Set<string>();
  let lastError: unknown;
  let reason: string | undefined;
  while (candidates.length) {
    if (signal?.aborted) throw new Error('Model loading cancelled.');
    const candidate = candidates.shift()!;
    const key = `${candidate.length}:${candidate.layers}`;
    if (attempted.has(key)) continue;
    attempted.add(key);
    const config = {...params} as Record<string, unknown>;
    if (candidate.layers === 0) delete config.devices;
    try {
      const context = await initLlama({...config, n_ctx: candidate.length, n_gpu_layers: candidate.layers} as any, onProgress);
      if (signal?.aborted) {
        await context.release();
        throw new Error('Model loading cancelled.');
      }
      return {context, actualLength: candidate.length, gpuAttemptFailed: nGpuLayers > 0 && candidate.layers === 0,
        actualGpuLayers: candidate.layers, fallbackReason: reason};
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      const kind = classifyModelLoadFailure(error);
      const message = error instanceof Error ? error.message : String(error);
      if (kind === 'architecture' || kind === 'file') throw new ModelLoadFailure(kind, message);
      reason = `${kind}: ${message}`;
      if (attempted.size === 1) {
        if (kind === 'memory' && nGpuLayers > 1) {
          const reducedLayers = Math.max(1, Math.floor(nGpuLayers / 2));
          candidates.push({length: contextLength, layers: reducedLayers});
          if (fallbackLength < contextLength) candidates.push({length: fallbackLength, layers: reducedLayers});
        }
        candidates.push({length: contextLength, layers: 0});
        candidates.push({length: fallbackLength, layers: 0});
      }
    }
  }
  const kind = classifyModelLoadFailure(lastError);
  throw new ModelLoadFailure(kind, `Failed to load model after ${attempted.size} distinct configurations. ${reason}`);
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
  const activeGpuLayers = nativeGpuAvailable && !gpuAttemptFailed ? nGpuLayers : 0;
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
    stop: [...STOP_TOKENS],
    ctx_shift: options?.disableCtxShift ? false : true,
  };
}
export function recordGenerationStats(
  startTime: number,
  firstTokenMs: number,
  tokens: number | {events:number; timings?:{predicted_n?:number;predicted_ms?:number;prompt_n?:number;cache_n?:number}},
): LLMPerformanceStats {
  const elapsed = Math.max(0,(Date.now() - startTime) / 1000);
  const events = typeof tokens === 'number' ? tokens : tokens.events;
  const timings = typeof tokens === 'number' ? undefined : tokens.timings;
  const nativeCount = timings?.predicted_n;
  const native = typeof nativeCount === 'number' && Number.isSafeInteger(nativeCount) && nativeCount >= 0;
  const tokenCount = native ? nativeCount : events;
  const tokensPerSec = elapsed > 0 ? tokenCount / elapsed : 0;
  const ttft = firstTokenMs / 1000;
  const decodeTime = elapsed - ttft;
  const nativeDecodeMs = timings?.predicted_ms;
  const nativeDecode = native && typeof nativeDecodeMs === 'number' && Number.isFinite(nativeDecodeMs) && nativeDecodeMs > 0;
  const decodeTokensPerSec = nativeDecode ? tokenCount * 1000 / nativeDecodeMs
    : decodeTime > 0 && tokenCount > 1 ? (tokenCount - 1) / decodeTime : 0;
  const count = (value:unknown):number|undefined => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  return {
    lastTokensPerSecond:tokensPerSec,lastDecodeTokensPerSecond:decodeTokensPerSec,
    lastTimeToFirstToken:ttft,lastGenerationTime:elapsed,lastTokenCount:tokenCount,
    lastTokenCountSource:native ? 'native' : 'stream-events-estimate',
    lastPromptTokenCount:count(timings?.prompt_n),lastCachedTokenCount:count(timings?.cache_n),
  };
}
