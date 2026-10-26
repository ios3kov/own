import { NativeModules } from 'react-native';
import { initLlama } from 'llama.rn';
import RNFS from 'react-native-fs';
import { llmService } from '../../../src/services/llm';
import { useAppStore } from '../../../src/stores/appStore';
import { createMockLlamaContext, resetStores } from '../../utils/testHelpers';
beforeEach(async () => {
  await llmService.unloadModel(); resetStores();
  (RNFS.exists as jest.Mock).mockResolvedValue(true);
  (RNFS.stat as jest.Mock).mockResolvedValue({size:1e9,isFile:()=>true});
  (initLlama as jest.Mock).mockReset().mockResolvedValue(createMockLlamaContext());
  NativeModules.OwnHardwareInfo = {status:jest.fn().mockResolvedValue({activeProcessors:8,thermalState:'serious',lowPowerMode:false})};
});
afterEach(async () => {await llmService.unloadModel(); delete NativeModules.OwnHardwareInfo;});
it('uses live local facts for Auto and preserves an explicit thread setting', async () => {
  useAppStore.setState({settings:{...useAppStore.getState().settings,nThreads:0}});
  await llmService.loadModel('/auto.gguf');
  expect((initLlama as jest.Mock).mock.calls[0][0].n_threads).toBe(3);
  await llmService.unloadModel();
  useAppStore.setState({settings:{...useAppStore.getState().settings,nThreads:7,nBatch:512,nUbatch:32}});
  await llmService.loadModel('/explicit.gguf');
  expect((initLlama as jest.Mock).mock.calls[1][0]).toEqual(expect.objectContaining({n_threads:7,n_batch:512,n_ubatch:32}));
});
