import AsyncStorage from '@react-native-async-storage/async-storage';
import {ReplyRecovery,REPLY_CHECKPOINT_KEY} from '../../../src/services/replyRecovery';
import {useChatStore} from '../../../src/stores/chatStore';
import {useAppStore} from '../../../src/stores/appStore';
import {resetStores} from '../../utils/testHelpers';
let service:ReplyRecovery;
let now=10_000;
beforeEach(async()=>{
 resetStores();useChatStore.setState({conversations:[],streamingForConversationId:null,streamingMessage:'',streamingReasoningContent:''});
 await AsyncStorage.clear();now=10_000;jest.spyOn(Date,'now').mockImplementation(()=>now);
 service=new ReplyRecovery();await service.start();
});
afterEach(async()=>{service.stop();await service.settled();jest.restoreAllMocks();});
function begin(){const store=useChatStore.getState();const id=store.createConversation('saved-model');store.addMessage(id,{role:'user',content:'Question'});store.startStreaming(id);return id;}
it('checkpoints at most once per interval, then restores a marked partial without touching models or original messages',async()=>{
 const models=useAppStore.getState().downloadedModels;
 const id=begin();const before=useChatStore.getState().conversations;
 const writes=jest.mocked(AsyncStorage.setItem);writes.mockClear();
 for(let i=1;i<=20;i++) useChatStore.getState().setStreamingMessage(`answer ${i}`);
 await service.settled();
 expect(writes.mock.calls.filter(call=>call[0]===REPLY_CHECKPOINT_KEY)).toHaveLength(1);
 now+=5000;useChatStore.getState().setStreamingMessage('Recovered text');await service.settled();
 expect(writes.mock.calls.filter(call=>call[0]===REPLY_CHECKPOINT_KEY)).toHaveLength(2);
 service.stop();useChatStore.setState({conversations:before,streamingForConversationId:null,streamingMessage:'',streamingReasoningContent:''});
 service=new ReplyRecovery();await service.start();await service.settled();
 const messages=useChatStore.getState().conversations.find(c=>c.id===id)!.messages;
 expect(messages).toHaveLength(2);expect(messages[0]).toEqual(before[0].messages[0]);
 expect(messages[1]).toEqual(expect.objectContaining({content:'Recovered text',interrupted:true}));
 expect(useAppStore.getState().downloadedModels).toBe(models);
 service.stop();service=new ReplyRecovery();await service.start();await service.settled();
 expect(useChatStore.getState().conversations[0].messages).toHaveLength(2);
});
it('does not resurrect a completed answer even if the checkpoint remains on disk',async()=>{
 begin();useChatStore.getState().setStreamingMessage('Finished');await service.settled();
 useChatStore.getState().finalizeStreamingMessage(useChatStore.getState().streamingForConversationId!);
 await service.settled();service.stop();service=new ReplyRecovery();await service.start();await service.settled();
 expect(useChatStore.getState().conversations[0].messages.map(m=>m.content)).toEqual(['Question','Finished']);
 expect(useChatStore.getState().conversations[0].messages[1].interrupted).toBeUndefined();
});
it('removes a cancelled checkpoint and never checkpoints old output for a newly queued question',async()=>{
 const id=begin();useChatStore.getState().setStreamingMessage('old partial');await service.settled();
 useChatStore.getState().addMessage(id,{role:'user',content:'Another question'});
 now+=5000;useChatStore.getState().setStreamingMessage('still old output');await service.settled();
 const saved=JSON.parse((await AsyncStorage.getItem(REPLY_CHECKPOINT_KEY))!);
 expect(saved.content).toBe('old partial');
 service.stop();useChatStore.setState({streamingForConversationId:null});service=new ReplyRecovery();await service.start();await service.settled();
 expect(useChatStore.getState().conversations[0].messages.map(m=>m.content)).toEqual(['Question','Another question']);
});
it('deletes the checkpoint when its conversation is deleted',async()=>{
 const id=begin();useChatStore.getState().setStreamingMessage('partial');await service.settled();
 useChatStore.getState().deleteConversation(id);await service.settled();
 expect(await AsyncStorage.getItem(REPLY_CHECKPOINT_KEY)).toBeNull();
});

it('clears an explicitly cancelled reply and checkpoints the newest text on background',async()=>{
 const {AppState}=require('react-native');
 const listener=jest.spyOn(AppState,'addEventListener');
 service.stop();service=new ReplyRecovery();await service.start();
 begin();useChatStore.getState().setStreamingMessage('first');await service.settled();
 now+=1;useChatStore.getState().setStreamingMessage('newest');
 const handler=listener.mock.calls.find(call=>call[0]==='change')![1] as (state:string)=>void;
 handler('background');await service.settled();
 expect(JSON.parse((await AsyncStorage.getItem(REPLY_CHECKPOINT_KEY))!).content).toBe('newest');
 useChatStore.getState().clearStreamingMessage();await service.settled();
 expect(await AsyncStorage.getItem(REPLY_CHECKPOINT_KEY)).toBeNull();
});
it('keeps streaming and retries after a failed checkpoint write',async()=>{
 begin();jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk unavailable'));
 useChatStore.getState().setStreamingMessage('partial');await service.settled();
 now+=5000;useChatStore.getState().setStreamingMessage('later');await service.settled();
 expect(JSON.parse((await AsyncStorage.getItem(REPLY_CHECKPOINT_KEY))!).content).toBe('later');
 expect(useChatStore.getState().streamingMessage).toBe('later');
});
