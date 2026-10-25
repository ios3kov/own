import { initLlama } from 'llama.rn';
import { initWhisper } from 'whisper.rn';
import RNFS from 'react-native-fs';
import { llmService } from '../../../src/services/llm';
import { whisperService } from '../../../src/services/whisperService';
import { embeddingService } from '../../../src/services/rag/embedding';
import { residentAuxiliaryMemory } from '../../../src/services/residentAuxiliaryMemory';
import { createMockLlamaContext, resetStores } from '../../utils/testHelpers';

beforeEach(async()=>{
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
