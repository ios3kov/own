import {installVisionPreparationTransportMock} from '../../utils/testHelpers';
import { initLlama } from 'llama.rn';
import RNFS from 'react-native-fs';
import { llmService } from '../../../src/services/llm';
import { createMockLlamaContext, resetStores } from '../../utils/testHelpers';

const text = [{id:'q',role:'user' as const,content:'Hello',timestamp:0}];
const photo = [{...text[0],attachments:[{id:'photo',type:'image' as const,uri:'file:///photo.jpg'}]}];
beforeEach(async () => {
  installVisionPreparationTransportMock();
  await llmService.unloadModel(); resetStores();
  (initLlama as jest.Mock).mockReset();
  (RNFS.exists as jest.Mock).mockResolvedValue(true);
  (RNFS.stat as jest.Mock).mockResolvedValue({size:500*1024*1024,isFile:()=>true});
});
afterEach(async () => {await llmService.unloadModel();});

it('keeps text resident and initializes vision once, only when a user image arrives', async () => {
  const context = createMockLlamaContext({initMultimodal:jest.fn().mockResolvedValue(true),getMultimodalSupport:jest.fn().mockResolvedValue({vision:true,audio:false})});
  (initLlama as jest.Mock).mockResolvedValue(context);
  await llmService.loadModel('/text.gguf','/paired.gguf');
  expect(context.initMultimodal).not.toHaveBeenCalled();
  expect(llmService.supportsVision()).toBe(true);
  expect(llmService.getMultimodalSupport()).toBeNull();
  await llmService.generateResponse(text);
  expect(context.initMultimodal).not.toHaveBeenCalled();
  await llmService.generateResponse(photo);
  await llmService.generateResponseWithTools(photo,{tools:[]});
  expect(context.initMultimodal).toHaveBeenCalledTimes(1);
  expect(initLlama).toHaveBeenCalledTimes(1);
  expect(context.release).not.toHaveBeenCalled();
  expect(llmService.getMultimodalSupport()?.vision).toBe(true);
});

it('keeps text usable after vision initialization fails', async () => {
  const context = createMockLlamaContext({initMultimodal:jest.fn().mockResolvedValue(false)});
  (initLlama as jest.Mock).mockResolvedValue(context);
  await llmService.loadModel('/text.gguf','/paired.gguf');
  await expect(llmService.generateResponseWithTools(photo,{tools:[]})).rejects.toThrow('Text chat is still available');
  expect(context.completion).not.toHaveBeenCalled();
  await llmService.generateResponse([...photo,...text]);
  expect(context.initMultimodal).toHaveBeenCalledTimes(1);
  expect(context.completion).toHaveBeenCalledTimes(1);
  expect((context.completion as jest.Mock).mock.calls[0][0].messages[0].content).toContain('Earlier image attachment is unavailable');
  expect(context.release).not.toHaveBeenCalled();
});

it('does not initialize vision from assistant-generated image history', async () => {
  const context = createMockLlamaContext();
  (initLlama as jest.Mock).mockResolvedValue(context);
  await llmService.loadModel('/text.gguf','/paired.gguf');
  await llmService.generateResponse([{...photo[0],role:'assistant'},...text]);
  expect(context.initMultimodal).not.toHaveBeenCalled();
});

it('keeps older photo history usable after switching to a text-only model', async () => {
  const context = createMockLlamaContext();
  (initLlama as jest.Mock).mockResolvedValue(context);
  await llmService.loadModel('/text-only.gguf');
  await llmService.generateResponse([...photo,...text]);
  expect(context.completion).toHaveBeenCalledTimes(1);
  expect(context.initMultimodal).not.toHaveBeenCalled();
});

it('releases idle vision while retaining text, then prepares it again only for a new photo',async()=>{
 const context=createMockLlamaContext({initMultimodal:jest.fn().mockResolvedValue(true),getMultimodalSupport:jest.fn().mockResolvedValue({vision:true,audio:false}),releaseMultimodal:jest.fn().mockResolvedValue(undefined)});
 (initLlama as jest.Mock).mockResolvedValue(context);await llmService.loadModel('/text.gguf','/paired.gguf');await llmService.generateResponse(photo);
 expect(await llmService.releaseVisionIfIdle()).toBe(true);expect(context.release).not.toHaveBeenCalled();expect(llmService.supportsVision()).toBe(true);expect(llmService.getLoadedVisionPath()).toBeNull();
 await llmService.generateResponse(text);expect(context.initMultimodal).toHaveBeenCalledTimes(1);
 await llmService.generateResponse(photo);expect(context.initMultimodal).toHaveBeenCalledTimes(2);
});
it('does not start a waiting generation after Stop during idle vision release',async()=>{
 let finish!:()=>void;
 const context=createMockLlamaContext({initMultimodal:jest.fn().mockResolvedValue(true),getMultimodalSupport:jest.fn().mockResolvedValue({vision:true,audio:false}),releaseMultimodal:jest.fn(()=>new Promise<void>(resolve=>{finish=resolve;}))});
 (initLlama as jest.Mock).mockResolvedValue(context);await llmService.loadModel('/text.gguf','/paired.gguf');await llmService.generateResponse(photo);(context.completion as jest.Mock).mockClear();
 const releasing=llmService.releaseVisionIfIdle();while(!finish) await Promise.resolve();
 const generation=llmService.generateResponse(text).catch(error=>error);await llmService.stopGeneration();finish();await releasing;
 expect(await generation).toEqual(expect.objectContaining({message:'Generation cancelled.'}));expect(context.completion).not.toHaveBeenCalled();
});
