import type {LlamaContext} from 'llama.rn';

export const KNOWLEDGE_HEADER = "<knowledge_base>\nThe following excerpts are from the user's project knowledge base. Use them to inform your response when relevant.\n\n";
export const KNOWLEDGE_FOOTER = '\n</knowledge_base>';
const SEPARATOR = '\n\n---\n\n';
export type MeasuredPrompt = {formatted: Awaited<ReturnType<LlamaContext['getFormattedChat']>>; tokens: number};

export function formatLocalRequest(context:LlamaContext, params:Record<string,any>) {
 return context.getFormattedChat(params.messages, params.chat_template || params.chatTemplate, {
  jinja:params.jinja,tools:params.tools,parallel_tool_calls:params.parallel_tool_calls,
  tool_choice:params.tool_choice,enable_thinking:params.enable_thinking,reasoning_format:params.reasoning_format,
  add_generation_prompt:params.add_generation_prompt,now:params.now,
  chat_template_kwargs:params.chat_template_kwargs,force_pure_content:params.force_pure_content,
 });
}

/** Remove the last, lowest-ranked automatic excerpt, without editing saved messages. */
function removeExcerpt(messages:any[], all=false):any[]|undefined {
 let changed=false;
 const next=messages.map(message=>{
  if(message.role!=='system' || typeof message.content!=='string') return message;
  let content=message.content;
  let start=content.indexOf(KNOWLEDGE_HEADER);
  while(start>=0) {
   const end=content.indexOf(KNOWLEDGE_FOOTER,start+KNOWLEDGE_HEADER.length);
   if(end<0) break;
   const sections=content.slice(start+KNOWLEDGE_HEADER.length,end).split(SEPARATOR);
   sections.pop();
   const replacement=!all && sections.length ? KNOWLEDGE_HEADER+sections.join(SEPARATOR)+KNOWLEDGE_FOOTER : '';
   content=content.slice(0,start)+replacement+content.slice(end+KNOWLEDGE_FOOTER.length);
   changed=true;
   if(!all) break;
   start=content.indexOf(KNOWLEDGE_HEADER);
  }
  return {...message,content};
 });
 return changed ? next : undefined;
}

/** Full native prompt count includes history, tool schema and media. No storage writes. */
export async function fitDocumentContext(context:LlamaContext, params:Record<string,any>, capacity?:number):Promise<MeasuredPrompt|undefined> {
 if(!Array.isArray(params.messages) || !Number.isSafeInteger(capacity) || capacity!<=0) return;
 if(!removeExcerpt(params.messages)) return;
 const reserve=params.n_predict;
 if(!Number.isSafeInteger(reserve) || reserve<=0) {
  params.messages=removeExcerpt(params.messages,true) ?? params.messages;
  return;
 }
 while(true) {
  try {
   const formatted=await formatLocalRequest(context,params);
   const result=await context.tokenize(formatted.prompt,{media_paths:formatted.media_paths});
   if(!Array.isArray(result.tokens)) throw new Error('Tokenizer count unavailable');
   const measured={formatted,tokens:result.tokens.length};
   if(measured.tokens+reserve+64<=capacity!) return measured;
   const next=removeExcerpt(params.messages);
   if(!next) return measured; // History alone overflows; normal recovery owns it.
   params.messages=next;
  } catch {
   params.messages=removeExcerpt(params.messages,true) ?? params.messages;
   return;
  }
 }
}
