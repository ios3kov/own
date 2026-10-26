import { generationService } from '../../../src/services/generationService';
import { useChatStore } from '../../../src/stores';
import { resetStores } from '../../utils/testHelpers';
it('keeps interleaved queued messages in their own conversations and arrival order',async()=>{
 resetStores();generationService.clearQueue();
 const a=useChatStore.getState().createConversation('model','Synthetic A');
 const b=useChatStore.getState().createConversation('model','Synthetic B');
 const delivered:string[]=[];
 generationService.setQueueProcessor(async item=>{
  delivered.push(item.conversationId);
  useChatStore.getState().addMessage(item.conversationId,{role:'user',content:item.text});
 });
 try {
  for(const [i,conversationId] of [a,b,a].entries())generationService.enqueueMessage({id:String(i),conversationId,text:`entry ${i}`,messageText:`entry ${i}`});
  for(let i=0;i<3;i++){(generationService as any).processNextInQueue();await Promise.resolve();}
  expect(delivered).toEqual([a,b,a]);
  expect(useChatStore.getState().conversations.find(c=>c.id===a)?.messages.map(m=>m.content)).toEqual(['entry 0','entry 2']);
  expect(useChatStore.getState().conversations.find(c=>c.id===b)?.messages.map(m=>m.content)).toEqual(['entry 1']);
 }finally{generationService.clearQueue();generationService.setQueueProcessor(null);}
});
