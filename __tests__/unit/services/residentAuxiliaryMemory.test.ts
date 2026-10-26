import RNFS from 'react-native-fs';
import { residentAuxiliaryMemory } from '../../../src/services/residentAuxiliaryMemory';
import { whisperService } from '../../../src/services/whisperService';
import { embeddingService } from '../../../src/services/rag/embedding';
import { llmService } from '../../../src/services/llm';
jest.mock('../../../src/services/whisperService',()=>({whisperService:{getLoadedModelPath:jest.fn()}}));
jest.mock('../../../src/services/rag/embedding',()=>({embeddingService:{getLoadedModelPath:jest.fn()}}));
jest.mock('../../../src/services/llm',()=>({llmService:{getLoadedVisionPath:jest.fn()}}));
beforeEach(()=>{
  (whisperService.getLoadedModelPath as jest.Mock).mockReturnValue('/whisper');
  (embeddingService.getLoadedModelPath as jest.Mock).mockReturnValue('/embedding');
  (llmService.getLoadedVisionPath as jest.Mock).mockReturnValue('/vision');
  (RNFS.stat as jest.Mock).mockResolvedValue({size:100});
});
it('accounts for all three resident auxiliary resources and excludes replaced vision',async()=>{
  expect(await residentAuxiliaryMemory()).toEqual({estimatedBytes:360,complete:true});
  expect(await residentAuxiliaryMemory(false)).toEqual({estimatedBytes:240,complete:true});
});
it('reports missing file statistics as incomplete instead of claiming a complete estimate',async()=>{
  (RNFS.stat as jest.Mock).mockRejectedValue(new Error('Missing'));
  expect(await residentAuxiliaryMemory()).toEqual({estimatedBytes:0,complete:false});
});
