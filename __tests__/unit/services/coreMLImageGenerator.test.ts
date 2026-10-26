export {};

/**
 * CoreMLImageGenerator Unit Tests - Native Core ML Bridge
 *
 * Tests that coreMLImageGenerator.ts correctly routes to the right native module
 * through CoreMLDiffusionModule on iOS.
 *
 * Priority: P0 (Critical) - If routing breaks, image generation silently fails.
 */

// react-native is mocked below; no direct imports needed

// ============================================================================
// Mock native modules
// ============================================================================

const mockCoreMLDiffusionModule = {
  loadModel: jest.fn(),
  unloadModel: jest.fn(),
  isModelLoaded: jest.fn(),
  getLoadedModelPath: jest.fn(),
  generateImage: jest.fn(),
  cancelGeneration: jest.fn(),
  isGenerating: jest.fn(),
  isNpuSupported: jest.fn(),
  getGeneratedImages: jest.fn(),
  deleteGeneratedImage: jest.fn(),
  getConstants: jest.fn(),
};

const mockAddListener = jest.fn().mockReturnValue({ remove: jest.fn() });
const mockRemoveAllListeners = jest.fn();

jest.mock('react-native', () => {
  const actualPlatform = { OS: 'ios', select: jest.fn() };
  return {
    NativeModules: {
      CoreMLDiffusionModule: mockCoreMLDiffusionModule,

    },
    NativeEventEmitter: jest.fn().mockImplementation(() => ({
      addListener: mockAddListener,
      removeAllListeners: mockRemoveAllListeners,
    })),
    Platform: actualPlatform,
  };
});

// ============================================================================
// Tests
// ============================================================================

describe('CoreMLImageGeneratorService', () => {
  // Since Platform.select is evaluated at module load time,
  // we need jest.isolateModules to test each platform path.

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================================================
  // Platform routing
  // ========================================================================
  describe('Platform routing', () => {


    it('routes to CoreMLDiffusionModule on iOS', () => {
      jest.isolateModules(() => {
        const { Platform: P } = require('react-native');
        P.select = (opts: any) => opts.ios;
        P.OS = 'ios';

        const { coreMLImageGeneratorService: svc } =
          require('../../../src/services/coreMLImageGenerator');

        expect(svc.isAvailable()).toBe(true);
      });
    });


  });

  // ========================================================================
  // ========================================================================
  describe('Core ML method delegation', () => {
    let service: any;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.isolateModules(() => {
        const { Platform: P } = require('react-native');
        P.select = (opts: any) => opts.ios;
        P.OS = 'ios';

        const mod = require('../../../src/services/coreMLImageGenerator');
        service = mod.coreMLImageGeneratorService;
      });
    });


    it('disposes a cancelled late load before starting the next native load', async () => {
      let finish!: (value: boolean) => void;
      const order: string[] = [];
      mockCoreMLDiffusionModule.loadModel.mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}))
        .mockImplementationOnce(async () => {order.push('new load'); return true;});
      mockCoreMLDiffusionModule.unloadModel.mockImplementationOnce(async () => {order.push('release old');return true;});
      const abort = new AbortController();
      const old = service.loadModel('/old',4,{signal:abort.signal}).catch((error: Error) => error);
      while (!finish) await Promise.resolve();
      abort.abort();
      const next = service.loadModel('/new',4);
      finish(true);
      expect((await old).message).toContain('cancelled');
      await next;
      expect(order).toEqual(['release old','new load']);
    });

    it('cancelling during preparation reclaims the late loaded pipeline', async () => {
      let finish!: (value: boolean) => void;
      mockCoreMLDiffusionModule.loadModel.mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}));
      mockCoreMLDiffusionModule.cancelGeneration.mockResolvedValue(true);
      mockCoreMLDiffusionModule.unloadModel.mockResolvedValue(true);
      const pending = service.loadModel('/cancelled',4).catch((error: Error) => error);
      while (!finish) await Promise.resolve();
      await service.cancelGeneration();
      finish(true);
      expect((await pending).message).toContain('cancelled');
      expect(mockCoreMLDiffusionModule.unloadModel).toHaveBeenCalledTimes(1);
    });
    it('loadModel delegates to native module', async () => {
      mockCoreMLDiffusionModule.loadModel.mockResolvedValue(true);

      const result = await service.loadModel('/path/to/model', 4);

      expect(mockCoreMLDiffusionModule.loadModel).toHaveBeenCalledWith({
        modelPath: '/path/to/model',
        threads: 4,
      });
      expect(result).toBe(true);
    });

    it('loadModel omits threads when not provided', async () => {
      mockCoreMLDiffusionModule.loadModel.mockResolvedValue(true);

      await service.loadModel('/path/to/model');

      const callArg = mockCoreMLDiffusionModule.loadModel.mock.calls[0][0];
      expect(callArg.modelPath).toBe('/path/to/model');
      expect(callArg).not.toHaveProperty('threads');
    });

    it('unloadModel delegates to native module', async () => {
      mockCoreMLDiffusionModule.unloadModel.mockResolvedValue(true);

      const result = await service.unloadModel();

      expect(mockCoreMLDiffusionModule.unloadModel).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('isModelLoaded delegates to native module', async () => {
      mockCoreMLDiffusionModule.isModelLoaded.mockResolvedValue(true);

      const result = await service.isModelLoaded();

      expect(mockCoreMLDiffusionModule.isModelLoaded).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('getLoadedModelPath delegates to native module', async () => {
      mockCoreMLDiffusionModule.getLoadedModelPath.mockResolvedValue('/loaded/path');

      const result = await service.getLoadedModelPath();

      expect(mockCoreMLDiffusionModule.getLoadedModelPath).toHaveBeenCalled();
      expect(result).toBe('/loaded/path');
    });

    it('cancelGeneration delegates to native module', async () => {
      mockCoreMLDiffusionModule.cancelGeneration.mockResolvedValue(true);

      const result = await service.cancelGeneration();

      expect(mockCoreMLDiffusionModule.cancelGeneration).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('getGeneratedImages delegates to native module', async () => {
      mockCoreMLDiffusionModule.getGeneratedImages.mockResolvedValue([
        { id: 'img-1', prompt: 'test', imagePath: '/img.png', width: 512, height: 512, steps: 20, seed: 1, modelId: 'm1', createdAt: '2026-01-01' },
      ]);

      const result = await service.getGeneratedImages();

      expect(mockCoreMLDiffusionModule.getGeneratedImages).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('img-1');
    });

    it('deleteGeneratedImage delegates to native module', async () => {
      mockCoreMLDiffusionModule.deleteGeneratedImage.mockResolvedValue(true);

      const result = await service.deleteGeneratedImage('img-1');

      expect(mockCoreMLDiffusionModule.deleteGeneratedImage).toHaveBeenCalledWith('img-1');
      expect(result).toBe(true);
    });

    it('getConstants delegates to native module', () => {
      const mockConstants = {
        DEFAULT_STEPS: 20,
        DEFAULT_GUIDANCE_SCALE: 7.5,
        DEFAULT_WIDTH: 512,
        DEFAULT_HEIGHT: 512,
        SUPPORTED_WIDTHS: [512],
        SUPPORTED_HEIGHTS: [512],
      };
      mockCoreMLDiffusionModule.getConstants.mockReturnValue(mockConstants);

      const result = service.getConstants();

      expect(mockCoreMLDiffusionModule.getConstants).toHaveBeenCalled();
      expect(result.DEFAULT_STEPS).toBe(20);
    });
  });

  // ========================================================================
  // Method delegation (iOS path)
  // ========================================================================
  describe('Method delegation (iOS)', () => {
    let service: any;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.isolateModules(() => {
        const { Platform: P } = require('react-native');
        P.select = (opts: any) => opts.ios;
        P.OS = 'ios';

        const mod = require('../../../src/services/coreMLImageGenerator');
        service = mod.coreMLImageGeneratorService;
      });
    });

    it('loadModel delegates to CoreMLDiffusionModule', async () => {
      mockCoreMLDiffusionModule.loadModel.mockResolvedValue(true);

      const result = await service.loadModel('/path/to/coreml-model', 4);

      expect(mockCoreMLDiffusionModule.loadModel).toHaveBeenCalledWith({
        modelPath: '/path/to/coreml-model',
        threads: 4,
      });
      expect(result).toBe(true);
    });

    it('unloadModel delegates to CoreMLDiffusionModule', async () => {
      mockCoreMLDiffusionModule.unloadModel.mockResolvedValue(true);

      await service.unloadModel();

      expect(mockCoreMLDiffusionModule.unloadModel).toHaveBeenCalled();
    });

    it('isModelLoaded delegates to CoreMLDiffusionModule', async () => {
      mockCoreMLDiffusionModule.isModelLoaded.mockResolvedValue(false);

      const result = await service.isModelLoaded();

      expect(mockCoreMLDiffusionModule.isModelLoaded).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('cancelGeneration delegates to CoreMLDiffusionModule', async () => {
      mockCoreMLDiffusionModule.cancelGeneration.mockResolvedValue(true);

      await service.cancelGeneration();

      expect(mockCoreMLDiffusionModule.cancelGeneration).toHaveBeenCalled();
    });

    it('getGeneratedImages delegates to CoreMLDiffusionModule', async () => {
      mockCoreMLDiffusionModule.getGeneratedImages.mockResolvedValue([]);

      const result = await service.getGeneratedImages();

      expect(mockCoreMLDiffusionModule.getGeneratedImages).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('deleteGeneratedImage delegates to CoreMLDiffusionModule', async () => {
      mockCoreMLDiffusionModule.deleteGeneratedImage.mockResolvedValue(true);

      await service.deleteGeneratedImage('img-1');

      expect(mockCoreMLDiffusionModule.deleteGeneratedImage).toHaveBeenCalledWith('img-1');
    });
  });

  // ========================================================================
  // isAvailable edge cases
  // ========================================================================
  describe('isAvailable', () => {
    it('returns false when module is unavailable', () => {
      jest.isolateModules(() => {
        const rn = require('react-native');
        rn.NativeModules.CoreMLDiffusionModule = null;
        rn.NativeModules.CoreMLDiffusionModule = null;
        const { Platform: P } = rn;
        P.select = (opts: any) => opts.default;
        P.OS = 'ios';

        const { coreMLImageGeneratorService: svc } =
          require('../../../src/services/coreMLImageGenerator');

        expect(svc.isAvailable()).toBe(false);
      });
    });

    it('isModelLoaded returns false when not available', async () => {
      let svc: any;
      jest.isolateModules(() => {
        const rn = require('react-native');
        rn.NativeModules.CoreMLDiffusionModule = null;
        rn.NativeModules.CoreMLDiffusionModule = null;
        const { Platform: P } = rn;
        P.select = (opts: any) => opts.default;

        svc = require('../../../src/services/coreMLImageGenerator').coreMLImageGeneratorService;
      });

      await expect(svc.isModelLoaded()).resolves.toBe(false);
    });

    it('getLoadedModelPath returns null when not available', async () => {
      let svc: any;
      jest.isolateModules(() => {
        const rn = require('react-native');
        rn.NativeModules.CoreMLDiffusionModule = null;
        rn.NativeModules.CoreMLDiffusionModule = null;
        const { Platform: P } = rn;
        P.select = (opts: any) => opts.default;

        svc = require('../../../src/services/coreMLImageGenerator').coreMLImageGeneratorService;
      });

      await expect(svc.getLoadedModelPath()).resolves.toBeNull();
    });

    it('loadModel throws when not available', async () => {
      let svc: any;
      jest.isolateModules(() => {
        const rn = require('react-native');
        rn.NativeModules.CoreMLDiffusionModule = null;
        rn.NativeModules.CoreMLDiffusionModule = null;
        const { Platform: P } = rn;
        P.select = (opts: any) => opts.default;

        svc = require('../../../src/services/coreMLImageGenerator').coreMLImageGeneratorService;
      });

      await expect(svc.loadModel('/path')).rejects.toThrow('not available');
    });

    it('generateImage throws when not available', async () => {
      let svc: any;
      jest.isolateModules(() => {
        const rn = require('react-native');
        rn.NativeModules.CoreMLDiffusionModule = null;
        rn.NativeModules.CoreMLDiffusionModule = null;
        const { Platform: P } = rn;
        P.select = (opts: any) => opts.default;

        svc = require('../../../src/services/coreMLImageGenerator').coreMLImageGeneratorService;
      });

      await expect(svc.generateImage({ prompt: 'test' })).rejects.toThrow('not available');
    });

    it('getGeneratedImages returns empty array when not available', async () => {
      let svc: any;
      jest.isolateModules(() => {
        const rn = require('react-native');
        rn.NativeModules.CoreMLDiffusionModule = null;
        rn.NativeModules.CoreMLDiffusionModule = null;
        const { Platform: P } = rn;
        P.select = (opts: any) => opts.default;

        svc = require('../../../src/services/coreMLImageGenerator').coreMLImageGeneratorService;
      });

      await expect(svc.getGeneratedImages()).resolves.toEqual([]);
    });

    it('deleteGeneratedImage returns false when not available', async () => {
      let svc: any;
      jest.isolateModules(() => {
        const rn = require('react-native');
        rn.NativeModules.CoreMLDiffusionModule = null;
        rn.NativeModules.CoreMLDiffusionModule = null;
        const { Platform: P } = rn;
        P.select = (opts: any) => opts.default;

        svc = require('../../../src/services/coreMLImageGenerator').coreMLImageGeneratorService;
      });

      await expect(svc.deleteGeneratedImage('img-1')).resolves.toBe(false);
    });

    it('unloadModel returns true when not available (no-op)', async () => {
      let svc: any;
      jest.isolateModules(() => {
        const rn = require('react-native');
        rn.NativeModules.CoreMLDiffusionModule = null;
        rn.NativeModules.CoreMLDiffusionModule = null;
        const { Platform: P } = rn;
        P.select = (opts: any) => opts.default;

        svc = require('../../../src/services/coreMLImageGenerator').coreMLImageGeneratorService;
      });

      await expect(svc.unloadModel()).resolves.toBe(true);
    });

    it('cancelGeneration returns true when not available (no-op)', async () => {
      let svc: any;
      jest.isolateModules(() => {
        const rn = require('react-native');
        rn.NativeModules.CoreMLDiffusionModule = null;
        rn.NativeModules.CoreMLDiffusionModule = null;
        const { Platform: P } = rn;
        P.select = (opts: any) => opts.default;

        svc = require('../../../src/services/coreMLImageGenerator').coreMLImageGeneratorService;
      });

      await expect(svc.cancelGeneration()).resolves.toBe(true);
    });

    it('getConstants returns defaults when not available', () => {
      jest.isolateModules(() => {
        const rn = require('react-native');
        rn.NativeModules.CoreMLDiffusionModule = null;
        rn.NativeModules.CoreMLDiffusionModule = null;
        const { Platform: P } = rn;
        P.select = (opts: any) => opts.default;

        const { coreMLImageGeneratorService: svc } =
          require('../../../src/services/coreMLImageGenerator');

        const constants = svc.getConstants();
        expect(constants.DEFAULT_STEPS).toBe(20);
        expect(constants.DEFAULT_GUIDANCE_SCALE).toBe(7.5);
        expect(constants.DEFAULT_WIDTH).toBe(512);
        expect(constants.DEFAULT_HEIGHT).toBe(512);
        expect(Array.isArray(constants.SUPPORTED_WIDTHS)).toBe(true);
        expect(Array.isArray(constants.SUPPORTED_HEIGHTS)).toBe(true);
      });
    });
  });

  // ========================================================================
  // generateImage lifecycle
  // ========================================================================
  describe('generateImage lifecycle', () => {
    let service: any;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.isolateModules(() => {
        const { Platform: P } = require('react-native');
        P.select = (opts: any) => opts.ios;
        P.OS = 'ios';

        service = require('../../../src/services/coreMLImageGenerator').coreMLImageGeneratorService;
      });
    });

    it('calls native generateImage with correct params', async () => {
      mockCoreMLDiffusionModule.generateImage.mockResolvedValue({
        id: 'img-1',
        imagePath: '/gen/img.png',
        width: 512,
        height: 512,
        seed: 42,
      });

      await service.generateImage({
        prompt: 'A cat',
        negativePrompt: 'blurry',
        steps: 25,
        guidanceScale: 8.0,
        seed: 42,
        width: 512,
        height: 512,
      });

      expect(mockCoreMLDiffusionModule.generateImage).toHaveBeenCalledWith({
        prompt: 'A cat',
        negativePrompt: 'blurry',
        steps: 25,
        guidanceScale: 8.0,
        seed: 42,
        width: 512,
        height: 512,
        previewInterval: 0,
        requestId: expect.any(String),
      });
    });

    it('passes valid zero guidance to the native generator', async () => {
      mockCoreMLDiffusionModule.generateImage.mockResolvedValue({id:'zero',imagePath:'/zero.png',width:512,height:512,seed:0});
      await service.generateImage({prompt:'puppy',guidanceScale:0,seed:0});
      expect(mockCoreMLDiffusionModule.generateImage).toHaveBeenCalledWith(expect.objectContaining({guidanceScale:0,seed:0}));
    });

    it('returns a GeneratedImage with correct shape', async () => {
      mockCoreMLDiffusionModule.generateImage.mockResolvedValue({
        id: 'img-result',
        imagePath: '/gen/result.png',
        width: 512,
        height: 512,
        seed: 99,
      });

      const result = await service.generateImage({ prompt: 'sunset' });

      expect(result).toHaveProperty('id', 'img-result');
      expect(result).toHaveProperty('prompt', 'sunset');
      expect(result).toHaveProperty('imagePath', '/gen/result.png');
      expect(result).toHaveProperty('width', 512);
      expect(result).toHaveProperty('height', 512);
      expect(result).toHaveProperty('seed', 99);
      expect(result).toHaveProperty('createdAt');
    });

    it('subscribes to OwnImageProgress events during generation', async () => {
      mockCoreMLDiffusionModule.generateImage.mockResolvedValue({
        id: 'img-1', imagePath: '/p.png', width: 512, height: 512, seed: 1,
      });

      const onProgress = jest.fn();
      await service.generateImage({ prompt: 'test' }, onProgress);

      expect(mockAddListener).toHaveBeenCalledWith(
        'OwnImageProgress',
        expect.any(Function),
      );
    });

    it('removes progress listener after generation completes', async () => {
      const mockRemove = jest.fn();
      mockAddListener.mockReturnValue({ remove: mockRemove });
      mockCoreMLDiffusionModule.generateImage.mockResolvedValue({
        id: 'img-1', imagePath: '/p.png', width: 512, height: 512, seed: 1,
      });

      await service.generateImage({ prompt: 'test' });

      expect(mockRemove).toHaveBeenCalled();
    });

    it('removes progress listener after generation fails', async () => {
      const mockRemove = jest.fn();
      mockAddListener.mockReturnValue({ remove: mockRemove });
      mockCoreMLDiffusionModule.generateImage.mockRejectedValue(new Error('OOM'));

      await service.generateImage({ prompt: 'test' }).catch(() => {});

      expect(mockRemove).toHaveBeenCalled();
    });

    it('rejects when generation already in progress', async () => {
      // Start a generation that doesn't resolve immediately
      let resolveGen: any;
      mockCoreMLDiffusionModule.generateImage.mockImplementation(
        () => new Promise(resolve => { resolveGen = resolve; }),
      );

      const first = service.generateImage({ prompt: 'first' });

      await expect(
        service.generateImage({ prompt: 'second' }),
      ).rejects.toThrow('already in progress');

      // Clean up
      resolveGen({ id: 'x', imagePath: '/x.png', width: 512, height: 512, seed: 1 });
      await first;
    });

    it('rejects with error on native failure', async () => {
      mockCoreMLDiffusionModule.generateImage.mockRejectedValue(new Error('Core ML failed'));

      await expect(service.generateImage({ prompt: 'test' }))
        .rejects.toThrow('Core ML failed');
    });

    it('resolves with GeneratedImage on success', async () => {
      mockCoreMLDiffusionModule.generateImage.mockResolvedValue({
        id: 'img-ok', imagePath: '/ok.png', width: 512, height: 512, seed: 7,
      });

      const result = await service.generateImage({ prompt: 'test' });

      expect(result).toEqual(expect.objectContaining({ id: 'img-ok' }));
    });

    it('forwards progress events from emitter', async () => {
      let progressHandler: any;
      mockAddListener.mockImplementation((event: string, handler: any) => {
        if (event === 'OwnImageProgress') {
          progressHandler = handler;
        }
        return { remove: jest.fn() };
      });

      mockCoreMLDiffusionModule.generateImage.mockImplementation(async (params: any) => {
        // Simulate progress event mid-generation
        progressHandler?.({ requestId: params.requestId, step: 5, totalSteps: 20, progress: 0.25 });
        return { id: 'img', imagePath: '/p.png', width: 512, height: 512, seed: 1 };
      });

      const onProgress = jest.fn();
      await service.generateImage({ prompt: 'test' }, onProgress);

      expect(onProgress).toHaveBeenCalledWith({
        step: 5,
        totalSteps: 20,
        progress: 0.25,
      });
    });

    it('forwards preview events from emitter', async () => {
      let progressHandler: any;
      mockAddListener.mockImplementation((event: string, handler: any) => {
        if (event === 'OwnImageProgress') {
          progressHandler = handler;
        }
        return { remove: jest.fn() };
      });

      mockCoreMLDiffusionModule.generateImage.mockImplementation(async (params: any) => {
        progressHandler?.({
          requestId: params.requestId,
          step: 10,
          totalSteps: 20,
          progress: 0.5,
          previewPath: '/preview/step_10.png',
        });
        return { id: 'img', imagePath: '/p.png', width: 512, height: 512, seed: 1 };
      });

      const onPreview = jest.fn();
      await service.generateImage({ prompt: 'test', previewInterval: 5 }, undefined, onPreview);

      expect(onPreview).toHaveBeenCalledWith({
        previewPath: '/preview/step_10.png',
        step: 10,
        totalSteps: 20,
      });
    });
  });

  // ========================================================================
  // Thread tracking
  // ========================================================================
  describe('thread tracking', () => {
    let service: any;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.isolateModules(() => {
        const { Platform: P } = require('react-native');
        P.select = (opts: any) => opts.ios;
        P.OS = 'ios';

        service = require('../../../src/services/coreMLImageGenerator').coreMLImageGeneratorService;
      });
    });

    it('tracks loaded threads after loadModel', async () => {
      mockCoreMLDiffusionModule.loadModel.mockResolvedValue(true);

      expect(service.getLoadedThreads()).toBeNull();

      await service.loadModel('/path', 6);

      expect(service.getLoadedThreads()).toBe(6);
    });

    it('clears threads after unloadModel', async () => {
      mockCoreMLDiffusionModule.loadModel.mockResolvedValue(true);
      mockCoreMLDiffusionModule.unloadModel.mockResolvedValue(true);

      await service.loadModel('/path', 4);
      expect(service.getLoadedThreads()).toBe(4);

      await service.unloadModel();
      expect(service.getLoadedThreads()).toBeNull();
    });
  });

  // ========================================================================
  // Error handling
  // ========================================================================
  describe('error handling', () => {
    let service: any;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.isolateModules(() => {
        const { Platform: P } = require('react-native');
        P.select = (opts: any) => opts.ios;
        P.OS = 'ios';

        service = require('../../../src/services/coreMLImageGenerator').coreMLImageGeneratorService;
      });
    });

    it('isModelLoaded returns false on native error', async () => {
      mockCoreMLDiffusionModule.isModelLoaded.mockRejectedValue(new Error('native crash'));

      const result = await service.isModelLoaded();

      expect(result).toBe(false);
    });

    it('getLoadedModelPath returns null on native error', async () => {
      mockCoreMLDiffusionModule.getLoadedModelPath.mockRejectedValue(new Error('native crash'));

      const result = await service.getLoadedModelPath();

      expect(result).toBeNull();
    });

    it('getGeneratedImages returns empty array on native error', async () => {
      mockCoreMLDiffusionModule.getGeneratedImages.mockRejectedValue(new Error('native crash'));

      const result = await service.getGeneratedImages();

      expect(result).toEqual([]);
    });
  });

  describe('loadModel — cpuOnly and attentionVariant opts', () => {
    let service: any;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.isolateModules(() => {
        const { Platform: P } = require('react-native');
        P.select = (opts: any) => opts.ios;
        P.OS = 'ios';
        service = require('../../../src/services/coreMLImageGenerator').coreMLImageGeneratorService;
      });
    });

    it('passes cpuOnly param when opts.cpuOnly is true', async () => {
      mockCoreMLDiffusionModule.loadModel.mockResolvedValue(true);
      await service.loadModel('/path/model', 4, { cpuOnly: true });
      expect(mockCoreMLDiffusionModule.loadModel).toHaveBeenCalledWith(
        expect.objectContaining({ cpuOnly: true }),
      );
    });

    it('passes attentionVariant param when provided', async () => {
      mockCoreMLDiffusionModule.loadModel.mockResolvedValue(true);
      await service.loadModel('/path/model', 4, { attentionVariant: 'split_einsum' });
      expect(mockCoreMLDiffusionModule.loadModel).toHaveBeenCalledWith(
        expect.objectContaining({ attentionVariant: 'split_einsum' }),
      );
    });
  });

  describe('isGenerating method', () => {
    let service: any;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.isolateModules(() => {
        const { Platform: P } = require('react-native');
        P.select = (opts: any) => opts.ios;
        P.OS = 'ios';
        service = require('../../../src/services/coreMLImageGenerator').coreMLImageGeneratorService;
      });
    });

    it('returns false when not generating', async () => {
      const result = await service.isGenerating();
      expect(result).toBe(false);
    });
  });


});
