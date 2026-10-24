/**
 * Unit tests for generationServiceHelpers.ts
 * Focuses on vision guard and buildGenerationMetaImpl LiteRT branches.
 */

import { buildGenerationMetaImpl,prepareGenerationImpl,generateResponseImpl } from '../../../src/services/generationServiceHelpers';

jest.mock('../../../src/services/llm', () => ({
  llmService: {
    isModelLoaded: jest.fn(() => false),
    isCurrentlyGenerating: jest.fn(() => false),
    generateResponse: jest.fn(),
    getGpuInfo: jest.fn(() => ({ gpu: false, gpuBackend: 'CPU', gpuLayers: 0 })),
    getPerformanceStats: jest.fn(() => ({
      lastTokensPerSecond: 10,
      lastDecodeTokensPerSecond: 12,
      lastTimeToFirstToken: 0.4,
      lastGenerationTime: 2,
      lastTokenCount: 40,
    })),
  },
}));


jest.mock('../../../src/stores', () => ({
  useAppStore: {
    getState: jest.fn(),
  },
  useChatStore: {
    getState: jest.fn(() => ({
      startStreaming: jest.fn(),
      clearStreamingMessage: jest.fn(),
      appendToStreamingMessage: jest.fn(),
      finalizeStreamingMessage: jest.fn(),
    })),
  },
  useRemoteServerStore: {
    getState: jest.fn(() => ({
      getActiveServer: jest.fn(() => null),
      activeServerId: null,
      updateServerHealth: jest.fn(),
    })),
  },
}));

jest.mock('../../../src/stores/debugLogsStore', () => ({
  useDebugLogsStore: {
    getState: jest.fn(() => ({ addLog: jest.fn() })),
  },
}));

jest.mock('../../../src/services/generationToolLoop', () => ({
  runToolLoop: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { useAppStore,useChatStore } from '../../../src/stores';


const mockedGetState = useAppStore.getState as jest.Mock;


describe('buildGenerationMetaImpl — remote provider path', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns remote meta with estimated token count', () => {
    const { useRemoteServerStore } = require('../../../src/stores');
    useRemoteServerStore.getState.mockReturnValue({
      getActiveServer: () => ({ name: 'My Server' }),
      activeServerId: 'srv-1',
      updateServerHealth: jest.fn(),
    });

    const svc = {
      isUsingRemoteProvider: () => true,
      state: { streamingContent: 'hello world test', startTime: Date.now() - 2000 },
      totalReasoningLength: 8,
      remoteTimeToFirstToken: 0.3,
    };

    const meta = buildGenerationMetaImpl(svc);
    expect(meta.gpuBackend).toBe('Remote');
    expect(meta.modelName).toBe('My Server');
    expect(meta.gpu).toBe(false);
    expect(meta.tokenCount).toBeGreaterThan(0);
    expect(meta.timeToFirstToken).toBe(0.3);
  });

  it('uses fallback name when no active server', () => {
    const { useRemoteServerStore } = require('../../../src/stores');
    useRemoteServerStore.getState.mockReturnValue({
      getActiveServer: () => null,
      activeServerId: null,
      updateServerHealth: jest.fn(),
    });

    const svc = {
      isUsingRemoteProvider: () => true,
      state: { streamingContent: 'tokens', startTime: null },
      totalReasoningLength: 0,
      remoteTimeToFirstToken: undefined,
    };

    const meta = buildGenerationMetaImpl(svc);
    expect(meta.modelName).toBe('Remote Model');
    expect(meta.tokensPerSecond).toBeUndefined();
  });
});


// ---------------------------------------------------------------------------
// prepareGenerationImpl
// ---------------------------------------------------------------------------

function makeSvc(overrides: any = {}) {
  const state = { isGenerating: false, startTime: Date.now(), streamingContent: '', ...overrides.state };
  const svc = {
    state,
    updateState: jest.fn((patch: any) => { Object.assign(state, patch); }),
    pendingStop: null,
    abortRequested: false,
    resetState: jest.fn(),
    tokenBuffer: '',
    reasoningBuffer: '',
    totalReasoningLength: 0,
    remoteTimeToFirstToken: undefined,
    isUsingRemoteProvider: () => false,
    getCurrentProvider: () => null,
  };
  const { state: _s, ...rest } = overrides;
  return { ...svc, ...rest };
}

function makeLlmAppState() {
  return {
    downloadedModels: [{ id: 'llm-1', engine: 'ggml', name: 'Llama' }],
    activeModelId: 'llm-1',
    settings: {readRepliesAloud:false},
    downloadedImageModels: [],
    activeImageModelId: null,
  };
}

describe('prepareGenerationImpl', () => {
  it('returns false immediately when already generating', async () => {
    const svc = makeSvc({ state: { isGenerating: true } });
    const result = await prepareGenerationImpl(svc, 'conv-1');
    expect(result).toBe(false);
  });


  it('throws when llama.cpp not loaded', async () => {
    const { llmService: llm } = require('../../../src/services/llm');
    llm.isModelLoaded.mockReturnValue(false);
    mockedGetState.mockReturnValue(makeLlmAppState());

    const svc = makeSvc();
    await expect(prepareGenerationImpl(svc, 'conv-1')).rejects.toThrow('No model loaded');
  });

  it('throws when llama.cpp is busy', async () => {
    const { llmService: llm } = require('../../../src/services/llm');
    llm.isModelLoaded.mockReturnValue(true);
    llm.isCurrentlyGenerating.mockReturnValue(true);
    mockedGetState.mockReturnValue(makeLlmAppState());

    const svc = makeSvc();
    await expect(prepareGenerationImpl(svc, 'conv-1')).rejects.toThrow('LLM service busy');
  });
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------


function makeServiceSvc() {
  return {
    ...makeSvc(),
    flushTimer: null,
    liteRTBenchmarkStats: null,
    forceFlushTokens: jest.fn(),
    flushTokenBuffer: jest.fn(),
    checkSharePrompt: jest.fn(),
    isUsingRemoteProvider: () => false,
    getCurrentProvider: () => null,
  };
}


const makeLlmSvc = makeServiceSvc;


// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

describe('generateResponseImpl — llama.cpp path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetState.mockReturnValue(makeLlmAppState());
  });

  it('calls finalizeStreamingMessage on successful completion', async () => {
    const { llmService: llm } = require('../../../src/services/llm');
    llm.isModelLoaded.mockReturnValue(true);
    llm.isCurrentlyGenerating.mockReturnValue(false);

    const finalize = jest.fn();
    (useChatStore.getState as jest.Mock).mockReturnValue({
      startStreaming: jest.fn(),
      clearStreamingMessage: jest.fn(),
      appendToStreamingMessage: jest.fn(),
      finalizeStreamingMessage: finalize,
    });

    llm.generateResponse.mockImplementation((_msgs: any, onChunk: any, onComplete: any) => {
      onChunk({ content: 'hello', reasoningContent: undefined });
      onChunk({ content: undefined, reasoningContent: 'thinking' });
      onComplete();
      return Promise.resolve();
    });

    await generateResponseImpl(makeLlmSvc(), {
      conversationId: 'conv-1',
      messages: [{ id: '1', timestamp: 0, role: 'user' as const, content: 'hi' }],
    });

    expect(finalize).toHaveBeenCalled();
  });

  it('clears streaming message and rethrows on generateResponse error', async () => {
    const { llmService: llm } = require('../../../src/services/llm');
    llm.isModelLoaded.mockReturnValue(true);
    llm.isCurrentlyGenerating.mockReturnValue(false);

    const clear = jest.fn();
    (useChatStore.getState as jest.Mock).mockReturnValue({
      startStreaming: jest.fn(),
      clearStreamingMessage: clear,
      appendToStreamingMessage: jest.fn(),
      finalizeStreamingMessage: jest.fn(),
    });

    llm.generateResponse.mockRejectedValue(new Error('gpu crash'));

    await expect(
      generateResponseImpl(makeLlmSvc(), {
        conversationId: 'conv-1',
        messages: [{ id: '1', timestamp: 0, role: 'user' as const, content: 'hi' }],
      }),
    ).rejects.toThrow('gpu crash');

    expect(clear).toHaveBeenCalled();
  });
});
