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
export async function measureLocalContext(context:LlamaContext, params:Record<string,any>, capacity?:number): Promise<Awaited<ReturnType<LlamaContext['getFormattedChat']>>|undefined> {
  const owner=useContextUsage.getState().latest;
  if (!owner || useChatStore.getState().streamingForConversationId !== owner.conversationId) return;
  let formatted:Awaited<ReturnType<LlamaContext['getFormattedChat']>>|undefined;
  try {
    formatted=await context.getFormattedChat(params.messages, params.chat_template || params.chatTemplate, {
      jinja:params.jinja, tools:params.tools, parallel_tool_calls:params.parallel_tool_calls,
      tool_choice:params.tool_choice, enable_thinking:params.enable_thinking, reasoning_format:params.reasoning_format,
      add_generation_prompt:params.add_generation_prompt, now:params.now,
      chat_template_kwargs:params.chat_template_kwargs, force_pure_content:params.force_pure_content,
    });
    const result=await context.tokenize(formatted.prompt,{media_paths:formatted.media_paths});
    if (!Array.isArray(result.tokens) || useContextUsage.getState().latest?.request !== owner.request) return formatted;
    useContextUsage.setState({latest:{...owner,formattedPrompt:formatted.prompt,messageCount:params.messages?.length,promptTokens:result.tokens.length,
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
  const formatted=await measureLocalContext(context,params,capacity);
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
