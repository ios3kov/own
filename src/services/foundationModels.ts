import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { create } from 'zustand';
import { useAppStore } from '../stores/appStore';
import type { Message } from '../types';
import { AVAILABLE_TOOLS } from './tools/registry';
import { executeToolCall } from './tools/handlers';

export const APPLE_MODEL_ID = 'apple-foundation-models';
export const APPLE_MODEL_NAME = 'Apple Foundation Models';
export type AppleAvailability = { available: boolean; reason: string };
export const useFoundationStore = create<{ availability: AppleAvailability }>(
  () => ({
    availability: { available: false, reason: 'checking' },
  }),
);
const explanations: Record<string, string> = {
  checking: 'Checking the Apple model…',
  available: 'Ready on this device. No model download in Own is needed.',
  deviceNotEligible: 'This device does not support Apple Intelligence.',
  appleIntelligenceNotEnabled:
    'Enable Apple Intelligence in Settings to use the Apple model.',
  modelNotReady:
    'The Apple model is not ready. iOS may still be preparing it. You can retry or choose another model.',
  unsupportedOS: 'The Apple model requires iOS 26 or later.',
  unsupportedPlatform:
    'The Apple model is available only on supported Apple devices.',
  checkFailed:
    'Could not check the Apple model. Retry or choose another model.',
};
export function appleAvailabilityMessage(status: AppleAvailability): string {
  return (
    explanations[status.reason] ||
    'The Apple model is unavailable. Retry or choose another model.'
  );
}
export function isAppleModelSelected(): boolean {
  return useAppStore.getState().activeModelId === APPLE_MODEL_ID;
}
let sequence = 0;
let activeRequest: string | null = null;
let pendingStop: Promise<void> | null = null;
const bridge = () => NativeModules.OwnFoundationModels;

export const foundationModelService = {
  async refreshAvailability(
    hasExplicitRemoteSelection: boolean | (() => boolean) = false,
  ): Promise<AppleAvailability> {
    let availability: AppleAvailability;
    try {
      if (Platform.OS !== 'ios')
        availability = { available: false, reason: 'unsupportedPlatform' };
      else {
        const result = await bridge()?.availability();
        availability =
          typeof result?.available === 'boolean' &&
          typeof result?.reason === 'string'
            ? result
            : { available: false, reason: 'checkFailed' };
      }
    } catch {
      availability = { available: false, reason: 'checkFailed' };
    }
    useFoundationStore.setState({ availability });
    // Re-read after await: never overwrite a choice made during the check.
    if (
      Platform.OS === 'ios' &&
      !(typeof hasExplicitRemoteSelection === 'function'
        ? hasExplicitRemoteSelection()
        : hasExplicitRemoteSelection) &&
      useAppStore.getState().activeModelId === null
    ) {
      useAppStore.getState().setActiveModelId(APPLE_MODEL_ID);
    }
    return availability;
  },
  async assertReady(): Promise<void> {
    const status = await this.refreshAvailability(true);
    if (!status.available) throw new Error(appleAvailabilityMessage(status));
  },
  async stopGeneration(): Promise<void> {
    const id = activeRequest;
    activeRequest = null;
    if (id) {
      pendingStop = Promise.resolve(bridge()?.cancel(id)).finally(() => {
        pendingStop = null;
      });
    }
    if (pendingStop) await pendingStop;
  },
  async generate(
    messages: Message[],
    options: {
      onToken: (token: string) => void;
      enabledToolIds?: string[];
      projectId?: string;
      onToolCallStart?: (name: string, args: Record<string, unknown>) => void;
      onToolCallComplete?: (name: string, result: any) => void;
    },
  ): Promise<string> {
    await this.assertReady();
    if (pendingStop) await pendingStop;
    if (activeRequest) throw new Error('Apple model is already responding.');
    if (messages.some(m => m.attachments?.some(a => a.type === 'image'))) {
      throw new Error(
        'Choose an image-capable model to use image attachments.',
      );
    }
    const requestId = `apple-${Date.now()}-${++sequence}`;
    activeRequest = requestId;
    const native = bridge();
    let stream: { remove: () => void } | undefined;
    let toolListener: { remove: () => void } | undefined;
    try {
      const emitter = new NativeEventEmitter(native);
      const enabled = new Set(options.enabledToolIds || []);
      const tools = AVAILABLE_TOOLS.filter(tool => enabled.has(tool.id));
      let content = '';
      let streamError: Error | null = null;
      stream = emitter.addListener('OwnFoundationToken', event => {
        if (activeRequest !== requestId || event.requestId !== requestId)
          return;
        if (
          typeof event.content !== 'string' ||
          !event.content.startsWith(content)
        ) {
          streamError = new Error(
            'The Apple response stream changed unexpectedly. Please retry.',
          );
          native.cancel(requestId);
          return;
        }
        const delta = event.content.slice(content.length);
        content = event.content;
        if (delta) options.onToken(delta);
      });
      toolListener = emitter.addListener('OwnFoundationTool', async event => {
        if (activeRequest !== requestId || event.requestId !== requestId)
          return;
        try {
          if (
            !tools.some(tool => tool.name === event.name) ||
            typeof event.arguments !== 'string' ||
            event.arguments.length > 8192
          ) {
            throw new Error('Invalid Apple tool request.');
          }
          const args = JSON.parse(event.arguments);
          if (!args || Array.isArray(args) || typeof args !== 'object')
            throw new Error('Invalid tool arguments.');
          options.onToolCallStart?.(event.name, args);
          const result = await executeToolCall({
            id: event.callId,
            name: event.name,
            arguments: args,
            context: { projectId: options.projectId },
          });
          if (activeRequest !== requestId) return;
          options.onToolCallComplete?.(event.name, result);
          native.resolveTool(
            requestId,
            event.callId,
            JSON.stringify({
              content: result.content,
              error: result.error,
            }).slice(0, 24000),
          );
        } catch {
          if (activeRequest === requestId)
            native.resolveTool(
              requestId,
              event.callId,
              '{"error":"Tool request failed."}',
            );
        }
      });
      const settings = useAppStore.getState().settings;
      const result = await native.generate({
        requestId,
        messages: messages
          .filter(m => !m.isSystemInfo)
          .map(m => ({ role: m.role, content: m.content })),
        temperature: settings.temperature,
        maxTokens: Math.min(settings.maxTokens, 2048),
        tools,
      });
      if (streamError) throw streamError;
      if (activeRequest !== requestId) throw new Error('Generation cancelled.');
      if (typeof result?.content !== 'string')
        throw new Error('The Apple model returned an invalid response.');
      if (result.content.startsWith(content))
        options.onToken(result.content.slice(content.length));
      else if (result.content !== content)
        throw new Error('The Apple response stream changed unexpectedly.');
      return result.content;
    } finally {
      stream?.remove();
      toolListener?.remove();
      if (activeRequest === requestId) activeRequest = null;
    }
  },
};
