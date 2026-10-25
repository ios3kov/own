import {generationService} from '../../../src/services/generationService';
import {buildToolLoopHandlersImpl} from '../../../src/services/generationServiceHelpers';
import {useChatStore} from '../../../src/stores/chatStore';
import {resetStores} from '../../utils/testHelpers';
it('publishes the first chunk immediately and batches later chunks without losing content',()=>{
 jest.useFakeTimers();resetStores();const store=useChatStore.getState();const id=store.createConversation('model');store.startStreaming(id);
 const svc:any=generationService;svc.state={...svc.state,isGenerating:true,conversationId:id,streamingContent:''};svc.abortRequested=false;svc.hasFlushedContent=false;svc.tokenBuffer='';svc.reasoningBuffer='';svc.flushTimer=null;
 const handlers=buildToolLoopHandlersImpl(svc);handlers.onStream({content:'First'});expect(useChatStore.getState().streamingMessage).toBe('First');
 handlers.onStream({content:' second'});jest.advanceTimersByTime(49);expect(useChatStore.getState().streamingMessage).toBe('First');jest.advanceTimersByTime(1);expect(useChatStore.getState().streamingMessage).toBe('First second');
 svc.resetState();handlers.onStream({content:' stale'});expect(useChatStore.getState().streamingMessage).toBe('First second');store.clearStreamingMessage();jest.useRealTimers();
});
it('retains the first queued tap when adjacent messages are combined',async()=>{
 generationService.clearQueue();const processor=jest.fn().mockResolvedValue(undefined);generationService.setQueueProcessor(processor);
 generationService.enqueueMessage({id:'a',conversationId:'chat',text:'A',messageText:'A',requestedAt:100,queuedAt:120});
 generationService.enqueueMessage({id:'b',conversationId:'chat',text:'B',messageText:'B',requestedAt:200,queuedAt:220});
 (generationService as any).processNextInQueue();await Promise.resolve();
 expect(processor).toHaveBeenCalledWith(expect.objectContaining({text:'A\n\nB',requestedAt:100,queuedAt:120}));generationService.setQueueProcessor(null);generationService.clearQueue();
});
