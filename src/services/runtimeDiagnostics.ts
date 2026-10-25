import {useReplyTimingState} from './replyTiming';
import {NativeModules} from 'react-native';
import {useChatStore} from '../stores/chatStore';
export async function processMemorySnapshot():Promise<{currentBytes:number;peakBytes?:number}|null> {
 try {
  if(!NativeModules.OwnHardwareInfo?.memory) return null;
  const value=await NativeModules.OwnHardwareInfo.memory();
  if(!Number.isSafeInteger(value?.currentBytes) || value.currentBytes<=0) return null;
  const peak=Number.isSafeInteger(value.peakBytes) && value.peakBytes>=value.currentBytes ? value.peakBytes : undefined;
  return {currentBytes:value.currentBytes,peakBytes:peak};
 } catch {return null;}
}
/** Optional local diagnostics. Never delays completion or stores prompts/device IDs. */
export class RuntimeDiagnostics {
 private unsubscribe:(()=>void)|undefined;private timingUnsubscribe:(()=>void)|undefined;private epoch=0;
 start():void {
  if(this.unsubscribe) return;
  const epoch=this.epoch;
  this.unsubscribe=useChatStore.subscribe((next,previous)=>{
   if(next.conversations===previous.conversations || !previous.streamingForConversationId) return;
   const owner=previous.streamingForConversationId;
   const conversation=next.conversations.find(c=>c.id===owner);
   const message=conversation?.messages[conversation.messages.length-1];
   if(message?.role!=='assistant' || !message.generationMeta || message.interrupted) return;
   const old=previous.conversations.find(c=>c.id===owner);
   if(old?.messages.some(m=>m.id===message.id)) return;
   this.applyTiming(message.replyTraceId);
   processMemorySnapshot().then(snapshot=>{
    if(!snapshot || epoch!==this.epoch) return;
    useChatStore.getState().updateGenerationMeta(owner,message.id,{processMemoryBytes:snapshot.currentBytes,processPeakMemoryBytes:snapshot.peakBytes});
   }).catch(()=>{});
  });
  this.timingUnsubscribe=useReplyTimingState.subscribe(state=>{
    for(const record of state.records) if(record.firstVisibleAt!==undefined) this.applyTiming(record.id);
  });
 }
 private applyTiming(traceId:string|undefined):void {
  if(!traceId) return;
  const record=useReplyTimingState.getState().records.find(value=>value.id===traceId);
  if(record?.firstVisibleAt===undefined) return;
  const conversation=useChatStore.getState().conversations.find(value=>value.id===record.conversationId);
  const message=conversation?.messages.find(value=>value.replyTraceId===traceId && value.role==='assistant');
  if(!message?.generationMeta || message.generationMeta.sendToVisibleMs!==undefined) return;
  useChatStore.getState().updateGenerationMeta(record.conversationId,message.id,{sendToVisibleMs:record.firstVisibleAt-record.tappedAt,
    queueWaitMs:record.queueWaitMs,generationPreparationMs:Math.max(0,record.startedAt-record.tappedAt-record.queueWaitMs)});
 }
 stop():void {this.epoch+=1;this.unsubscribe?.();this.unsubscribe=undefined;this.timingUnsubscribe?.();this.timingUnsubscribe=undefined;}
}
export const runtimeDiagnostics=new RuntimeDiagnostics();
