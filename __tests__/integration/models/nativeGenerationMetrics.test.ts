import { initLlama } from 'llama.rn';
import RNFS from 'react-native-fs';
import { llmService } from '../../../src/services/llm';
import { createMockLlamaContext, resetStores } from '../../utils/testHelpers';
beforeEach(async()=>{await llmService.unloadModel();resetStores();(RNFS.exists as jest.Mock).mockResolvedValue(true);(RNFS.stat as jest.Mock).mockResolvedValue({size:1e9,isFile:()=>true});});
afterEach(async()=>{await llmService.unloadModel();});
it.each([false,true])('uses native counters for completion with tools=%s',async tools=>{
  const context=createMockLlamaContext({completion:jest.fn(async(_params,stream)=>{
    stream({token:'Hello'});stream({token:' world'});
    return {text:'Hello world',timings:{predicted_n:40,predicted_ms:1000,cache_n:32,prompt_n:10}} as any;
  })});
  (initLlama as jest.Mock).mockResolvedValue(context);await llmService.loadModel('/model.gguf');
  const messages=[{id:'u',role:'user' as const,content:'Hi',timestamp:0}];
  if(tools)await llmService.generateResponseWithTools(messages,{tools:[]});else await llmService.generateResponse(messages);
  expect(llmService.getPerformanceStats()).toEqual(expect.objectContaining({lastTokenCount:40,lastTokenCountSource:'native',lastCachedTokenCount:32}));
});
