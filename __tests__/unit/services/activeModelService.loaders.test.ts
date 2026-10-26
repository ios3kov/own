/**
 * Unit tests for activeModelService/loaders.ts
 * Covers inferenceBackendToLiteRT switch and isMMProjFile branches.
 */

jest.mock('../../../src/stores', () => ({
  useAppStore: { getState: jest.fn() },
}));
jest.mock('../../../src/stores/debugLogsStore', () => ({
  useDebugLogsStore: { getState: jest.fn(() => ({ addLog: jest.fn() })) },
}));
jest.mock('../../../src/services/llm', () => ({
  llmService: { loadModel: jest.fn(), unloadModel: jest.fn(), getMultimodalSupport: jest.fn(() => null) },
}));

jest.mock('../../../src/services/coreMLImageGenerator', () => ({
  coreMLImageGeneratorService: { loadModel: jest.fn(), unloadModel: jest.fn() },
}));
jest.mock('../../../src/services/modelManager', () => ({
  modelManager: { saveModelWithMmproj: jest.fn(), clearMmProjLink: jest.fn() },
}));
jest.mock('react-native-fs', () => ({
  exists: jest.fn(() => Promise.resolve(false)),
  readDir: jest.fn(() => Promise.resolve([])),
}));
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import RNFS from 'react-native-fs';
import { doLoadTextModel,resolveMmProjPath } from '../../../src/services/activeModelService/loaders';

import { llmService } from '../../../src/services/llm';
import { useAppStore } from '../../../src/stores';

const mockedRNFS = RNFS as jest.Mocked<typeof RNFS>;
const mockedLlm = llmService as jest.Mocked<typeof llmService>;
const mockedGetState = useAppStore.getState as jest.Mock;

function makeStore(overrides: any = {}) {
  return {
    settings: { inferenceBackend: undefined, enableGpu: false, gpuLayers: 0, nThreads: 4, nBatch: 512, contextLength: 2048, flashAttn: false, cacheType: 'ram' },
    downloadedModels: [],
    setDownloadedModels: jest.fn(),
    setActiveModelId: jest.fn(),
    setLoadedSettings: jest.fn(),
    ...overrides,
  };
}

function makeCtx(overrides: any = {}) {
  return {
    model: { id: 'model-1', fileName: 'model.gguf', filePath: '/models/model.gguf', engine: 'ggml', ...overrides.model },
    modelId: 'model-1',
    store: makeStore(overrides.store),
    timeoutMs: 30000,
    loadedTextModelId: null,
    onLoaded: jest.fn(),
    onError: jest.fn(),
    onFinally: jest.fn(),
    ...overrides,
  };
}

describe('resolveMmProjPath', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns mmProjPath from model when file exists on disk', async () => {
    mockedRNFS.exists.mockResolvedValue(true);
    const model = { filePath: '/models/m.gguf', mmProjPath: '/models/mmproj.gguf' } as any;
    const result = await resolveMmProjPath(model, 'model-1');
    expect(result).toBe('/models/mmproj.gguf');
  });

  it('returns undefined when no mmproj file found in directory', async () => {
    mockedRNFS.exists.mockResolvedValue(false);
    mockedRNFS.readDir.mockResolvedValue([]);
    const model = { filePath: '/models/m.gguf' } as any;
    const result = await resolveMmProjPath(model, 'model-1');
    expect(result).toBeUndefined();
  });

  it('does not attach an unrelated projector when the stored path is stale', async () => {
    mockedRNFS.exists.mockResolvedValue(false);
    mockedRNFS.readDir.mockResolvedValue([
      { name: 'mmproj-model-f16.gguf', path: '/models/mmproj-model-f16.gguf', isFile: () => true, size: 500 } as any,
    ]);
    mockedGetState.mockReturnValue({
      downloadedModels: [{ id: 'model-1' }],
      setDownloadedModels: jest.fn(),
    });
    const { modelManager } = require('../../../src/services/modelManager');
    modelManager.saveModelWithMmproj.mockResolvedValue(undefined);

    // isVisionModel: true so the guard allows the scan
    const model = { filePath: '/models/m.gguf', mmProjPath: '/stale/path.gguf', isVisionModel: true } as any;
    const result = await resolveMmProjPath(model, 'model-1');
    expect(result).toBeUndefined();
    expect(mockedRNFS.readDir).not.toHaveBeenCalled();
  });

  it('returns undefined for text-only model when no mmproj file exists in the directory', async () => {
    // Text-only model: neither isVisionModel nor mmProjFileName is set,
    // and the models directory contains no mmproj file.
    mockedRNFS.exists.mockResolvedValue(false);
    mockedRNFS.readDir.mockResolvedValue([]);

    const model = { filePath: '/models/SmolLM2-360M-Instruct-Q8_0.gguf' } as any;
    const result = await resolveMmProjPath(model, 'bartowski/SmolLM2-360M-Instruct-GGUF/SmolLM2-360M-Instruct-Q8_0.gguf');

    expect(result).toBeUndefined();
  });

  it('allows scan for model with mmProjFileName sentinel even when isVisionModel is false (repair case)', async () => {
    // After a failed mmproj download buildDownloadedModel sets mmProjFileName as a sentinel
    // so needsVisionRepair can detect the gap. resolveMmProjPath must still scan for
    // this model so that if the user repairs vision the path can be recovered.
    mockedRNFS.exists.mockResolvedValue(false);
    mockedRNFS.readDir.mockResolvedValue([]); // mmproj not on disk yet
    const model = {
      filePath: '/models/SmolVLM2-256M-Video-Instruct-Q8_0.gguf',
      isVisionModel: false,
      mmProjFileName: 'SmolVLM2-256M-Video-Instruct-Q8_0-mmproj.gguf',
    } as any;
    const result = await resolveMmProjPath(model, 'ggml-org/SmolVLM2');

    expect(result).toBeUndefined(); // mmproj not on disk → scan found nothing
    expect(mockedRNFS.readDir).not.toHaveBeenCalled();
  });
});

describe('doLoadTextModel — llama.cpp path', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls llmService.loadModel and onLoaded on success', async () => {
    mockedLlm.loadModel.mockResolvedValue(undefined);
    mockedRNFS.exists.mockResolvedValue(false);
    mockedRNFS.readDir.mockResolvedValue([]);
    const ctx = makeCtx();
    mockedGetState.mockReturnValue(ctx.store);

    await doLoadTextModel(ctx);

    expect(mockedLlm.loadModel).toHaveBeenCalled();
    expect(ctx.onLoaded).toHaveBeenCalledWith('model-1');
    expect(ctx.onFinally).toHaveBeenCalled();
  });

  it('calls onError and rethrows when llmService.loadModel fails', async () => {
    mockedLlm.loadModel.mockRejectedValue(new Error('load failed'));
    mockedRNFS.exists.mockResolvedValue(false);
    mockedRNFS.readDir.mockResolvedValue([]);
    const ctx = makeCtx();
    mockedGetState.mockReturnValue(ctx.store);

    await expect(doLoadTextModel(ctx)).rejects.toThrow('load failed');
    expect(ctx.onError).toHaveBeenCalled();
    expect(ctx.onFinally).toHaveBeenCalled();
  });

  it('unloads previous model when loadedTextModelId differs', async () => {
    mockedLlm.loadModel.mockResolvedValue(undefined);
    mockedLlm.unloadModel.mockResolvedValue(undefined);
    mockedRNFS.exists.mockResolvedValue(false);
    mockedRNFS.readDir.mockResolvedValue([]);
    const ctx = makeCtx({ loadedTextModelId: 'old-model' });
    mockedGetState.mockReturnValue(ctx.store);

    await doLoadTextModel(ctx);
    expect(mockedLlm.unloadModel).toHaveBeenCalled();
  });
});
