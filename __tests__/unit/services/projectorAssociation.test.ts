import {projectorCandidates} from '../../../src/services/modelManager/projectorAssociation';
it('selects the matching model identity instead of the first projector',()=>{
 const wrong={path:'mmproj-ModelB-f16.gguf'},right={path:'mmproj-ModelA-f16.gguf'};
 expect(projectorCandidates('ModelA-Q4_K_M.gguf',[wrong,right],['ModelA-Q4_K_M.gguf','ModelB-Q4_K_M.gguf'])).toEqual([right]);
});
it('rejects generic and foreign named projectors in a mixed-model repository',()=>{
 expect(projectorCandidates('ModelA-Q4.gguf',[{path:'mmproj-f16.gguf'}],['ModelA-Q4.gguf','ModelB-Q4.gguf'])).toEqual([]);
 expect(projectorCandidates('ModelA-Q4.gguf',[{path:'mmproj-ModelB-f16.gguf'}],['ModelA-Q4.gguf'])).toEqual([]);
});
it('retains generic pairing for a single model family and directory',()=>{
 const file={path:'mmproj-f16.gguf'};
 expect(projectorCandidates('ModelA-Q4.gguf',[file],['ModelA-Q4.gguf','ModelA-Q8.gguf'])).toEqual([file]);
 expect(projectorCandidates('ModelA-Q4.gguf',[{path:'other/mmproj-f16.gguf'}],['ModelA-Q4.gguf'])).toEqual([]);
});
