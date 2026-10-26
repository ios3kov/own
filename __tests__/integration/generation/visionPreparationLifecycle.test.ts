import RNFS from 'react-native-fs';
import {NativeModules} from 'react-native';
import {llmService} from '../../../src/services/llm';
import {createMockLlamaContext,resetStores} from '../../utils/testHelpers';

const original=[{id:'u',role:'user',content:'Describe',attachments:[{id:'i',type:'image',uri:'file:///original.jpg'}]}] as any;
const service=llmService as any;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
beforeEach(()=>{
 jest.clearAllMocks();resetStores();
 Object.assign(service,{context:createMockLlamaContext(),currentModelPath:'/model.gguf',pendingMmProjPath:'/vision.gguf',
 multimodalInitialized:true,isGenerating:false,activeCompletionPromise:null,visionReleasePromise:null,visionPreparationAbort:null});
 (RNFS.hash as jest.Mock).mockImplementation(async(path:string)=>path==='/model.gguf'?'a'.repeat(64):'b'.repeat(64));
 NativeModules.PDFExtractorModule={prepareVisionImages:jest.fn().mockResolvedValue(['file:///derived.png']),finishVisionPreparation:jest.fn().mockResolvedValue(true)};
});
it.each(['normal','tools'])('retains %s ownership through onComplete and deferred native lease cleanup',async mode=>{
 let release!:()=>void;
 const cleanup=new Promise<void>(resolve=>{release=resolve;});
 NativeModules.PDFExtractorModule.finishVisionPreparation.mockReturnValue(cleanup);
 let blocked:Promise<unknown>|undefined;
 const done=()=>{blocked=llmService.generateResponse([],undefined).catch(error=>error.message);};
 const pending=mode==='tools'?llmService.generateResponseWithTools(original,{tools:[],onComplete:done}):llmService.generateResponse(original,undefined,done);
 for(let i=0;i<30&&!NativeModules.PDFExtractorModule.finishVisionPreparation.mock.calls.length;i++)await tick();
 expect(NativeModules.PDFExtractorModule.finishVisionPreparation).toHaveBeenCalledTimes(1);
 expect(await blocked).toBe('Generation already in progress');
 const owner=service.visionPreparationAbort;
 await expect(llmService.generateResponse([])).rejects.toThrow('Generation already in progress');
 expect(service.isGenerating).toBe(true);expect(service.visionPreparationAbort).toBe(owner);
 release();await pending;
 expect(service.isGenerating).toBe(false);expect(service.activeCompletionPromise).toBeNull();
 expect(original[0].attachments[0].uri).toBe('file:///original.jpg');
});
it('reuses the same loaded context identity and invalidates after a same-path context replacement',async()=>{
 await llmService.generateResponse(original);
 const bridge=NativeModules.PDFExtractorModule;
 const first=JSON.parse(bridge.prepareVisionImages.mock.calls[0][1].identity);
 expect(first).toMatchObject({preprocessing:{maximumEdge:1024,orientation:'exif',sizing:'aspect-fit-no-upscale',format:'png',frame:0}});
 await llmService.generateResponse(original);
 expect(JSON.parse(bridge.prepareVisionImages.mock.calls[1][1].identity)).toEqual(first);
 service.context=createMockLlamaContext();
 await llmService.generateResponse(original);
 const next=JSON.parse(bridge.prepareVisionImages.mock.calls[2][1].identity);
 expect(next.contextId).not.toBe(first.contextId);
 expect(RNFS.hash).not.toHaveBeenCalled();
});
it('invalidates identity when the actual projector changes, without reading model weights',async()=>{
 await llmService.generateResponse(original);
 const first=JSON.parse(NativeModules.PDFExtractorModule.prepareVisionImages.mock.calls[0][1].identity);
 await expect(llmService.initializeMultimodal('/different-projector.gguf')).resolves.toBe(true);
 await llmService.generateResponse(original);
 const next=JSON.parse(NativeModules.PDFExtractorModule.prepareVisionImages.mock.calls[1][1].identity);
 expect(next.projector).toEqual({path:'/different-projector.gguf',useGpu:false});
 expect(next.projectorRevision).not.toBe(first.projectorRevision);
 expect(next.contextId).toBe(first.contextId);
 expect(RNFS.hash).not.toHaveBeenCalled();
});
it('stop during native preparation discards its late result before engine completion',async()=>{
 let finish!:(paths:string[])=>void;
 NativeModules.PDFExtractorModule.prepareVisionImages.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const pending=llmService.generateResponse(original).catch(error=>error.message);
 for(let i=0;i<20&&!finish;i++)await tick();
 const stopped=llmService.stopGeneration();
 await expect(llmService.generateResponse(original)).rejects.toThrow('Generation already in progress');
 finish(['file:///derived.png']);
 expect(await pending).toMatch(/cancelled/);await stopped;
 expect(service.context.completion).not.toHaveBeenCalled();
 expect(service.activeCompletionPromise).toBeNull();
 expect(RNFS.hash).not.toHaveBeenCalled();
});

it('unloading aborts image preparation and waits before releasing the loaded text context',async()=>{
 let finish!:(paths:string[])=>void;
 const context=service.context;
 NativeModules.PDFExtractorModule.prepareVisionImages.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const pending=llmService.generateResponse(original).catch(error=>error.message);
 for(let i=0;i<20&&!finish;i++)await tick();
 const unloaded=llmService.unloadModel();
 await tick();
 expect(context.release).not.toHaveBeenCalled();
 expect(NativeModules.PDFExtractorModule.finishVisionPreparation).toHaveBeenCalled();
 finish(['file:///derived.png']);
 expect(await pending).toMatch(/cancelled/);
 await unloaded;
 expect(context.release).toHaveBeenCalledTimes(1);
 expect(context.completion).not.toHaveBeenCalled();
 expect(service.context).toBeNull();
});
