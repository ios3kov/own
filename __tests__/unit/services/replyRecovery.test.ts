import {recoveredConversations} from '../../../src/services/replyRecovery';
import {createConversation,createUserMessage,createAssistantMessage} from '../../utils/factories';
const user=createUserMessage('Question');
const conversation={...createConversation(),messages:[user]};
const checkpoint={version:1,id:'partial',conversationId:conversation.id,revision:conversation.updatedAt,anchorId:user.id,userId:user.id,content:'Partial answer',reasoningContent:'',timestamp:123};
it('adds a marked partial reply without modifying original messages or other chats',()=>{
 const other=createConversation();const input=[conversation,other];
 const recovered=recoveredConversations(input,JSON.stringify(checkpoint));
 expect(input[0].messages).toEqual([user]);expect(recovered[1]).toBe(other);
 expect(recovered[0].messages[1]).toEqual(expect.objectContaining({id:'partial',content:'Partial answer',interrupted:true}));
 expect(recoveredConversations(recovered,JSON.stringify(checkpoint))).toBe(recovered);
});
it.each([null,'bad','null','[]',JSON.stringify({...checkpoint,version:2}),JSON.stringify({...checkpoint,timestamp:-1}),JSON.stringify({...checkpoint,content:7}),JSON.stringify({...checkpoint,content:'x'.repeat(256001)})])('ignores malformed checkpoint case %#',raw=>{
 expect(recoveredConversations([conversation],raw)).toEqual([conversation]);
});
it('ignores edits, completed replies, deleted chats and another user turn',()=>{
 for(const input of [[],[{...conversation,updatedAt:'changed'}],[{...conversation,messages:[user,createAssistantMessage('Done')]}],[{...conversation,messages:[user,createUserMessage('Next')]}]]) {
  expect(recoveredConversations(input,JSON.stringify(checkpoint))).toBe(input);
 }
});
it('can recover an answer after a tool result for the same user turn',()=>{
 const tool={...createAssistantMessage('result'),role:'tool' as const};
 const input=[{...conversation,messages:[user,tool]}];
 expect(recoveredConversations(input,JSON.stringify({...checkpoint,anchorId:tool.id}))[0].messages).toHaveLength(3);
});
