import AsyncStorage from '@react-native-async-storage/async-storage';
import {DocumentEmbeddingCache} from '../../../../src/services/rag/documentEmbeddingCache';
const key='own-document-embeddings-v1';
const vector=Array(384).fill(0.25);
beforeEach(async()=>{await AsyncStorage.clear();jest.clearAllMocks();});
it('reuses exact content and model identity across instances, without exposing cached arrays',async()=>{
 const first=new DocumentEmbeddingCache();await first.prepare('model-v1');first.put('same text',vector);await first.save();
 const next=new DocumentEmbeddingCache();await next.prepare('model-v1');
 const copy=next.get('same text')!;copy[0]=42;
 expect(next.get('same text')![0]).toBe(0.25);expect(next.get('different text')).toBeUndefined();
 jest.mocked(AsyncStorage.setItem).mockClear();await next.save();expect(AsyncStorage.setItem).not.toHaveBeenCalled();
 await next.prepare('model-v2');expect(next.get('same text')).toBeUndefined();
});
it('rejects corrupt vectors and bounds stored entries',async()=>{
 const cache=new DocumentEmbeddingCache();await cache.prepare('v1');
 cache.put('bad',[1]);cache.put('zero',Array(384).fill(0));cache.put('nan',Array(384).fill(NaN));
 for(let i=0;i<200;i++) cache.put(`entry ${i}`,vector);
 await cache.save();const raw=(await AsyncStorage.getItem(key))!;
 expect(raw.length).toBeLessThanOrEqual(750000);const value=JSON.parse(raw);
 expect(value.entries).toHaveLength(128);expect(cache.get('entry 0')).toBeUndefined();expect(cache.get('bad')).toBeUndefined();
 await cache.clear();expect(await AsyncStorage.getItem(key)).toBeNull();
});
it('tolerates an unreadable cache and reports failed deletion',async()=>{
 jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('read'));
 const cache=new DocumentEmbeddingCache();await expect(cache.prepare('v')).resolves.toBeUndefined();
 cache.put('text',vector);jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('write'));
 await expect(cache.save()).resolves.toBeUndefined();await cache.save();expect(await AsyncStorage.getItem(key)).not.toBeNull();
 jest.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('delete'));
 await expect(cache.clear()).rejects.toThrow('delete');
});
