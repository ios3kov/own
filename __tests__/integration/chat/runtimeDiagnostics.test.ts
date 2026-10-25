import {NativeModules} from 'react-native';
import {RuntimeDiagnostics} from '../../../src/services/runtimeDiagnostics';
import {useChatStore} from '../../../src/stores/chatStore';
import {resetStores} from '../../utils/testHelpers';
const tick=async()=>{for(let i=0;i<12;i++) await Promise.resolve();};
let diagnostics:RuntimeDiagnostics;
beforeEach(()=>{resetStores();diagnostics=new RuntimeDiagnostics();NativeModules.OwnHardwareInfo={memory:jest.fn().mockResolvedValue({currentBytes:100,peakBytes:200})};diagnostics.start();});
afterEach(()=>diagnostics.stop());
function finish(){const store=useChatStore.getState();const id=store.createConversation('model');store.addMessage(id,{role:'user',content:'Question'});store.startStreaming(id);store.setStreamingMessage('Answer');store.finalizeStreamingMessage(id,100,{gpu:false,modelName:'Original model'});return id;}
it('adds a kernel memory snapshot to the completed message, without changing its content or chat activity time',async()=>{
 const id=finish();const before=useChatStore.getState().conversations.find(c=>c.id===id)!;await tick();
 const after=useChatStore.getState().conversations.find(c=>c.id===id)!;
 expect(after.updatedAt).toBe(before.updatedAt);expect(after.messages[1].content).toBe('Answer');
 expect(after.messages[1].generationMeta).toEqual(expect.objectContaining({modelName:'Original model',processMemoryBytes:100,processPeakMemoryBytes:200}));
 expect(NativeModules.OwnHardwareInfo.memory).toHaveBeenCalledTimes(1);
});
it('does not recreate a deleted chat or apply a late result after its observer stops',async()=>{
 let resolve!:(value:any)=>void;NativeModules.OwnHardwareInfo.memory.mockImplementation(()=>new Promise(done=>{resolve=done;}));
 const id=finish();useChatStore.getState().deleteConversation(id);resolve({currentBytes:100,peakBytes:200});await tick();expect(useChatStore.getState().conversations.some(c=>c.id===id)).toBe(false);
 const next=finish();diagnostics.stop();resolve({currentBytes:100,peakBytes:200});await tick();expect(useChatStore.getState().conversations.find(c=>c.id===next)!.messages[1].generationMeta?.processMemoryBytes).toBeUndefined();
});

it('persists send-to-visible timing after the final reply appears, and never labels offscreen text visible',async()=>{
 const timing=require('../../../src/services/replyTiming');timing.clearReplyTimings();let now=100;jest.spyOn(performance,'now').mockImplementation(()=>now);
 const {AppState}=require('react-native');AppState.currentState='active';
 const store=useChatStore.getState();const id=store.createConversation('model');const user=store.addMessage(id,{role:'user',content:'Question'});
 timing.registerReplySend(user.id,100,20);now=200;require('../../../src/services/contextUsage').beginContextUsage(id);
 store.startStreaming(id);store.setStreamingMessage('Answer');store.finalizeStreamingMessage(id,100,{gpu:false});
 const trace=timing.activeReplyTiming(id);expect(useChatStore.getState().conversations.find(c=>c.id===id)!.messages[1].replyTraceId).toBe(trace.id);
 timing.focusReplyConversation(id);timing.setReplyViewport(id,{top:100,bottom:400});timing.markReplyVisibility(trace.id,true);timing.recordReplyTextBounds(trace.id,{top:500,bottom:600});await tick();
 expect(useChatStore.getState().conversations.find(c=>c.id===id)!.messages[1].generationMeta?.sendToVisibleMs).toBeUndefined();
 now=450;timing.recordReplyTextBounds(trace.id,{top:150,bottom:200});await tick();
 expect(useChatStore.getState().conversations.find(c=>c.id===id)!.messages[1].generationMeta).toEqual(expect.objectContaining({sendToVisibleMs:350,queueWaitMs:20,generationPreparationMs:80}));
 timing.clearReplyTimings();jest.restoreAllMocks();
});
