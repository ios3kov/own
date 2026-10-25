import { useModelLoadStore } from '../../../src/stores/modelLoadStore';
import { initLlama } from 'llama.rn';
import RNFS from 'react-native-fs';
import { llmService } from '../../../src/services/llm';
import { hardwareService } from '../../../src/services/hardware';
import { useAppStore } from '../../../src/stores/appStore';
import { createMockLlamaContext, resetStores } from '../../utils/testHelpers';

const init = initLlama as jest.Mock;
beforeEach(async () => {
  await llmService.unloadModel();
  resetStores();
  init.mockReset();
  (RNFS.exists as jest.Mock).mockResolvedValue(true);
});
afterEach(async () => { await llmService.unloadModel(); jest.restoreAllMocks(); });

it('keeps the successful fallback and reports its actual context', async () => {
  const info = await hardwareService.getDeviceInfo();
  jest.spyOn(hardwareService,'getDeviceInfo').mockResolvedValue({...info,totalMemory:8*1024**3});
  useAppStore.setState({settings:{...useAppStore.getState().settings,contextLength:4096,inferenceBackend:'metal'}});
  const context = createMockLlamaContext({model:{metadata:{'llama.context_length':'8192'}}});
  init.mockRejectedValueOnce(new Error('Metal unavailable'))
    .mockRejectedValueOnce(new Error('CPU allocation failed'))
    .mockResolvedValueOnce(context);
  await llmService.loadModel('/model.gguf');
  expect(init).toHaveBeenCalledTimes(3);
  expect(context.release).not.toHaveBeenCalled();
  expect((await llmService.getModelInfo())?.contextLength).toBe(2048);
  expect(llmService.isModelLoaded()).toBe(true);
  const timing=useModelLoadStore.getState();
  expect(timing.totalDurationMs).toBeGreaterThanOrEqual(0);
  expect(timing.phases.map(phase=>phase.phase)).toContain('Waiting for model resource');
});

it('reclaims late native weights after the calling operation times out', async () => {
  const controller = new AbortController();
  const context = createMockLlamaContext();
  init.mockImplementationOnce(async () => {controller.abort(); return context;});
  await expect(llmService.loadModel('/model.gguf',undefined,controller.signal)).rejects.toThrow('cancelled');
  expect(context.release).toHaveBeenCalledTimes(1);
  expect(llmService.isModelLoaded()).toBe(false);
  expect(llmService.getLoadedModelPath()).toBeNull();
});
