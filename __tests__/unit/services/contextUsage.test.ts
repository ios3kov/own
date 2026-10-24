import { beginContextUsage,measureLocalContext,useContextUsage,contextUsageLabel } from '../../../src/services/contextUsage';
import { useChatStore } from '../../../src/stores/chatStore';
describe('context use at the actual local inference boundary',()=>{
  beforeEach(()=>{useContextUsage.setState({latest:null});useChatStore.setState({streamingForConversationId:'c'});});
  it('uses the tokenizer on the formatted tools, documents and media prompt, plus reply reserve',async()=>{
    beginContextUsage('c');
    const context:any={getFormattedChat:jest.fn().mockResolvedValue({prompt:'formatted system + tools + document + history',media_paths:['/image']}), tokenize:jest.fn().mockResolvedValue({tokens:[1,2,3,4]})};
    const messages=[{role:'system',content:'Document excerpt'}, {role:'user',content:'Question'}];
    const tools=[{name:'calculator'}];
    await measureLocalContext(context,{messages,tools,n_predict:6,enable_thinking:true},20);
    expect(context.getFormattedChat).toHaveBeenCalledWith(messages,undefined,expect.objectContaining({tools,enable_thinking:true}));
    expect(context.tokenize).toHaveBeenCalledWith('formatted system + tools + document + history',{media_paths:['/image']});
    expect(contextUsageLabel(useContextUsage.getState().latest!)).toBe('Latest request: about 50% of context, including room for the reply.');
  });
  it('never reports zero or a precise percent when counting is unavailable',async()=>{
    beginContextUsage('c');
    await measureLocalContext({} as any,{messages:[],n_predict:6},20);
    expect(contextUsageLabel(useContextUsage.getState().latest!)).toContain('unavailable');
  });
  it('does not publish an old count after a new request',async()=>{
    beginContextUsage('c');
    let finish!:(result:any)=>void;
    const context:any={getFormattedChat:()=>new Promise(resolve=>{finish=resolve;}),tokenize:jest.fn().mockResolvedValue({tokens:[1,2]})};
    const pending=measureLocalContext(context,{messages:[],n_predict:6},20);
    const newer=beginContextUsage('c');
    finish({prompt:'old'});await pending;
    expect(useContextUsage.getState().latest?.request).toBe(newer);
    expect(useContextUsage.getState().latest?.promptTokens).toBeNull();
  });
  it('warns at high projected use without silently deleting chat history',async()=>{
    beginContextUsage('c');
    const context:any={getFormattedChat:async()=>({prompt:'prompt'}),tokenize:async()=>({tokens:[1,2,3,4]})};
    await measureLocalContext(context,{messages:[],n_predict:15},20);
    expect(contextUsageLabel(useContextUsage.getState().latest!)).toContain('95%');
    expect(contextUsageLabel(useContextUsage.getState().latest!)).toContain('Older messages may need to be shortened.');
  });
});

describe('unknown context limits and cancelled requests',()=>{
  it('does not tokenize without an owned active chat',async()=>{
    const context:any={getFormattedChat:jest.fn()};
    useContextUsage.setState({latest:null});
    await measureLocalContext(context,{});
    beginContextUsage('another-chat');
    useChatStore.setState({streamingForConversationId:'c'});
    await measureLocalContext(context,{});
    expect(context.getFormattedChat).not.toHaveBeenCalled();
  });
  it('does not display a made-up budget for unbounded or invalid limits',async()=>{
    useChatStore.setState({streamingForConversationId:'c'});
    const context:any={getFormattedChat:async()=>({prompt:'prompt'}),tokenize:async()=>({tokens:[1,2]})};
    for (const [reserve,capacity] of [[-1,20],[0,20],[6,-1],[6,1.5],[6,undefined]]) {
      beginContextUsage('c');await measureLocalContext(context,{n_predict:reserve,chatTemplate:'custom'},capacity);
      expect(contextUsageLabel(useContextUsage.getState().latest!)).toContain('unavailable');
    }
  });
  it('rejects a malformed tokenizer result',async()=>{
    useChatStore.setState({streamingForConversationId:'c'});beginContextUsage('c');
    await measureLocalContext({getFormattedChat:async()=>({prompt:'prompt'}),tokenize:async()=>({tokens:null})} as any,{n_predict:6},20);
    expect(useContextUsage.getState().latest?.promptTokens).toBeNull();
  });
});
