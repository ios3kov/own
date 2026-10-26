export {};
const mockCallbacks = new Map<string, (event: any) => void>();
const mockNative = {
  releaseIdlePipeline: jest.fn().mockResolvedValue(true),
  unloadModel: jest.fn().mockResolvedValue(true),
  isModelLoaded: jest.fn().mockResolvedValue(true),
  generateImage: jest.fn(),
};
const mockSettings = {keepImagePipelineReady: false};
jest.mock('react-native', () => ({
  NativeModules: {CoreMLDiffusionModule: mockNative},
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: (name: string, callback: (event: any) => void) => {
      mockCallbacks.set(name, callback); return {remove: jest.fn()};
    },
  })),
}));
jest.mock('../../../src/stores/appStore', () => ({useAppStore: {getState: () => ({settings: mockSettings})}}));
jest.mock('../../../src/stores/modelLoadStore', () => ({beginModelLoad: jest.fn(), reportModelLoad: jest.fn(), finishModelLoad: jest.fn()}));
jest.mock('../../../src/utils/logger', () => ({__esModule: true, default: {log: jest.fn()}}));

function service() {
  let result: any;
  jest.isolateModules(() => { result = require('../../../src/services/coreMLImageGenerator').coreMLImageGeneratorService; });
  return result;
}
beforeEach(() => { jest.clearAllMocks(); mockCallbacks.clear(); mockSettings.keepImagePipelineReady = false; });
test('residency notifications ignore stale revisions and preserve actual path', () => {
  const svc = service(); const listener = jest.fn(); svc.subscribeResidency(listener);
  const emit = mockCallbacks.get('OwnImageResidency')!;
  emit({revision: 2, resident: true, modelPath: '/model'});
  emit({revision: 1, resident: false, modelPath: null});
  expect(listener.mock.calls).toEqual([[true, '/model']]);
  emit({revision: 3, resident: false, modelPath: null});
  expect(listener).toHaveBeenLastCalledWith(false, null);
});
test('default-off and opt-in payloads reflect settings at each generation', async () => {
  const svc = service(); mockNative.generateImage.mockResolvedValue({id:'one', imagePath:'/one', width:512, height:512});
  await svc.generateImage({prompt:'a puppy'});
  expect(mockNative.generateImage.mock.calls[0][0].keepPipelineReady).toBe(false);
  mockSettings.keepImagePipelineReady = true;
  await svc.generateImage({prompt:'a puppy'});
  expect(mockNative.generateImage.mock.calls[1][0].keepPipelineReady).toBe(true);
});
test('RAM eviction reaches native while generation remains unresolved', async () => {
  const svc = service(); let finish!: (result: any) => void;
  mockNative.generateImage.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
  const generation = svc.generateImage({prompt:'a puppy'});
  await Promise.resolve();
  await svc.releaseIdlePipeline();
  expect(mockNative.releaseIdlePipeline).toHaveBeenCalledTimes(1);
  expect(mockNative.unloadModel).not.toHaveBeenCalled();
  finish({id:'one',imagePath:'/one',width:512,height:512}); await generation;
});
