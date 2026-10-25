import { generateFoundationResponse } from '../../../src/services/foundationGeneration';
import { foundationModelService } from '../../../src/services/foundationModels';
import { useChatStore } from '../../../src/stores/chatStore';
import { resetStores,setupWithConversation } from '../../utils/testHelpers';

jest.mock('../../../src/services/foundationModels',()=>({APPLE_MODEL_NAME:'Apple Foundation Models',foundationModelService:{generate:jest.fn()}}));
const source={projectId:'qa',documentId:1,name:'Notes',part:1,excerpt:'Synthetic source text'};
let id:string;
function service():any {
  const svc:any={generationSequence:1,abortRequested:false,documentSources:[],state:{streamingContent:'',startTime:Date.now()},tokenBuffer:'',flushTimer:null,
    prepareGeneration:jest.fn().mockResolvedValue(true),updateState:jest.fn(),resetState:jest.fn(),
    flushTokenBuffer:()=>{useChatStore.getState().appendToStreamingMessage(svc.tokenBuffer);svc.tokenBuffer='';svc.flushTimer=null;},
    forceFlushTokens:()=>{if(svc.flushTimer)clearTimeout(svc.flushTimer);svc.flushTokenBuffer();}};
  return svc;
}
describe('Apple generation lifecycle to persisted chat',()=>{
  beforeEach(()=>{jest.useFakeTimers();resetStores();id=setupWithConversation();useChatStore.getState().startStreaming(id);});
  afterEach(()=>{jest.clearAllTimers();jest.useRealTimers();});
  it('does not start native generation when preparation is refused',async()=>{
    const svc=service();svc.prepareGeneration.mockResolvedValue(false);
    await generateFoundationResponse(svc,{conversationId:id,messages:[]});
    expect(foundationModelService.generate).not.toHaveBeenCalled();
  });
  it('saves streamed content and trusted tool sources, with one first-token event',async()=>{
    const svc=service();const first=jest.fn();const tool=jest.fn();
    (foundationModelService.generate as jest.Mock).mockImplementation(async(_messages,callbacks)=>{
      callbacks.onToken('');callbacks.onToken('Hello');callbacks.onToken(' world.');
      callbacks.onToolCallComplete('knowledge',{documentSources:[source]});
      jest.advanceTimersByTime(50);
    });
    await generateFoundationResponse(svc,{conversationId:id,messages:[],onFirstToken:first,onToolCallComplete:tool});
    expect(first).toHaveBeenCalledTimes(1);expect(tool).toHaveBeenCalledTimes(1);
    const reply=useChatStore.getState().getConversationMessages(id).find(message=>message.role==='assistant');
    expect(reply?.content).toBe('Hello world.');expect(reply?.generationMeta?.documentSources).toEqual([source]);
    expect(svc.resetState).toHaveBeenCalledWith(true);
  });
  it('keeps saved history and adds a visible notice when the native request trims old turns',async()=>{
    const svc=service();const original=useChatStore.getState().getConversationMessages(id);
    (foundationModelService.generate as jest.Mock).mockImplementation(async(_messages,callbacks)=>{
      callbacks.onContextNotice('Older turns were left out. Your saved chat is unchanged.');callbacks.onToken('Answer.');
    });
    await generateFoundationResponse(svc,{conversationId:id,messages:[]});
    const saved=useChatStore.getState().getConversationMessages(id);
    expect(saved.slice(0,original.length)).toEqual(original);
    expect(saved.some(message=>message.isSystemInfo && message.content.includes('saved chat is unchanged'))).toBe(true);
  });
  it('handles missing optional metadata and callbacks without invented sources or timing',async()=>{
    const svc=service();svc.state.startTime=null;svc.documentSources=undefined;
    (foundationModelService.generate as jest.Mock).mockImplementation(async(_messages,callbacks)=>{callbacks.onToolCallComplete('tool',{});callbacks.onToken('Answer.');});
    await generateFoundationResponse(svc,{conversationId:id,messages:[]});
    const reply=useChatStore.getState().getConversationMessages(id).find(message=>message.role==='assistant');
    expect(reply?.content).toBe('Answer.');expect(reply?.generationMeta?.documentSources).toBeUndefined();expect(reply?.generationTimeMs).toBeUndefined();
  });
  it.each(['abort','new request'])('does not let late tokens/tools/completion overwrite another chat after %s',async reason=>{
    const svc=service();const tool=jest.fn();
    (foundationModelService.generate as jest.Mock).mockImplementation(async(_messages,callbacks)=>{
      if(reason==='abort')svc.abortRequested=true;else svc.generationSequence+=1;
      useChatStore.getState().startStreaming('new-chat');useChatStore.getState().setStreamingMessage('New content');
      callbacks.onToken('Late old content');callbacks.onToolCallComplete('knowledge',{documentSources:[source]});
    });
    await generateFoundationResponse(svc,{conversationId:id,messages:[],onToolCallComplete:tool});
    expect(useChatStore.getState().streamingMessage).toBe('New content');expect(tool).not.toHaveBeenCalled();expect(svc.resetState).not.toHaveBeenCalled();
  });
  it.each([true,false])('clears failed partial output with pending timer=%s and reports the actual failure',async pendingTimer=>{
    const svc=service();
    (foundationModelService.generate as jest.Mock).mockImplementation(async(_messages,callbacks)=>{if(pendingTimer)callbacks.onToken('Partial');throw new Error('Synthetic Apple service failure');});
    await expect(generateFoundationResponse(svc,{conversationId:id,messages:[]})).rejects.toThrow('Synthetic Apple service failure');
    expect(useChatStore.getState().streamingMessage).toBe('');expect(svc.tokenBuffer).toBe('');expect(svc.resetState).toHaveBeenCalledWith();
    expect(jest.getTimerCount()).toBe(0);
  });
  it.each(['abort','new request'])('ignores an old failure after %s',async reason=>{
    const svc=service();
    (foundationModelService.generate as jest.Mock).mockImplementation(async()=>{if(reason==='abort')svc.abortRequested=true;else svc.generationSequence+=1;throw new Error('Old error');});
    await expect(generateFoundationResponse(svc,{conversationId:id,messages:[]})).resolves.toBeUndefined();expect(svc.resetState).not.toHaveBeenCalled();
  });
});
