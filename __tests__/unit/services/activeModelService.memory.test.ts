/**
 * Unit tests for activeModelService/memory.ts
 */

import { checkMemoryForDualModel,getCurrentlyLoadedMemoryGB,getOtherLoadedMemoryGB } from '../../../src/services/activeModelService/memory';

jest.mock('../../../src/services/llm', () => ({
  llmService: { isModelLoaded: jest.fn() },
}));


jest.mock('../../../src/services/hardware', () => ({
  hardwareService: {
    getDeviceInfo: jest.fn(() => Promise.resolve({ totalMemory: 8 * 1024 * 1024 * 1024 })),
  },
}));

import { llmService } from '../../../src/services/llm';


const mockedLlm = llmService as jest.Mocked<typeof llmService>;

const TEXT_MODEL = { id: 'model-1', name: 'Test Model', fileSize: 4 * 1024 * 1024 * 1024 } as any;
const IMAGE_MODEL = { id: 'img-1', name: 'Image Model', size: 2 * 1024 * 1024 * 1024 } as any;

const LISTS = {
  downloadedModels: [TEXT_MODEL],
  downloadedImageModels: [IMAGE_MODEL],
};

describe('getCurrentlyLoadedMemoryGB', () => {
  beforeEach(() => jest.clearAllMocks());


  it('returns 0 for text model when both services report not loaded', () => {
    mockedLlm.isModelLoaded.mockReturnValue(false);

    const result = getCurrentlyLoadedMemoryGB(
      { loadedTextModelId: 'model-1', loadedImageModelId: null },
      LISTS,
    );

    expect(result).toBe(0);
  });

  it('counts text model memory when only llmService is loaded', () => {
    mockedLlm.isModelLoaded.mockReturnValue(true);

    const result = getCurrentlyLoadedMemoryGB(
      { loadedTextModelId: 'model-1', loadedImageModelId: null },
      LISTS,
    );

    expect(result).toBeGreaterThan(0);
  });

  it('includes image model memory regardless of text model loaded state', () => {
    mockedLlm.isModelLoaded.mockReturnValue(false);

    const result = getCurrentlyLoadedMemoryGB(
      { loadedTextModelId: null, loadedImageModelId: 'img-1' },
      LISTS,
    );

    expect(result).toBeGreaterThan(2.9);
  });


});

describe('getOtherLoadedMemoryGB', () => {
  beforeEach(() => jest.clearAllMocks());


  it('returns 0 for image model loading when neither service is loaded', () => {
    mockedLlm.isModelLoaded.mockReturnValue(false);

    const result = getOtherLoadedMemoryGB(
      'image',
      { loadedTextModelId: 'model-1', loadedImageModelId: null },
      LISTS,
    );

    expect(result).toBe(0);
  });

  it('counts image model memory when loading a text model (no service check needed)', () => {
    mockedLlm.isModelLoaded.mockReturnValue(false);

    const result = getOtherLoadedMemoryGB(
      'text',
      { loadedTextModelId: null, loadedImageModelId: 'img-1' },
      LISTS,
    );

    // 2 GB * IMAGE_MODEL_OVERHEAD_MULTIPLIER
    expect(result).toBeGreaterThan(2.9);
  });
});


describe('dual-model admission with resident auxiliary engines', () => {
  it('rejects a combination that fits only when auxiliary memory is omitted', async () => {
    const result = await checkMemoryForDualModel({
      textModelId: null,
      imageModelId: 'small-image',
      lists: { downloadedModels: [], downloadedImageModels: [
        { id: 'small-image', name: 'Small image', size: 1024 ** 3 } as any,
      ] },
      auxiliaryMemoryGB: 4,
    });
    expect(result.canLoad).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.requiredMemoryGB).toBe(1.5);
    expect(result.currentlyLoadedMemoryGB).toBe(4);
    expect(result.totalRequiredMemoryGB).toBe(5.5);
    expect(result.availableMemoryGB).toBeCloseTo(0.8);
    expect(result.remainingAfterLoadGB).toBeCloseTo(-0.7);
  });
});
