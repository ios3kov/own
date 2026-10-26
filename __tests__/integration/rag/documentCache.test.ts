import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import {initLlama} from 'llama.rn';
import {embeddingService} from '../../../src/services/rag/embedding';
const vector=Array(384).fill(0.125);
beforeEach(async()=>{await embeddingService.unload();await AsyncStorage.clear();await embeddingService.clearDocumentCache();jest.mocked(RNFS.hash).mockResolvedValue('a'.repeat(64));});
afterEach(async()=>{await embeddingService.unload();await embeddingService.clearDocumentCache();jest.mocked(RNFS.hash).mockResolvedValue('mockhash');});
it('reuses document chunks after reload, but rebuilds when model contents change or documents are deleted',async()=>{
 const embedding=jest.fn().mockResolvedValue({embedding:vector});const release=jest.fn().mockResolvedValue(undefined);
 jest.mocked(initLlama).mockResolvedValue({embedding,release} as any);
 await embeddingService.load();expect(await embeddingService.embedBatch(['same content','same content'])).toEqual([vector,vector]);
 expect(embedding).toHaveBeenCalledTimes(1);
 await embeddingService.unload();await embeddingService.load();await embeddingService.embedBatch(['same content']);expect(embedding).toHaveBeenCalledTimes(1);
 await embeddingService.unload();jest.mocked(RNFS.hash).mockResolvedValue('b'.repeat(64));await embeddingService.load();await embeddingService.embedBatch(['same content']);expect(embedding).toHaveBeenCalledTimes(2);
 await embeddingService.clearDocumentCache();await embeddingService.embedBatch(['same content']);expect(embedding).toHaveBeenCalledTimes(3);
});
it('does not reuse persisted vectors when the model fingerprint is unavailable',async()=>{
 jest.mocked(RNFS.hash).mockRejectedValue(new Error('unavailable'));
 const embedding=jest.fn().mockResolvedValue({embedding:vector});jest.mocked(initLlama).mockResolvedValue({embedding,release:jest.fn()} as any);
 await embeddingService.load();await embeddingService.embedBatch(['same','same']);expect(embedding).toHaveBeenCalledTimes(2);
});
