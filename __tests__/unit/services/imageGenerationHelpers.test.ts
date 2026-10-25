/**
 * Image Generation Helpers Unit Tests
 *
 * Tests for pure helper functions used in image generation:
 * buildEnhancementMessages, getConversationContext, cleanEnhancedPrompt, buildImageGenMeta.
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('../../../src/stores', () => ({
  useChatStore: {
    getState: jest.fn(),
  },
}));

import { Platform } from 'react-native';
import { useChatStore } from '../../../src/stores';
import {
buildEnhancementMessages,
getConversationContext,
cleanEnhancedPrompt,
buildImageGenMeta,
needsImagePromptTranslation,
isImagePromptRefusal,
} from '../../../src/services/imageGenerationHelpers';

const mockGetState = useChatStore.getState as jest.Mock;

describe('buildEnhancementMessages', () => {
  it('returns system + user message when no context', () => {
    const msgs = buildEnhancementMessages('a cat', []);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].content).toContain('a cat');
  });

  it('includes context messages between system and user', () => {
    const ctx = [
      { id: '1', role: 'user' as const, content: 'hello', timestamp: 1 },
      { id: '2', role: 'assistant' as const, content: 'hi', timestamp: 2 },
    ];
    const msgs = buildEnhancementMessages('a dog', ctx);
    expect(msgs).toHaveLength(4); // system + 2 ctx + user
    expect(msgs[0].role).toBe('system');
    expect(msgs[1]).toBe(ctx[0]);
    expect(msgs[2]).toBe(ctx[1]);
    expect(msgs[3].content).toContain('a dog');
  });

  it('uses context-aware system prompt when context is provided', () => {
    const ctx = [{ id: '1', role: 'user' as const, content: 'make it darker', timestamp: 1 }];
    const msgs = buildEnhancementMessages('same scene', ctx);
    expect(msgs[0].content).toContain('conversation');
  });

  it('uses standalone system prompt when no context', () => {
    const msgs = buildEnhancementMessages('sunset', []);
    expect(msgs[0].content).not.toContain('conversation history');
  });

  it('quotes user content as data in an explicit rewrite task', () => {
    const msgs = buildEnhancementMessages('mountains', []);
    expect(msgs[msgs.length - 1].content).toContain('Do not carry out the request yourself');
    expect(msgs[msgs.length - 1].content).toContain('"mountains"');
  });
});

describe('getConversationContext', () => {
  it('returns empty array when conversation not found', () => {
    mockGetState.mockReturnValue({ conversations: [] });
    expect(getConversationContext('missing-id')).toEqual([]);
  });

  it('returns empty array when conversation has no messages', () => {
    mockGetState.mockReturnValue({
      conversations: [{ id: 'c1', messages: null }],
    });
    expect(getConversationContext('c1')).toEqual([]);
  });

  it('filters to only user and assistant messages', () => {
    mockGetState.mockReturnValue({
      conversations: [{
        id: 'c1',
        messages: [
          { id: 'm1', role: 'user', content: 'hello', timestamp: 1 },
          { id: 'm2', role: 'system', content: 'sys', timestamp: 2 },
          { id: 'm3', role: 'assistant', content: 'hi', timestamp: 3 },
          { id: 'm4', role: 'tool', content: 'result', timestamp: 4 },
        ],
      }],
    });
    const ctx = getConversationContext('c1');
    expect(ctx).toHaveLength(2);
    expect(ctx[0].role).toBe('user');
    expect(ctx[1].role).toBe('assistant');
  });

  it('takes last 10 messages', () => {
    const messages = Array.from({ length: 15 }, (_, i) => ({
      id: `m${i}`, role: 'user' as const, content: `msg${i}`, timestamp: i,
    }));
    mockGetState.mockReturnValue({ conversations: [{ id: 'c1', messages }] });
    const ctx = getConversationContext('c1');
    expect(ctx).toHaveLength(10);
    expect(ctx[0].content).toBe('msg5'); // last 10 start at index 5
  });

  it('truncates content to 500 chars', () => {
    const longContent = 'x'.repeat(600);
    mockGetState.mockReturnValue({
      conversations: [{
        id: 'c1',
        messages: [{ id: 'm1', role: 'user', content: longContent, timestamp: 1 }],
      }],
    });
    const ctx = getConversationContext('c1');
    expect(ctx[0].content).toHaveLength(500);
  });

  it('prefixes context message ids with ctx-', () => {
    mockGetState.mockReturnValue({
      conversations: [{
        id: 'c1',
        messages: [{ id: 'abc', role: 'user', content: 'hi', timestamp: 1 }],
      }],
    });
    const ctx = getConversationContext('c1');
    expect(ctx[0].id).toBe('ctx-abc');
  });
});

describe('cleanEnhancedPrompt', () => {
  it('trims whitespace', () => {
    expect(cleanEnhancedPrompt('  hello  ')).toBe('hello');
  });

  it('removes leading and trailing double quotes', () => {
    expect(cleanEnhancedPrompt('"a sunset"')).toBe('a sunset');
  });

  it('removes leading and trailing single quotes', () => {
    expect(cleanEnhancedPrompt("'a forest'")).toBe('a forest');
  });

  it('strips <think>...</think> blocks', () => {
    expect(cleanEnhancedPrompt('<think>reasoning here</think>the prompt')).toBe('the prompt');
  });

  it('strips multiline think blocks', () => {
    expect(cleanEnhancedPrompt('<think>\nlong\nthinking\n</think>result')).toBe('result');
  });

  it('handles already clean input', () => {
    expect(cleanEnhancedPrompt('a beautiful mountain')).toBe('a beautiful mountain');
  });

  it('handles empty string', () => {
    expect(cleanEnhancedPrompt('')).toBe('');
  });
});

describe('buildImageGenMeta', () => {
  const baseModel = { id: 'm1', name: 'TestModel', modelPath: '/path' };
  const baseOpts = { steps: 8, guidanceScale: 2.5, result: { width: 512, height: 512 } as any, useOpenCL: false };

  it('returns Core ML backend on iOS', () => {
    (Platform as any).OS = 'ios';
    const meta = buildImageGenMeta(baseModel, baseOpts);
    expect(meta.gpu).toBe(true);
    expect(meta.gpuBackend).toBe('Core ML');
  });

  it('includes model name, steps, guidanceScale, resolution', () => {
    const meta = buildImageGenMeta(baseModel, baseOpts);
    expect(meta.modelName).toBe('TestModel');
    expect(meta.steps).toBe(8);
    expect(meta.guidanceScale).toBe(2.5);
    expect(meta.resolution).toBe('512x512');
  });


});


describe('image language preparation', () => {
  it('detects Cyrillic and preserves an English request', () => {
    expect(needsImagePromptTranslation('Нарисуй собачку')).toBe(true);
    expect(needsImagePromptTranslation('A small puppy')).toBe(false);
  });
  it('keeps translation separate from optional artistic improvement', () => {
    const messages=buildEnhancementMessages('Нарисуй собачку', [], false);
    expect(messages[0].content).toContain('Do not add artistic details');
    expect(messages[1].content).toContain('Нарисуй собачку');
    expect(messages[1].content).toContain('Translate this JSON-quoted text into English');
  });
  it.each(["I'm unable to draw.", 'I cannot create images.', 'Sorry, I cannot do that.', 'As an AI model, I cannot draw.'])('rejects a refusal as an image description: %s', text => {
    expect(isImagePromptRefusal(text)).toBe(true);
  });
  it('allows a real subject description', () => {
    expect(isImagePromptRefusal('A small puppy on green grass')).toBe(false);
  });
});
