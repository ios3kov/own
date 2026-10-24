import {huggingFaceService} from '../../../src/services/huggingface';
it('keeps projector origin with the selected file across repository parsing',async()=>{
 const fetch=jest.spyOn(global,'fetch').mockResolvedValueOnce({ok:true,json:async()=>[
  {type:'file',path:'ModelA-Q4_K_M.gguf',size:1000},
  {type:'file',path:'ModelB-Q4_K_M.gguf',size:1000},
  {type:'file',path:'mmproj-ModelB-f16.gguf',size:200},
  {type:'file',path:'mmproj-ModelA-f16.gguf',size:200},
 ]} as Response);
 try {
 const files=await huggingFaceService.getModelFiles('fixture/mixed');
 expect(files.find(file=>file.name==='ModelA-Q4_K_M.gguf')?.mmProjFile?.name).toBe('mmproj-ModelA-f16.gguf');
 expect(files.find(file=>file.name==='ModelB-Q4_K_M.gguf')?.mmProjFile?.name).toBe('mmproj-ModelB-f16.gguf');
 } finally {fetch.mockRestore();}
});
