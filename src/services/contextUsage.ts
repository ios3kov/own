import {create} from 'zustand';
import type {LlamaContext} from 'llama.rn';
import {useChatStore} from '../stores/chatStore';

type ContextUse = {request:number; conversationId:string; promptTokens:number|null; replyReserve:number|null; capacity:number|null};
export const useContextUsage = create<{latest:ContextUse|null}>(()=>({latest:null}));
let sequence=0;
export function beginContextUsage(conversationId:string): number {
  const request=++sequence;
  useContextUsage.setState({latest:{request,conversationId,promptTokens:null,replyReserve:null,capacity:null}});
  return request;
}

/** Count the actual managed prompt, including tools and media, with the loaded tokenizer. */
export async function measureLocalContext(context:LlamaContext, params:Record<string,any>, capacity?:number): Promise<void> {
  const owner=useContextUsage.getState().latest;
  if (!owner || useChatStore.getState().streamingForConversationId !== owner.conversationId) return;
  try {
    const formatted=await context.getFormattedChat(params.messages, params.chat_template || params.chatTemplate, {
      jinja:params.jinja, tools:params.tools, parallel_tool_calls:params.parallel_tool_calls,
      tool_choice:params.tool_choice, enable_thinking:params.enable_thinking, reasoning_format:params.reasoning_format,
      add_generation_prompt:params.add_generation_prompt, now:params.now,
      chat_template_kwargs:params.chat_template_kwargs, force_pure_content:params.force_pure_content,
    });
    const result=await context.tokenize(formatted.prompt,{media_paths:formatted.media_paths});
    if (!Array.isArray(result.tokens) || useContextUsage.getState().latest?.request !== owner.request) return;
    useContextUsage.setState({latest:{...owner,promptTokens:result.tokens.length,
      replyReserve:Number.isSafeInteger(params.n_predict) && params.n_predict > 0 ? params.n_predict : null,
      capacity:typeof capacity === 'number' && Number.isSafeInteger(capacity) && capacity > 0 ? capacity : null}});
  } catch {
    // Missing tokenizer/format support is unknown, never zero usage.
  }
}

export function contextUsageLabel(usage:ContextUse): string {
  if (usage.promptTokens === null || usage.replyReserve === null || usage.capacity === null)
    return 'Latest request: context size is unavailable for this model.';
  const percent=Math.ceil((usage.promptTokens+usage.replyReserve)/usage.capacity*100);
  return `Latest request: about ${percent}% of context, including room for the reply.${percent >= 90 ? ' Older messages may need to be shortened.' : ''}`;
}
