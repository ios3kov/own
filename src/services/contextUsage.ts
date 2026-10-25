import {fitDocumentContext,formatLocalRequest,MeasuredPrompt} from './documentTokenBudget';
import {beginReplyTiming} from './replyTiming';
import {create} from 'zustand';
import type {LlamaContext} from 'llama.rn';
import {useChatStore} from '../stores/chatStore';

type ContextUse = {request:number; conversationId:string; promptTokens:number|null; replyReserve:number|null; capacity:number|null; formattedPrompt?:string; messageCount?:number};
export const useContextUsage = create<{latest:ContextUse|null}>(()=>({latest:null}));
let sequence=0;
export function beginContextUsage(conversationId:string): number {
  const request=++sequence;
  const messages=useChatStore.getState().conversations.find(conversation=>conversation.id===conversationId)?.messages ?? [];
  let userId:string|undefined;
  for(let index=messages.length-1;index>=0;index-=1) if(messages[index].role==='user') {userId=messages[index].id;break;}
  beginReplyTiming(conversationId,userId);
  useContextUsage.setState({latest:{request,conversationId,promptTokens:null,replyReserve:null,capacity:null}});
  return request;
}

/** Count the actual managed prompt, including tools and media, with the loaded tokenizer. */
export function measureLocalContext(context:LlamaContext, params:Record<string,any>, capacity?:number) {
  return measureContext(context,params,{capacity});
}

async function measureContext(context:LlamaContext, params:Record<string,any>, options:{capacity?:number; prepared?:MeasuredPrompt}): Promise<Awaited<ReturnType<LlamaContext['getFormattedChat']>>|undefined> {
  const {capacity,prepared}=options;
  const owner=useContextUsage.getState().latest;
  if (!owner || useChatStore.getState().streamingForConversationId !== owner.conversationId) return;
  let formatted:Awaited<ReturnType<LlamaContext['getFormattedChat']>>|undefined;
  try {
    formatted=prepared?.formatted ?? await formatLocalRequest(context,params);
    const result=prepared ? undefined : await context.tokenize(formatted.prompt,{media_paths:formatted.media_paths});
    const count=prepared?.tokens ?? (Array.isArray(result?.tokens) ? result.tokens.length : undefined);
    if (count === undefined || useContextUsage.getState().latest?.request !== owner.request) return formatted;
    useContextUsage.setState({latest:{...owner,formattedPrompt:formatted.prompt,messageCount:params.messages?.length,promptTokens:count,
      replyReserve:Number.isSafeInteger(params.n_predict) && params.n_predict > 0 ? params.n_predict : null,
      capacity:typeof capacity === 'number' && Number.isSafeInteger(capacity) && capacity > 0 ? capacity : null}});
  } catch {
    // Missing tokenizer/format support is unknown, never zero usage.
  }
  return formatted;
}

export function contextUsageLabel(usage:ContextUse): string {
  if (usage.promptTokens === null || usage.replyReserve === null || usage.capacity === null)
    return 'Latest request: context size is unavailable for this model.';
  const percent=Math.ceil((usage.promptTokens+usage.replyReserve)/usage.capacity*100);
  return `Latest request: about ${percent}% of context, including room for the reply.${percent >= 90 ? ' Older messages may need to be shortened.' : ''}`;
}

export function reportAppleContextUsage(values: {promptTokens:number; replyReserve:number; capacity:number}): void {
  const owner=useContextUsage.getState().latest;
  if (!owner || useChatStore.getState().streamingForConversationId !== owner.conversationId) return;
  if (![values.promptTokens,values.replyReserve,values.capacity].every(value=>Number.isSafeInteger(value) && value>=0) || values.capacity===0) return;
  useContextUsage.setState({latest:{...owner,promptTokens:values.promptTokens,replyReserve:values.replyReserve,capacity:values.capacity}});
}


/** Reuse the meter's formatter result through the installed engine wrapper itself.
 * No prompt/parser/media fields are reconstructed by Own. The adapter is scoped
 * to this completion, and never replaces a method on the resident context.
 */
export async function contextForMeasuredCompletion(context:LlamaContext, params:Record<string,any>, capacity?:number):Promise<LlamaContext> {
  const owner=useContextUsage.getState().latest?.request;
  const prepared=await fitDocumentContext(context,params,capacity);
  const measured=owner===useContextUsage.getState().latest?.request
    ? await measureContext(context,params,{capacity,prepared}) : undefined;
  const formatted=prepared?.formatted ?? measured;
  // Re-evaluate this adapter when changing the engine; unknown versions keep the safe original path.
  if (!formatted || require('llama.rn/package.json').version!=='0.12.0-rc.9') return context;
  const requestContext=Object.create(context) as LlamaContext;
  requestContext.getFormattedChat=async(messages,template,options)=>{
    const sameOptions=Object.entries(options ?? {}).every(([key,value])=>params[key]===value);
    if (messages===params.messages && template===(params.chat_template || params.chatTemplate) && sameOptions) return formatted;
    return context.getFormattedChat(messages,template,options);
  };
  return requestContext;
}
