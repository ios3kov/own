import {installVisionPreparationTransportMock} from '../../utils/testHelpers';
import { initLlama } from 'llama.rn';
import { initWhisper } from 'whisper.rn';
import RNFS from 'react-native-fs';
import { llmService } from '../../../src/services/llm';
import { whisperService } from '../../../src/services/whisperService';
import { embeddingService } from '../../../src/services/rag/embedding';
import { activeModelService } from '../../../src/services/activeModelService';
import { useAppStore } from '../../../src/stores/appStore';
import { residentAuxiliaryMemory } from '../../../src/services/residentAuxiliaryMemory';
import { createMockLlamaContext, resetStores } from '../../utils/testHelpers';

beforeEach(async()=>{
  installVisionPreparationTransportMock();
  await llmService.unloadModel();await whisperService.unloadModel();await embeddingService.unload();resetStores();
  (RNFS.exists as jest.Mock).mockResolvedValue(true);(RNFS.stat as jest.Mock).mockResolvedValue({size:100_000_000,isFile:()=>true});
});
afterEach(async()=>{await llmService.unloadModel();await whisperService.unloadModel();await embeddingService.unload();});
it('counts only resident resources and adds vision after its first image request',async()=>{
  const text=createMockLlamaContext({initMultimodal:jest.fn().mockResolvedValue(true),getMultimodalSupport:jest.fn().mockResolvedValue({vision:true,audio:false})});
  (initLlama as jest.Mock).mockImplementation(async(params:any)=>params.embedding?createMockLlamaContext():text);
  (initWhisper as jest.Mock).mockResolvedValue({release:jest.fn().mockResolvedValue(undefined)});
  await llmService.loadModel('/text.gguf','/projector.gguf');await whisperService.loadModel('/speech.bin');await embeddingService.load();
  expect((await residentAuxiliaryMemory()).estimatedBytes).toBe(240_000_000);
  await llmService.generateResponse([{id:'u',role:'user',content:'Describe',timestamp:0,attachments:[{id:'p',type:'image',uri:'/photo.jpg'}]}]);
  expect((await residentAuxiliaryMemory()).estimatedBytes).toBe(360_000_000);
  await whisperService.unloadModel();await embeddingService.unload();await llmService.unloadModel();
  expect(await residentAuxiliaryMemory()).toEqual({estimatedBytes:0,complete:true});
});

it('includes loaded speech and embedding engines in dual-model admission', async()=>{
  (initLlama as jest.Mock).mockResolvedValue(createMockLlamaContext());
  (initWhisper as jest.Mock).mockResolvedValue({release:jest.fn().mockResolvedValue(undefined)});
  await whisperService.loadModel('/speech.bin');
  await embeddingService.load();
  useAppStore.setState({downloadedImageModels:[{id:'image',name:'Image',size:1024 ** 3} as any]});
  const loaded=await activeModelService.checkMemoryForDualModel(null,'image');
  expect(loaded.currentlyLoadedMemoryGB).toBeCloseTo(240_000_000 / 1024 ** 3);
  expect(loaded.totalRequiredMemoryGB).toBeCloseTo(1.5 + 240_000_000 / 1024 ** 3);
  await whisperService.unloadModel();await embeddingService.unload();
  const unloaded=await activeModelService.checkMemoryForDualModel(null,'image');
  expect(unloaded.currentlyLoadedMemoryGB).toBe(0);
  expect(unloaded.totalRequiredMemoryGB).toBe(1.5);
});
