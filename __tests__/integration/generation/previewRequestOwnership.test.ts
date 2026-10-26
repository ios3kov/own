import {NativeModules} from 'react-native';
const mockProgress=new Map<string,(event:any)=>void>();
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter',()=>({__esModule:true,default:class {
 addListener(name:string,handler:(event:any)=>void){mockProgress.set(name,handler);return{remove:()=>mockProgress.delete(name)};}
}}));

it('keeps native drafts opt-in and rejects stale or remote preview paths across requests',async()=>{
 jest.spyOn(Date,'now').mockReturnValue(1000);
 let oldId='';
 const native={generateImage:jest.fn(async(params:any)=>{
  mockProgress.get('OwnImageProgress')?.({requestId:oldId || 'stale',step:2,totalSteps:20,progress:0.1,previewPath:'/old.png'});
  mockProgress.get('OwnImageProgress')?.({requestId:params.requestId,step:5,totalSteps:20,progress:0.25,previewPath:'https://example.com/private.png'});
  mockProgress.get('OwnImageProgress')?.({requestId:params.requestId,step:5,totalSteps:20,progress:0.25,previewPath:'/private/draft.png'});
  oldId=params.requestId;
  return{id:'image',imagePath:'/final.png',width:512,height:512,seed:1};
 }),addListener:jest.fn(),removeListeners:jest.fn()};
 NativeModules.CoreMLDiffusionModule=native;
 const {coreMLImageGeneratorService:service}=require('../../../src/services/coreMLImageGenerator');
 const preview=jest.fn();const progress=jest.fn();
 await service.generateImage({prompt:'puppy'},progress,preview);
 expect(native.generateImage.mock.calls[0][0].previewInterval).toBe(0);
 expect(preview).not.toHaveBeenCalled();
 expect(progress).toHaveBeenCalledTimes(2);
 const firstId=oldId;
 progress.mockClear();
 await service.generateImage({prompt:'puppy',previewInterval:5},progress,preview);
 expect(oldId).not.toBe(firstId);
 expect(preview).toHaveBeenCalledTimes(1);
 expect(preview).toHaveBeenCalledWith({previewPath:'/private/draft.png',step:5,totalSteps:20});
 expect(mockProgress.size).toBe(0);
 jest.restoreAllMocks();
});
