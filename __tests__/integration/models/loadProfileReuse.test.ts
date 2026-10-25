import AsyncStorage from '@react-native-async-storage/async-storage';
import { initLlama } from 'llama.rn';
import RNFS from 'react-native-fs';
import { llmService } from '../../../src/services/llm';
import { hardwareService } from '../../../src/services/hardware';
import { useAppStore } from '../../../src/stores/appStore';
import { createMockLlamaContext, resetStores } from '../../utils/testHelpers';

beforeEach(async () => {
  await llmService.unloadModel(); await AsyncStorage.clear(); resetStores();
  (initLlama as jest.Mock).mockReset();
  (RNFS.exists as jest.Mock).mockResolvedValue(true);
  (RNFS.stat as jest.Mock).mockResolvedValue({size:1e9,mtime:'2026-10-25T00:00:00Z',isFile:()=>true});
  const info = await hardwareService.getDeviceInfo();
  jest.spyOn(hardwareService,'getDeviceInfo').mockResolvedValue({...info,totalMemory:8*1024**3});
  useAppStore.setState({settings:{...useAppStore.getState().settings,contextLength:4096,inferenceBackend:'metal'}});
});
afterEach(async () => {await llmService.unloadModel();jest.restoreAllMocks();});
it('reuses a successful fallback and invalidates it when the file changes', async () => {
  const init = initLlama as jest.Mock;
  init.mockRejectedValueOnce(new Error('Metal unavailable'))
    .mockRejectedValueOnce(new Error('CPU allocation failed'))
    .mockResolvedValueOnce(createMockLlamaContext());
  await llmService.loadModel('/model.gguf');
  expect(init).toHaveBeenCalledTimes(3);
  expect((await llmService.getModelInfo())?.fallbackReason).toContain('memory');
  await llmService.unloadModel();
  init.mockClear(); init.mockResolvedValue(createMockLlamaContext());
  await llmService.loadModel('/model.gguf');
  expect(init).toHaveBeenCalledTimes(1);
  expect(init.mock.calls[0][0]).toEqual(expect.objectContaining({n_ctx:2048,n_gpu_layers:0}));
  await llmService.unloadModel(); init.mockClear();
  (RNFS.stat as jest.Mock).mockResolvedValue({size:1e9,mtime:'2026-10-25T01:00:00Z',isFile:()=>true});
  await llmService.loadModel('/model.gguf');
  expect(init.mock.calls[0][0].n_ctx).toBe(4096);
});
it('records actual launch parameters independently of later settings edits',async()=>{
 useAppStore.setState({settings:{...useAppStore.getState().settings,nThreads:3,nBatch:256,nUbatch:64}});
 (initLlama as jest.Mock).mockResolvedValue(createMockLlamaContext());await llmService.loadModel('/model.gguf');
 expect(llmService.getLaunchConfiguration()).toEqual(expect.objectContaining({contextLength:4096,threads:3,batch:256,microBatch:64,engineVersion:require('llama.rn/package.json').version}));
 useAppStore.setState({settings:{...useAppStore.getState().settings,nThreads:7}});expect(llmService.getLaunchConfiguration()?.threads).toBe(3);
 await llmService.unloadModel();expect(llmService.getLaunchConfiguration()).toBeUndefined();
});
