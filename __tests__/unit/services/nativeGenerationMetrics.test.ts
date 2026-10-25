import { recordGenerationStats } from '../../../src/services/llmHelpers';
afterEach(()=>jest.restoreAllMocks());
it('uses native token/cache counts rather than the number of stream events',()=>{
  jest.spyOn(Date,'now').mockReturnValue(3000);
  const stats=recordGenerationStats(1000,500,{events:2,timings:{predicted_n:40,predicted_ms:1000,prompt_n:10,cache_n:32}});
  expect(stats).toEqual(expect.objectContaining({lastTokenCount:40,lastTokensPerSecond:20,lastDecodeTokensPerSecond:40,lastTokenCountSource:'native',lastPromptTokenCount:10,lastCachedTokenCount:32}));
});
it('marks missing or invalid native counters as estimates',()=>{
  jest.spyOn(Date,'now').mockReturnValue(3000);
  const stats=recordGenerationStats(1000,500,{events:2,timings:{predicted_n:-1,cache_n:Number.NaN}});
  expect(stats.lastTokenCount).toBe(2);expect(stats.lastTokenCountSource).toBe('stream-events-estimate');
  expect(stats.lastCachedTokenCount).toBeUndefined();
});
