import AsyncStorage from '@react-native-async-storage/async-storage';
import { responseDefaults,cleanResponseValues,responseSnapshot,limitChatHistory,builtInResponses } from '../../../src/utils/modelResponseSettings';
import { useResponseProfilesStore } from '../../../src/stores/responseProfilesStore';
import type { Message } from '../../../src/types';
describe('model response settings and safe profiles',()=>{
  beforeEach(()=>useResponseProfilesStore.setState({profiles:[],active:{}}));
  it('keeps only controls supported by the engine and excludes privacy permissions',()=>{
    expect(cleanResponseValues('apple',{historyTurns:4,temperature:0.2,maxTokens:512,topP:0.5,allowAppleSpeech:true,readRepliesAloud:true})).toEqual({historyTurns:4,temperature:0.2,maxTokens:512});
    expect(responseDefaults('remote')).toEqual({historyTurns:24});
    expect(builtInResponses('remote')[2].values.maxTokens).toBeUndefined();
    expect(cleanResponseValues('__proto__' as any,{historyTurns:4})).toBeNull();
    expect(cleanResponseValues('apple',{historyTurns:4,temperature:Infinity})).toBeNull();
  });
  it('reflects the Apple response cap without changing other selected settings',()=>{
    expect(responseSnapshot('apple',{historyTurns:12,temperature:0.4,maxTokens:8192})).toEqual({historyTurns:12,temperature:0.4,maxTokens:2048});
  });
  it('saves and replaces profiles only within the same engine',async()=>{
    const store=useResponseProfilesStore.getState();
    expect(await store.save({name:'My profile',backend:'apple',values:responseDefaults('apple')})).toBe(true);
    expect(await store.save({name:'My profile',backend:'llama',values:responseDefaults('llama')})).toBe(true);
    expect(await store.save({name:'My profile',backend:'apple',values:{historyTurns:4,temperature:0.2,maxTokens:256}})).toBe(true);
    expect(useResponseProfilesStore.getState().profiles).toHaveLength(2);
    await store.remove('My profile','apple');expect(useResponseProfilesStore.getState().profiles[0].backend).toBe('llama');
  });
  it('rejects invalid names and bounds stored profiles',async()=>{
    const store=useResponseProfilesStore.getState();
    expect(await store.save({name:'\n',backend:'apple',values:responseDefaults('apple')})).toBe(false);
    for(let i=0;i<20;i+=1) expect(await store.save({name:`Profile ${i}`,backend:'apple',values:responseDefaults('apple')})).toBe(true);
    expect(await store.save({name:'One too many',backend:'apple',values:responseDefaults('apple')})).toBe(false);
  });
  it('persists the chosen reset baseline and filters it on rehydration',async()=>{
    const values={historyTurns:4,temperature:0.2,maxTokens:256};
    expect(await useResponseProfilesStore.getState().select('apple',values)).toBe(true);
    const saved=await AsyncStorage.getItem('own-response-profiles');
    useResponseProfilesStore.setState({active:{}});
    await AsyncStorage.setItem('own-response-profiles',saved!);
    await useResponseProfilesStore.persist.rehydrate();
    expect(useResponseProfilesStore.getState().active.apple).toEqual(values);
    expect(useResponseProfilesStore.getState().active.llama).toBeUndefined();
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(useResponseProfilesStore.getState().select('apple',values)).resolves.toBe(false);
  });
  it('does not report persistence success when storage rejects the write',async()=>{
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(useResponseProfilesStore.getState().save({name:'Unsaved',backend:'apple',values:responseDefaults('apple')})).resolves.toBe(false);
  });
  it('limits whole exchanges and preserves the saved transcript and system documents',()=>{
    const system:Message={id:'s',role:'system',content:'System plus documents',timestamp:0};
    const messages:Message[]=[system,...Array.from({length:6},(_,i)=>[{id:`u${i}`,role:'user' as const,content:`Question ${i}`,timestamp:i},{id:`a${i}`,role:'assistant' as const,content:`Answer ${i}`,timestamp:i}]).flat()];
    expect(limitChatHistory(messages,2).map(m=>m.id)).toEqual(['s','u4','a4','u5','a5']);
    expect(messages).toHaveLength(13);
  });
});

describe('response setting validation boundaries',()=>{
  it.each(['historyTurns','temperature','maxTokens','topP','repeatPenalty','contextLength'])('rejects invalid persisted %s values',key=>{
    const backend='llama';
    for (const value of [NaN,Infinity,-1,1e10,'invalid',null])
      expect(cleanResponseValues(backend,{historyTurns:4,[key]:value})).toBeNull();
  });
  it('rejects malformed snapshots and fractions without deleting messages',()=>{
    for (const value of [null,undefined,false,3,'bad']) expect(cleanResponseValues('apple',value)).toBeNull();
    expect(cleanResponseValues('apple',{historyTurns:1.5})).toBeNull();
    expect(cleanResponseValues('apple',{})).toBeNull();
    expect(responseSnapshot('apple',{historyTurns:-1,temperature:-1})).toEqual(responseDefaults('apple'));
    expect(limitChatHistory([],0)).toEqual([]);
    expect(limitChatHistory([],Infinity)).toEqual([]);
  });
  it('drops invalid, duplicate and unsupported profiles on restore',async()=>{
    const values=responseDefaults('apple');
    await AsyncStorage.setItem('own-response-profiles',JSON.stringify({version:1,state:{profiles:[null,{name:'',backend:'apple',values},{name:'Bad',backend:'none',values},{name:'Bad',backend:'apple',values:{historyTurns:-1}},{name:'OK',backend:'apple',values},{name:'OK',backend:'apple',values}],active:{apple:values,llama:{historyTurns:-1},remote:{historyTurns:4,apiKey:'never-retain'}}}}));
    await useResponseProfilesStore.persist.rehydrate();
    expect(useResponseProfilesStore.getState().profiles).toEqual([{name:'OK',backend:'apple',values}]);
    expect(useResponseProfilesStore.getState().active).toEqual({apple:values,remote:{historyTurns:4}});
  });
});
