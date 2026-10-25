import {contextForMeasuredCompletion,beginContextUsage,useContextUsage} from '../../../src/services/contextUsage';
import {useChatStore} from '../../../src/stores/chatStore';
it('shares the formatted prompt with the engine wrapper without changing its context or parser/media metadata',async()=>{
 useChatStore.setState({streamingForConversationId:'prepared'});beginContextUsage('prepared');
 const messages=[{role:'user',content:'Question'}];const tools=[{type:'function',function:{name:'find'}}];
 const formatted={type:'jinja',prompt:'managed prompt',chat_parser:'native parser',grammar:'native grammar',has_media:true,media_paths:['photo.jpg'],additional_stops:['stop']};
 const formatter=jest.fn().mockResolvedValue(formatted);
 const context:any={id:42,getFormattedChat:formatter,tokenize:jest.fn().mockResolvedValue({tokens:[1,2,3]}),completion:async function(params:any){return this.getFormattedChat(params.messages,undefined,{tools:params.tools,enable_thinking:params.enable_thinking});}};
 const params={messages,tools,enable_thinking:true,n_predict:8};
 const request=await contextForMeasuredCompletion(context,params,2048);
 expect(await request.completion(params as any)).toBe(formatted);
 expect(formatter).toHaveBeenCalledTimes(1);expect(context.getFormattedChat).toBe(formatter);expect(request.id).toBe(42);
 expect(useContextUsage.getState().latest).toEqual(expect.objectContaining({promptTokens:3,formattedPrompt:'managed prompt',messageCount:1}));
 await request.getFormattedChat(messages as any,undefined,{enable_thinking:false});expect(formatter).toHaveBeenCalledTimes(2);
});
it('uses the original context when the meter is not active',async()=>{
 useChatStore.setState({streamingForConversationId:null});
 const context:any={getFormattedChat:jest.fn()};
 expect(await contextForMeasuredCompletion(context,{messages:[]})).toBe(context);expect(context.getFormattedChat).not.toHaveBeenCalled();
});
