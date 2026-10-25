import {contextForMeasuredCompletion,beginContextUsage,useContextUsage} from '../../../src/services/contextUsage';
import {retrievalService} from '../../../src/services/rag/retrieval';
import {useChatStore} from '../../../src/stores/chatStore';

it('uses the final document budget in completion and reuses its actual count for the meter',async()=>{
 useChatStore.setState({streamingForConversationId:'budget-chat'});
 beginContextUsage('budget-chat');
 const excerpt=retrievalService.formatForPrompt({truncated:false,chunks:[
  {doc_id:1,name:'first',content:'first excerpt',position:0,score:1},
  {doc_id:2,name:'second',content:'second excerpt',position:0,score:0.9},
 ] as any});
 const original=[{role:'system',content:`Keep instructions\n${excerpt}`},{role:'user',content:'Question'}];
 const params:any={messages:original,n_predict:10,tools:[{name:'calculator'}]};
 const context:any={
  getFormattedChat:jest.fn(async(messages:any[])=>({prompt:JSON.stringify(messages),media_paths:['/photo']})),
  tokenize:jest.fn(async(prompt:string)=>({tokens:new Array(50+(prompt.includes('first excerpt')?20:0)+(prompt.includes('second excerpt')?20:0)).fill(1)})),
  completion:async function(this:any,p:any){return this.getFormattedChat(p.messages,undefined,{
   tools:p.tools,enable_thinking:p.enable_thinking,
  });},
 };
 const prepared=await contextForMeasuredCompletion(context,params,150);
 const completed=await (prepared as any).completion(params);
 expect(completed.prompt).toContain('first excerpt');
 expect(completed.prompt).not.toContain('second excerpt');
 expect(completed.prompt).toContain('Keep instructions');
 expect(completed.prompt).toContain('Question');
 expect(original[0].content).toContain('second excerpt');
 expect(useContextUsage.getState().latest?.promptTokens).toBe(70);
 expect(context.tokenize).toHaveBeenCalledTimes(2);
 expect(context.getFormattedChat).toHaveBeenCalledTimes(2);
});


it('does not publish a late budget into another conversation meter',async()=>{
 useChatStore.setState({streamingForConversationId:'old'});beginContextUsage('old');
 const content=retrievalService.formatForPrompt({truncated:false,chunks:[{doc_id:1,name:'doc',content:'text',position:0,score:1}] as any});
 let finish!:(value:any)=>void;
 const context:any={getFormattedChat:async()=>({prompt:'formatted'}),tokenize:()=>new Promise(resolve=>{finish=resolve;})};
 const work=contextForMeasuredCompletion(context,{messages:[{role:'system',content}],n_predict:10},200);
 await Promise.resolve();await Promise.resolve();
 useChatStore.setState({streamingForConversationId:'new'});beginContextUsage('new');
 finish({tokens:[1,2,3]});await work;
 expect(useContextUsage.getState().latest?.conversationId).toBe('new');
 expect(useContextUsage.getState().latest?.promptTokens).toBeNull();
});
