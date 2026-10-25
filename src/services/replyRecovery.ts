import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState} from 'react-native';
import {useChatStore} from '../stores/chatStore';
import type {Conversation,Message} from '../types';
import {generateId} from '../utils/generateId';
import logger from '../utils/logger';

export const REPLY_CHECKPOINT_KEY='own-reply-checkpoint-v1';
const INTERVAL_MS=5000;
const MAX_CHARS=256_000;
type Checkpoint={version:1;id:string;conversationId:string;revision:string;anchorId:string;userId:string;content:string;reasoningContent:string;timestamp:number};

function parseCheckpoint(raw:string|null):Checkpoint|null {
  if (!raw || raw.length>MAX_CHARS*2) return null;
  let value:Checkpoint;
  try {value=JSON.parse(raw);} catch {return null;}
  if (value?.version!==1 || !value.id || typeof value.id!=='string' || typeof value.conversationId!=='string'
    || typeof value.userId!=='string' || typeof value.anchorId!=='string' || typeof value.revision!=='string'
    || typeof value.content!=='string' || typeof value.reasoningContent!=='string'
    || !Number.isSafeInteger(value.timestamp) || value.timestamp<0) return null;
  return value.content.length+value.reasoningContent.length<=MAX_CHARS ? value : null;
}
function isReplyAnchor(message:Message|undefined):boolean {
  return !!message && (message.role==='user' || message.role==='tool' || (message.role==='assistant' && !!message.toolCalls?.length));
}
function lastUserId(messages:Message[]):string|undefined {
  for(let index=messages.length-1;index>=0;index-=1) if(messages[index].role==='user') return messages[index].id;
  return undefined;
}
export function recoveredConversations(conversations:Conversation[], raw:string|null):Conversation[] {
  const checkpoint=parseCheckpoint(raw);
  if (!checkpoint) return conversations;
  const conversation=conversations.find(c=>c.id===checkpoint.conversationId);
  if (!conversation || conversation.updatedAt!==checkpoint.revision || conversation.messages.some(m=>m.id===checkpoint.id)) return conversations;
  const last=conversation.messages[conversation.messages.length-1];
  if (lastUserId(conversation.messages)!==checkpoint.userId || last?.id!==checkpoint.anchorId || !isReplyAnchor(last) || !(checkpoint.content.trim() || checkpoint.reasoningContent.trim())) return conversations;
  const message:Message={id:checkpoint.id,role:'assistant',content:checkpoint.content,reasoningContent:checkpoint.reasoningContent || undefined,timestamp:checkpoint.timestamp,interrupted:true};
  return conversations.map(c=>c===conversation ? {...c,messages:[...c.messages,message]} : c);
}

export class ReplyRecovery {
  private tail:Promise<void>=Promise.resolve();
  private startPromise:Promise<void>|null=null;
  private unsubscribe:(()=>void)|undefined;
  private appListener:{remove:()=>void}|undefined;
  private checkpoint:Checkpoint|null=null;
  private lastSaved=0;
  private activeOwner:string|null=null;
  private epoch=0;

  private write(work:()=>Promise<void>):void {
    this.tail=this.tail.then(work).catch(()=>{logger.warn('[Recovery] Reply checkpoint could not be saved.');});
  }
  async settled():Promise<void> {await this.tail;}
  start():Promise<void> {
    if (this.startPromise) return this.startPromise;
    const epoch=this.epoch;
    this.startPromise=this.initialize(epoch).catch(()=>{logger.warn('[Recovery] Reply recovery is unavailable.');if(epoch===this.epoch) this.startPromise=null;});
    return this.startPromise;
  }
  private async initialize(epoch:number):Promise<void> {
    if (!useChatStore.persist.hasHydrated()) await useChatStore.persist.rehydrate();
    if (!useChatStore.persist.hasHydrated()) throw new Error('Chat history is not ready.');
    const raw=await AsyncStorage.getItem(REPLY_CHECKPOINT_KEY);
    if (epoch!==this.epoch) return;
    const current=useChatStore.getState().conversations;
    const recovered=useChatStore.getState().streamingForConversationId ? current : recoveredConversations(current,raw);
    this.checkpoint=parseCheckpoint(raw);
    if (recovered!==current) {
      useChatStore.setState({conversations:recovered});
      // Persist is asynchronous. Keep the checkpoint until a later chat write;
      // its stable ID prevents duplicate recovery if the app closes immediately.
    } else if (raw) this.write(()=>AsyncStorage.removeItem(REPLY_CHECKPOINT_KEY));
    this.unsubscribe=useChatStore.subscribe(()=>this.capture(false));
    this.appListener=AppState.addEventListener('change',state=>{if(state!=='active') this.capture(true);});
  }
  private capture(force:boolean):void {
    const state=useChatStore.getState();
    const owner=state.streamingForConversationId;
    if (owner!==this.activeOwner) {this.activeOwner=owner;if(owner) this.checkpoint=null;}
    if (!owner) {
      this.clearCancelledOrDeletedCheckpoint(state.conversations);
      return;
    }
    const conversation=state.conversations.find(c=>c.id===owner);
    const last=conversation?.messages[conversation.messages.length-1];
    if (!conversation) {this.clearCancelledOrDeletedCheckpoint(state.conversations);return;}
    if (!isReplyAnchor(last)) return;
    const userId=lastUserId(conversation.messages);
    if (!userId || (this.checkpoint && this.checkpoint.userId!==userId)) return;
    if (!(state.streamingMessage || state.streamingReasoningContent)) return;
    if (state.streamingMessage.length+state.streamingReasoningContent.length>MAX_CHARS) return;
    if (this.checkpoint?.conversationId!==owner || this.checkpoint.anchorId!==last!.id) {
      this.checkpoint={version:1,id:generateId(),conversationId:owner,revision:conversation.updatedAt,anchorId:last!.id,userId,content:'',reasoningContent:'',timestamp:Date.now()};
      this.lastSaved=Number.NEGATIVE_INFINITY;
    }
    if (conversation.updatedAt!==this.checkpoint.revision) return;
    if (this.checkpoint.content===state.streamingMessage && this.checkpoint.reasoningContent===state.streamingReasoningContent) return;
    const now=Date.now();
    if (!force && now-this.lastSaved<INTERVAL_MS) return;
    const checkpoint={...this.checkpoint,content:state.streamingMessage,reasoningContent:state.streamingReasoningContent};
    this.checkpoint=checkpoint;this.lastSaved=now;
    this.write(()=>AsyncStorage.setItem(REPLY_CHECKPOINT_KEY,JSON.stringify(checkpoint)));
  }
  private clearCancelledOrDeletedCheckpoint(conversations:Conversation[]):void {
    if (!this.checkpoint) return;
    const conversation=conversations.find(c=>c.id===this.checkpoint!.conversationId);
    const last=conversation?.messages[conversation.messages.length-1];
    if (conversation && last?.id!==this.checkpoint.anchorId) return;
    this.checkpoint=null;
    this.write(()=>AsyncStorage.removeItem(REPLY_CHECKPOINT_KEY));
    // Completed replies keep a harmless stale checkpoint until the next launch:
    // a queued final-history write must never lose its recovery fallback.
  }
  stop():void {
    if (this.unsubscribe) this.capture(true);
    this.epoch+=1;
    this.unsubscribe?.();this.unsubscribe=undefined;
    this.appListener?.remove();this.appListener=undefined;
    this.startPromise=null;this.activeOwner=null;
    // Keep the last checkpoint for the next launch; never mutate saved chats here.
  }
}
export const replyRecovery=new ReplyRecovery();
