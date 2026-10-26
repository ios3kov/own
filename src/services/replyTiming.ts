import {AppState} from 'react-native';
import {create} from 'zustand';
import {generateId} from '../utils/generateId';
export type ReplyBounds={top:number;bottom:number};
export type ReplyTiming={id:string;conversationId:string;userMessageId:string;tappedAt:number;startedAt:number;queueWaitMs:number;visible:boolean;textBounds?:ReplyBounds;firstVisibleAt?:number};
export const useReplyTimingState=create<{records:ReplyTiming[];activeId:string|null}>(()=>({records:[],activeId:null}));
const sends=new Map<string,{tappedAt:number;queueWaitMs:number}>();
const viewports=new Map<string,ReplyBounds>();
const measurers=new Map<string,Set<()=>void>>();
const lastMeasured=new Map<string,number>();
let focusedConversation:string|null=null;
export const replyTimingNow=():number=>performance.now();
export function registerReplySend(userMessageId:string,tappedAt:number,queueWaitMs=0):void {
 if(!Number.isFinite(tappedAt) || tappedAt<0 || !Number.isFinite(queueWaitMs) || queueWaitMs<0) return;
 sends.set(userMessageId,{tappedAt,queueWaitMs});
 if(sends.size>128) sends.delete(sends.keys().next().value!);
}
export function beginReplyTiming(conversationId:string,userMessageId:string|undefined):void {
 const send=userMessageId ? sends.get(userMessageId) : undefined;
 if(userMessageId) sends.delete(userMessageId);
 if(!send || replyTimingNow()<send.tappedAt) {useReplyTimingState.setState({activeId:null});return;}
 const record:ReplyTiming={id:generateId(),conversationId,userMessageId:userMessageId!,...send,startedAt:replyTimingNow(),visible:false};
 useReplyTimingState.setState(state=>({activeId:record.id,records:[...state.records.slice(-31),record]}));
}
export function activeReplyTiming(conversationId:string|null):ReplyTiming|undefined {
 const state=useReplyTimingState.getState();return state.records.find(record=>record.id===state.activeId && record.conversationId===conversationId);
}
function publish(id:string,patch:Partial<ReplyTiming>):void {
 const record=useReplyTimingState.getState().records.find(value=>value.id===id);
 if(!record || record.firstVisibleAt!==undefined) return;
 const next={...record,...patch};const viewport=viewports.get(next.conversationId);const bounds=next.textBounds;
 if(next.visible && focusedConversation===next.conversationId && AppState.currentState==='active' && viewport && bounds && bounds.bottom>viewport.top && bounds.top<viewport.bottom) {
  const now=replyTimingNow();if(now>=next.tappedAt) next.firstVisibleAt=now;
 }
 useReplyTimingState.setState(state=>({records:state.records.map(value=>value.id===id ? next : value)}));
}
function validBounds(bounds:ReplyBounds):boolean {return Number.isFinite(bounds.top) && Number.isFinite(bounds.bottom) && bounds.bottom>bounds.top;}
export function recordReplyTextBounds(id:string,bounds:ReplyBounds):void {if(validBounds(bounds)) publish(id,{textBounds:bounds});}
export function markReplyVisibility(id:string,visible:boolean):void {
 publish(id,{visible,...(!visible ? {textBounds:undefined} : {})});
 if(visible) requestReplyMeasurement(id,true);
}
export function setReplyViewport(conversationId:string,bounds:ReplyBounds):void {
 if(!validBounds(bounds)) return;
 viewports.set(conversationId,bounds);
 if(viewports.size>16) viewports.delete(viewports.keys().next().value!);
 const record=activeReplyTiming(conversationId);if(record) requestReplyMeasurement(record.id,true);
}
export function focusReplyConversation(conversationId:string|null):void {
 focusedConversation=conversationId;
 const record=activeReplyTiming(conversationId);if(record) requestReplyMeasurement(record.id,true);
}
export function blurReplyConversation(conversationId:string|null):void {if(focusedConversation===conversationId) focusedConversation=null;}
export function registerReplyMeasurer(id:string,measure:()=>void):()=>void {
 const group=measurers.get(id) ?? new Set<()=>void>();group.add(measure);measurers.set(id,group);requestReplyMeasurement(id,true);
 return ()=>{group.delete(measure);if(!group.size) {measurers.delete(id);lastMeasured.delete(id);}};
}
export function requestReplyMeasurement(id:string|undefined,force=false):void {
 if(!id) return;
 const record=useReplyTimingState.getState().records.find(value=>value.id===id);
 if(!record || record.firstVisibleAt!==undefined || focusedConversation!==record.conversationId || AppState.currentState!=='active') return;
 const now=replyTimingNow();if(!force && now-(lastMeasured.get(id) ?? -Infinity)<100) return;
 lastMeasured.set(id,now);measurers.get(id)?.forEach(measure=>measure());
}
export function refreshVisibleReplyTiming():void {requestReplyMeasurement(useReplyTimingState.getState().activeId ?? undefined,true);}
export function clearReplyTimings():void {sends.clear();viewports.clear();measurers.clear();lastMeasured.clear();focusedConversation=null;useReplyTimingState.setState({records:[],activeId:null});}
