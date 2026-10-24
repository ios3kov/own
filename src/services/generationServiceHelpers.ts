import { buildGenerationMetaImpl } from './generationMetadata';
export { buildGenerationMetaImpl } from './generationMetadata';
import { beginContextUsage } from './contextUsage';
import { mergeDocumentSources } from './documentSources';
import { replySpeech } from './replySpeech';
import { foundationModelService, isAppleModelSelected } from './foundationModels';
/**
 * GenerationService helper implementations — extracted to keep generationService.ts under 350 lines.
 * All functions receive the GenerationService instance as `svc: any` and mutate its internal state.
 */
import { llmService } from './llm';
import { liteRTService } from './litert';
import { getActiveEngineService } from './engines';
import { useAppStore, useChatStore, useRemoteServerStore } from '../stores';
import type { Message } from '../types';
import { runToolLoop, buildLiteRTHistory } from './generationToolLoop';
import type { ToolResult } from './tools/types';
import type { GenerationOptions, CompletionResult } from './providers/types';
import logger from '../utils/logger';

export const FLUSH_INTERVAL_MS = 50; // ~20 updates/sec
type StreamChunk = string | { content?: string; reasoningContent?: string };

/** Returns true when the currently active model uses LiteRT engine. */
function isLiteRTActive(): boolean {
  return getActiveEngineService() === liteRTService;
}

export interface GenerationRequest {
  conversationId: string;
  messages: Message[];
  onFirstToken?: () => void;
}

export interface GenerationWithToolsRequest {
  conversationId: string;
  messages: Message[];
  options: {
    enabledToolIds: string[];
    projectId?: string;
    onToolCallStart?: (name: string, args: Record<string, any>) => void;
    onToolCallComplete?: (name: string, result: ToolResult) => void;
    onFirstToken?: () => void;
  };
}

function handleStreamChunk(svc: any, chunk: { content?: string; reasoningContent?: string }): void {
  if (chunk.content) {
    if (!svc.state.streamingContent && svc.remoteTimeToFirstToken === undefined) {
      svc.remoteTimeToFirstToken = svc.state.startTime
        ? (Date.now() - svc.state.startTime) / 1000
        : undefined;
    }
    svc.state.streamingContent += chunk.content;
    svc.tokenBuffer += chunk.content;
  }
  if (chunk.reasoningContent) {
    svc.reasoningBuffer += chunk.reasoningContent;
    svc.totalReasoningLength += chunk.reasoningContent.length;
  }
}

export function buildToolLoopHandlersImpl(svc: any) {
  const sequence = svc.generationSequence;
  const stale = () => svc.abortRequested || sequence !== svc.generationSequence;
  return {
    isAborted: stale,
    onDocumentSources: (sources: import('../types').DocumentSource[]) => {
      if (!stale()) svc.documentSources = mergeDocumentSources(svc.documentSources || [], sources);
    },
    onThinkingDone: () => { if (!stale()) svc.updateState({ isThinking: false }); },
    onStream: (data: StreamChunk) => {
      if (stale()) return;
      const chunk = typeof data === 'string' ? { content: data } : data;
      handleStreamChunk(svc, chunk);
      if (!svc.flushTimer) {
        svc.flushTimer = setTimeout(() => svc.flushTokenBuffer(), FLUSH_INTERVAL_MS);
      }
    },
    onStreamReset: () => {
      if (stale()) return;
      svc.forceFlushTokens();
      svc.state.streamingContent = '';
      svc.tokenBuffer = '';
      replySpeech.resetText();
    },
    onFinalResponse: (content: string) => {
      if (stale()) return;
      svc.state.streamingContent = content;
      replySpeech.update(content);
      useChatStore.getState().appendToStreamingMessage(content);
    },
  };
}

async function checkProviderReadiness(svc: any): Promise<string | null> {
  if (isAppleModelSelected()) {
    try { await foundationModelService.assertReady(); return null; }
    catch (error) { return error instanceof Error ? error.message : 'Apple model unavailable'; }
  }
  if (svc.isUsingRemoteProvider()) {
    const provider = svc.getCurrentProvider();
    if (!provider) return 'Remote provider not found';
    const ready = await provider.isReady();
    if (!ready) return 'Remote provider not ready';
  } else if (isLiteRTActive()) {
    if (!liteRTService.isModelLoaded()) return 'No LiteRT model loaded';
  } else {
    if (!llmService.isModelLoaded()) return 'No model loaded';
    if (llmService.isCurrentlyGenerating()) return 'LLM service busy';
  }
  return null;
}

export async function prepareGenerationImpl(svc: any, conversationId: string, messages: Message[] = []): Promise<boolean> {
  if (svc.state.isGenerating) return false;
  svc.generationSequence = (svc.generationSequence || 0) + 1;
  const sequence = svc.generationSequence;
  svc.documentSources = mergeDocumentSources([], messages.filter(m => m.role === 'system').flatMap(m => m.documentSources || []));
  svc.updateState({
    isGenerating: true, isThinking: true, conversationId,
    streamingContent: '', startTime: Date.now(),
  });
  replySpeech.begin(useAppStore.getState().settings.readRepliesAloud);
  useChatStore.getState().startStreaming(conversationId);
  beginContextUsage(conversationId);
  // Drain pending native stop so LLM is idle before we start.
  if (svc.pendingStop !== null) await svc.pendingStop;
  if (!svc.state.isGenerating || sequence !== svc.generationSequence) return false; // stop called during drain
  svc.abortRequested = false;

  const readinessError = await checkProviderReadiness(svc);
  if (sequence !== svc.generationSequence) return false;
  if (readinessError) {
    svc.resetState();
    useChatStore.getState().clearStreamingMessage();
    throw new Error(readinessError);
  }

  svc.tokenBuffer = '';
  svc.reasoningBuffer = '';
  svc.totalReasoningLength = 0;
  svc.remoteTimeToFirstToken = undefined;
  return true;
}

function assertLiteRTImageSupport(
  imageUris: string[] | undefined,
  svc: any,
  chatStore: ReturnType<typeof useChatStore.getState>,
): void {
  if (!imageUris || imageUris.length === 0) return;
  const { downloadedModels, activeModelId } = useAppStore.getState();
  const activeModel = downloadedModels.find((m: any) => m.id === activeModelId);
  const liteRTActiveModel = activeModel?.engine === 'litert' ? activeModel : null;
  if (!liteRTActiveModel?.liteRTVision) {
    chatStore.clearStreamingMessage();
    svc.resetState();
    throw new Error('This model does not support images. Import it with vision enabled, or remove the image.');
  }
}

async function runLiteRTResponseImpl(svc: any, req: GenerationRequest): Promise<void> {
  const { conversationId, messages, onFirstToken } = req;
  const sequence = svc.generationSequence;
  const chatStore = useChatStore.getState();
  let callbackError: Error | null = null;
  let firstTokenReceived = false;
  let jsTtftSeconds: number | undefined;

  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser) {
    chatStore.clearStreamingMessage();
    svc.resetState();
    return;
  }
  const systemMsg = messages.find(m => m.role === 'system');
  const systemPrompt = typeof systemMsg?.content === 'string' ? systemMsg.content : '';
  const allAttachments = lastUser.attachments ?? [];
  const imageUris = allAttachments
    .filter((a: any) => a.type === 'image' && typeof a.uri === 'string' && a.uri.trim().length > 0)
    .map((a: any) => a.uri);

  assertLiteRTImageSupport(imageUris, svc, chatStore);

  const history = buildLiteRTHistory(messages);

  try {
    const { settings } = useAppStore.getState();
    await liteRTService.prepareConversation(conversationId, systemPrompt, {
      samplerConfig: { temperature: settings.liteRTTemperature, topP: settings.liteRTTopP },
      history,
    });

    await liteRTService.sendMessage(
      typeof lastUser.content === 'string' ? lastUser.content : '',
      {
        onToken: (token: string) => {
          if (svc.abortRequested || sequence !== svc.generationSequence) return;
          if (jsTtftSeconds === undefined && svc.state.startTime) {
            jsTtftSeconds = (Date.now() - svc.state.startTime) / 1000;
          }
          if (!firstTokenReceived) {
            firstTokenReceived = true;
            svc.updateState({ isThinking: false });
            onFirstToken?.();
          }
          svc.state.streamingContent += token;
          svc.tokenBuffer += token;
          if (!svc.flushTimer) {
            svc.flushTimer = setTimeout(() => svc.flushTokenBuffer(), FLUSH_INTERVAL_MS);
          }
        },
        onReasoning: (token: string) => {
          if (svc.abortRequested || sequence !== svc.generationSequence) return;
          // Capture TTFT on first thinking token so it reflects time-to-first-visible-output
          if (jsTtftSeconds === undefined && svc.state.startTime) {
            jsTtftSeconds = (Date.now() - svc.state.startTime) / 1000;
          }
          svc.reasoningBuffer += token;
          if (!svc.flushTimer) {
            svc.flushTimer = setTimeout(() => svc.flushTokenBuffer(), FLUSH_INTERVAL_MS);
          }
        },
        onComplete: (_content: string, _reasoning: string, stats) => {
          if (svc.abortRequested || sequence !== svc.generationSequence) return;
          svc.forceFlushTokens();
          svc.liteRTBenchmarkStats = stats ? { ...stats, ttft: jsTtftSeconds ?? stats.ttft } : stats;
          const generationTime = svc.state.startTime ? Date.now() - svc.state.startTime : undefined;
          chatStore.finalizeStreamingMessage(conversationId, generationTime, buildGenerationMetaImpl(svc));
          svc.checkSharePrompt();
          svc.resetState(true);
        },
        onError: (err: Error) => {
          if (svc.abortRequested || sequence !== svc.generationSequence) return;
          callbackError = err;
          logger.error('[LiteRT] sendMessage error:', err.message);
          if (svc.flushTimer) { clearTimeout(svc.flushTimer); svc.flushTimer = null; }
          svc.tokenBuffer = '';
          chatStore.clearStreamingMessage();
          svc.resetState();
        },
      },
      imageUris,
    );
  } catch (error: any) {
    if (callbackError) throw callbackError;
    if (svc.abortRequested || sequence !== svc.generationSequence) return;
    if (svc.flushTimer) { clearTimeout(svc.flushTimer); svc.flushTimer = null; }
    svc.tokenBuffer = '';
    chatStore.clearStreamingMessage();
    svc.resetState();
    throw error;
  }
}

export async function generateResponseImpl(
  svc: any,
  req: GenerationRequest,
): Promise<void> {
  const { conversationId, messages, onFirstToken } = req;
  if (!(await prepareGenerationImpl(svc, conversationId, messages))) return;
  const sequence = svc.generationSequence;

  if (isLiteRTActive()) {
    return runLiteRTResponseImpl(svc, req);
  }

  const chatStore = useChatStore.getState();
  let firstTokenReceived = false;

  // llama.cpp path — unchanged
  try {
    await llmService.generateResponse(
      messages,
      (data) => {
        if (svc.abortRequested || sequence !== svc.generationSequence) return;
        const chunk = typeof data === 'string' ? { content: data, reasoningContent: undefined } : data;
        if (!firstTokenReceived) {
          firstTokenReceived = true;
          svc.updateState({ isThinking: false });
          onFirstToken?.();
        }
        if (chunk.content) {
          svc.state.streamingContent += chunk.content;
          svc.tokenBuffer += chunk.content;
        }
        if (chunk.reasoningContent) {
          svc.reasoningBuffer += chunk.reasoningContent;
        }
        if (!svc.flushTimer) {
          svc.flushTimer = setTimeout(() => svc.flushTokenBuffer(), FLUSH_INTERVAL_MS);
        }
      },
      () => {
        // If aborted, stopGeneration() already handled cleanup — don't clobber new generation state.
        if (svc.abortRequested || sequence !== svc.generationSequence) return;
        svc.forceFlushTokens();
        const generationTime = svc.state.startTime ? Date.now() - svc.state.startTime : undefined;
        chatStore.finalizeStreamingMessage(conversationId, generationTime, buildGenerationMetaImpl(svc));
        svc.checkSharePrompt();
        svc.resetState(true);
      },
    );
  } catch (error) {
    if (svc.abortRequested || sequence !== svc.generationSequence) return;
    logger.error('[GenerationService] Generation error:', error);
    if (svc.flushTimer) { clearTimeout(svc.flushTimer); svc.flushTimer = null; }
    svc.tokenBuffer = '';
    chatStore.clearStreamingMessage();
    svc.resetState();
    throw error;
  }
}

export async function generateRemoteResponseImpl(
  svc: any,
  req: GenerationRequest,
): Promise<void> {
  const { conversationId, messages, onFirstToken } = req;
  if (!(await prepareGenerationImpl(svc, conversationId, messages))) return;
  const sequence = svc.generationSequence;
  const chatStore = useChatStore.getState();
  const provider = svc.getCurrentProvider();

  if (!provider) { svc.resetState(); throw new Error('No remote provider available'); }
  let callbackError: Error | null = null;
  let firstTokenReceived = false;
  svc.remoteTimeToFirstToken = undefined;

  const controller = new AbortController();
  svc.currentRemoteAbortController = controller;
  // Capture signal per-generation so callbacks stay guarded even after
  // abortRequested is reset by the next generation's prepareGeneration().
  const { signal: generationSignal } = controller;

  const { temperature, maxTokens, topP, thinkingEnabled } = useAppStore.getState().settings;
  const options: GenerationOptions = {
    temperature, maxTokens, topP,
    stopSequences: [],
    enableThinking: thinkingEnabled && provider.capabilities.supportsThinking,
  };

  try {
    await provider.generate(messages, options, {
      onToken: (token: string) => {
        if (generationSignal.aborted || sequence !== svc.generationSequence) return;
        if (!firstTokenReceived) {
          firstTokenReceived = true;
          svc.remoteTimeToFirstToken = svc.state.startTime
            ? (Date.now() - svc.state.startTime) / 1000
            : undefined;
          svc.updateState({ isThinking: false });
          onFirstToken?.();
        }
        svc.state.streamingContent += token;
        svc.tokenBuffer += token;
        if (!svc.flushTimer) {
          svc.flushTimer = setTimeout(() => svc.flushTokenBuffer(), FLUSH_INTERVAL_MS);
        }
      },
      onReasoning: (content: string) => {
        if (generationSignal.aborted || sequence !== svc.generationSequence) return;
        svc.reasoningBuffer += content;
        svc.totalReasoningLength += content.length;
        if (!svc.flushTimer) {
          svc.flushTimer = setTimeout(() => svc.flushTokenBuffer(), FLUSH_INTERVAL_MS);
        }
      },
      onComplete: (_result: CompletionResult) => {
        if (generationSignal.aborted || sequence !== svc.generationSequence) return;
        svc.forceFlushTokens();
        const generationTime = svc.state.startTime ? Date.now() - svc.state.startTime : undefined;
        chatStore.finalizeStreamingMessage(conversationId, generationTime, buildGenerationMetaImpl(svc));
        svc.checkSharePrompt();
        svc.resetState(true);
      },
      onError: (error: Error) => {
        if (generationSignal.aborted || sequence !== svc.generationSequence) return;
        callbackError = error;
        logger.error('[GenerationService] Remote generation error:', error);
        if (svc.flushTimer) { clearTimeout(svc.flushTimer); svc.flushTimer = null; }
        svc.tokenBuffer = '';
        chatStore.clearStreamingMessage();
        svc.resetState();
        throw error;
      },
    });
  } catch (error) {
    if (callbackError) throw callbackError;
    if (generationSignal.aborted || sequence !== svc.generationSequence) return;
    logger.error('[GenerationService] Remote generation error:', error);
    // Mark server as offline so the Remote Servers screen reflects the failure
    const failedServerId = useRemoteServerStore.getState().activeServerId;
    if (failedServerId) useRemoteServerStore.getState().updateServerHealth(failedServerId, false);
    if (svc.flushTimer) { clearTimeout(svc.flushTimer); svc.flushTimer = null; }
    svc.tokenBuffer = '';
    chatStore.clearStreamingMessage();
    svc.resetState();
    throw error;
  } finally {
    if (svc.currentRemoteAbortController === controller) svc.currentRemoteAbortController = null;
  }
}

export async function generateRemoteWithToolsImpl(
  svc: any,
  req: GenerationWithToolsRequest,
): Promise<void> {
  const { conversationId, messages, options } = req;
  logger.log(`[GenService][DEBUG] generateRemoteWithToolsImpl — conv=${conversationId}, messages=${messages.length}, enabledToolIds=[${options.enabledToolIds.join(', ')}]`);
  if (!(await prepareGenerationImpl(svc, conversationId, messages))) {
    logger.log(`[GenService][DEBUG] prepareGeneration returned false, aborting`);
    return;
  }
  const sequence = svc.generationSequence;
  const provider = svc.getCurrentProvider();

  if (!provider) { svc.resetState(); throw new Error('No remote provider available'); }
  logger.log(`[GenService][DEBUG] Provider ready — type=${provider.type}, capabilities=${JSON.stringify(provider.capabilities)}`);

  const { enabledToolIds, projectId, ...callbacks } = options;

  // Use the same tool loop but with remote provider
  await runToolLoop({
    conversationId, messages, enabledToolIds, projectId, callbacks,
    ...buildToolLoopHandlersImpl(svc),
    forceRemote: true,
  });

  if (svc.abortRequested || sequence !== svc.generationSequence) {
    logger.log(`[GenService][DEBUG] Generation was aborted, skipping finalize`);
  } else {
    svc.forceFlushTokens();
    const generationTime = svc.state.startTime ? Date.now() - svc.state.startTime : undefined;
    logger.log(`[GenService][DEBUG] Finalizing — streamingContent length=${svc.state.streamingContent?.length || 0}, generationTime=${generationTime}ms`);
    useChatStore.getState().finalizeStreamingMessage(
      conversationId, generationTime, buildGenerationMetaImpl(svc),
    );
    svc.checkSharePrompt();
    svc.resetState(true);
  }
}
