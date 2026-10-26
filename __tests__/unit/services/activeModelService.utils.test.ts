/**
 * Unit tests for activeModelService/utils.ts
 * Covers native residency synchronization and resource accounting.
 */

import { syncWithNativeState, getResourceUsage } from '../../../src/services/activeModelService/utils';

jest.mock('../../../src/services/llm', () => ({
  llmService: { isModelLoaded: jest.fn() },
}));


jest.mock('../../../src/services/coreMLImageGenerator', () => ({
  coreMLImageGeneratorService: { isModelLoaded: jest.fn(() => Promise.resolve(false)) },
}));

jest.mock('../../../src/stores', () => ({
  useAppStore: {
    getState: jest.fn(() => ({
      activeModelId: 'model-abc',
      activeImageModelId: null,
      downloadedModels: [],
      downloadedImageModels: [],
    })),
  },
}));

jest.mock('../../../src/services/hardware', () => ({
  hardwareService: {
    refreshMemoryInfo: jest.fn(() =>
      Promise.resolve({ usedMemory: 0, totalMemory: 0, availableMemory: 0 }),
    ),
  },
}));

import { llmService } from '../../../src/services/llm';


const mockedLlm = llmService as jest.Mocked<typeof llmService>;

function makeTarget(overrides: Partial<{ loadedTextModelId: string | null; loadedImageModelId: string | null }> = {}) {
  const t = {
    loadedTextModelId: overrides.loadedTextModelId ?? null,
    loadedImageModelId: overrides.loadedImageModelId ?? null,
    setLoadedTextModelId: jest.fn((id: string | null) => { t.loadedTextModelId = id; }),
    setLoadedImageModelId: jest.fn((id: string | null) => { t.loadedImageModelId = id; }),
    setLoadedImageModelThreads: jest.fn(),
  };
  return t;
}

describe('syncWithNativeState', () => {
  beforeEach(() => jest.clearAllMocks());


  it('clears loadedTextModelId when both services are not loaded', async () => {
    mockedLlm.isModelLoaded.mockReturnValue(false);

    const target = makeTarget({ loadedTextModelId: 'old-model' });
    await syncWithNativeState(target);

    expect(target.setLoadedTextModelId).toHaveBeenCalledWith(null);
  });


  it('sets loadedTextModelId when only llmService is loaded and target has no id', async () => {
    mockedLlm.isModelLoaded.mockReturnValue(true);

    const target = makeTarget({ loadedTextModelId: null });
    await syncWithNativeState(target);

    expect(target.setLoadedTextModelId).toHaveBeenCalledWith('model-abc');
  });
});


it('does not count selected model weights after native contexts are released', async () => {
  const {useAppStore} = require('../../../src/stores');
  const {coreMLImageGeneratorService} = require('../../../src/services/coreMLImageGenerator');
  useAppStore.getState.mockReturnValue({activeModelId:'text',activeImageModelId:'image',
    downloadedModels:[{id:'text',fileSize:100}],downloadedImageModels:[{id:'image',size:200}]});
  mockedLlm.isModelLoaded.mockReturnValue(false);
  coreMLImageGeneratorService.isModelLoaded.mockResolvedValue(false);
  expect((await getResourceUsage()).estimatedModelMemory).toBe(0);
  mockedLlm.isModelLoaded.mockReturnValue(true);
  coreMLImageGeneratorService.isModelLoaded.mockResolvedValue(true);
  expect((await getResourceUsage()).estimatedModelMemory).toBe(380);
});
