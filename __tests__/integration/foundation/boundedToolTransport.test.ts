import {NativeModules,Platform} from 'react-native';
import {useAppStore} from '../../../src/stores';
import {foundationModelService} from '../../../src/services/foundationModels';
import * as toolHandlers from '../../../src/services/tools/handlers';
const mockListeners=new Map<string,(event:any)=>Promise<void>>();
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter',()=>({__esModule:true,default:class {
 addListener(name:string,listener:any){mockListeners.set(name,listener);return {remove:()=>mockListeners.delete(name)};}
}}));
afterEach(()=>jest.restoreAllMocks());
it('sends valid bounded JSON for a long escaped tool result through the Apple bridge',async()=>{
 Platform.OS='ios';useAppStore.getState().updateSettings({enabledTools:['calculator']});
 const content='🦊"\\line\n'.repeat(6000);
 jest.spyOn(toolHandlers,'executeToolCall').mockResolvedValue({name:'calculator',content,durationMs:1});
 const native:any={availability:jest.fn().mockResolvedValue({available:true,reason:'available'}),cancel:jest.fn(),resolveTool:jest.fn()};
 native.generate=jest.fn(async(params:any)=>{
  await mockListeners.get('OwnFoundationTool')?.({requestId:params.requestId,callId:'tool',name:'calculator',arguments:'{"expression":"2+3"}'});
  return {content:'Done'};
 });
 NativeModules.OwnFoundationModels=native;
 await foundationModelService.generate([{id:'u',role:'user',content:'Calculate',timestamp:0}],{onToken:jest.fn(),enabledToolIds:['calculator']});
 const payload=native.resolveTool.mock.calls[0][2];
 const result=JSON.parse(payload);
 expect(payload.length).toBeLessThanOrEqual(24000);
 expect(result.truncated).toBe(true);
 expect(content.startsWith(result.content)).toBe(true);
 expect(result.content).not.toMatch(/[\uD800-\uDBFF]$/);
 expect(mockListeners.size).toBe(0);
});
