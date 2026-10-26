export {};
let mockResidency: ((resident: boolean, path: string | null) => void) | undefined;
const mockImage = {id:'drawing', modelPath:'/models/drawing', name:'Drawing', size:1024 ** 3};
const mockState = {
  activeModelId: null, activeImageModelId:'drawing', downloadedModels:[], downloadedImageModels:[mockImage],
  settings:{keepImagePipelineReady:true},
};
jest.mock('../../../src/stores', () => ({useAppStore:{getState:()=>mockState, subscribe:jest.fn()}}));
jest.mock('../../../src/services/llm', () => ({llmService:{isModelLoaded:()=>false}}));
jest.mock('../../../src/services/coreMLImageGenerator', () => ({coreMLImageGeneratorService:{
  subscribeResidency: (callback: typeof mockResidency) => {mockResidency=callback; return ()=>{};},
  releaseIdlePipeline: jest.fn().mockResolvedValue(undefined),
}}));
jest.mock('../../../src/services/hardware', () => ({hardwareService:{}}));
jest.mock('../../../src/services/residentAuxiliaryMemory', () => ({residentAuxiliaryMemory:jest.fn()}));
jest.mock('../../../src/services/activeModelService/loaders', () => ({doLoadTextModel:jest.fn(),doLoadImageModel:jest.fn()}));
jest.mock('../../../src/services/activeModelService/utils', () => ({getResourceUsage:jest.fn(),syncWithNativeState:jest.fn()}));

test('native residency updates actual loaded state and memory without changing selection or files', () => {
  let svc:any;
  jest.isolateModules(()=>{svc=require('../../../src/services/activeModelService').activeModelService;});
  const downloaded = mockState.downloadedImageModels;
  mockResidency!(true, '/models/drawing');
  expect(svc.getActiveModels().image.isLoaded).toBe(true);
  expect(svc.getLoadedModelIds().imageModelId).toBe('drawing');
  expect(svc.getCurrentlyLoadedMemoryGB()).toBeGreaterThan(0);
  mockResidency!(false, null);
  expect(svc.getActiveModels().image.isLoaded).toBe(false);
  expect(svc.getLoadedModelIds().imageModelId).toBeNull();
  expect(svc.getCurrentlyLoadedMemoryGB()).toBe(0);
  expect(mockState.activeImageModelId).toBe('drawing');
  expect(mockState.downloadedImageModels).toBe(downloaded);
  expect(downloaded).toEqual([mockImage]);
});
