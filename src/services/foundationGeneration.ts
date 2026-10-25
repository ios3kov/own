import {scheduleTokenFlush} from './streamFlush';
import { mergeDocumentSources } from './documentSources';
import { foundationModelService, APPLE_MODEL_NAME } from './foundationModels';
import { useChatStore } from '../stores/chatStore';
import type { Message } from '../types';

/** Uses the existing generation lifecycle; never routes Apple failures to another model. */
export async function generateFoundationResponse(
  svc: any,
  request: {
    conversationId: string;
    messages: Message[];
    onFirstToken?: () => void;
    enabledToolIds?: string[];
    projectId?: string;
    onToolCallStart?: (name: string, args: Record<string, unknown>) => void;
    onToolCallComplete?: (name: string, result: any) => void;
  },
): Promise<void> {
  if (!(await svc.prepareGeneration(request.conversationId, request.messages))) return;
  const sequence = svc.generationSequence;
  let first = true;
  try {
    await foundationModelService.generate(request.messages, {
      ...request,
      onContextNotice: notice => {
        if (svc.abortRequested || sequence !== svc.generationSequence) return;
        useChatStore.getState().addMessage(request.conversationId,{role:'system',content:notice,isSystemInfo:true});
      },
      onToolCallComplete: (name, result) => {
        if (svc.abortRequested || sequence !== svc.generationSequence) return;
        svc.documentSources = mergeDocumentSources(svc.documentSources || [], result.documentSources || []);
        request.onToolCallComplete?.(name, result);
      },
      onToken: token => {
        if (svc.abortRequested || sequence !== svc.generationSequence || !token) return;
        if (first) {
          first = false;
          svc.updateState({ isThinking: false });
          request.onFirstToken?.();
        }
        svc.state.streamingContent += token;
        svc.tokenBuffer += token;
        scheduleTokenFlush(svc);
      },
    });
    if (svc.abortRequested || sequence !== svc.generationSequence) return;
    svc.forceFlushTokens();
    useChatStore
      .getState()
      .finalizeStreamingMessage(
        request.conversationId,
        svc.state.startTime ? Date.now() - svc.state.startTime : undefined,
        {
          ...(svc.documentSources?.length ? {documentSources:[...svc.documentSources]} : {}),
          modelName: APPLE_MODEL_NAME,
          gpu: false,
          gpuBackend: 'Apple on-device',
        },
      );
    svc.resetState(true);
  } catch (error) {
    if (svc.abortRequested || sequence !== svc.generationSequence) return;
    if (svc.flushTimer) {
      clearTimeout(svc.flushTimer);
      svc.flushTimer = null;
    }
    svc.tokenBuffer = '';
    useChatStore.getState().clearStreamingMessage();
    svc.resetState();
    throw error;
  }
}
