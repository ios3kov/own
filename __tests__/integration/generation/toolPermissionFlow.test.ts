import { runToolLoop } from '../../../src/services/generationToolLoop';
import { llmService } from '../../../src/services/llm';
import { useAppStore } from '../../../src/stores';
import { resetStores, setupWithConversation } from '../../utils/testHelpers';
jest.mock('../../../src/services/llm',()=>({llmService:{generateResponseWithTools:jest.fn(),isModelLoaded:()=>true,isThinkingEnabled:()=>false,supportsThinking:()=>false,stopGeneration:jest.fn()}}));
jest.mock('../../../src/services/providers',()=>({providerRegistry:{hasProvider:()=>false,getProvider:()=>null}}));
describe('model requests cannot override tool consent',()=>{
 it.each([['disabled',[],{query:'private query'}],['empty',['web_search'],{}]] as const)('%s search never sends chat text to Google',async(_name,enabled,args)=>{
  resetStores();const conversationId=setupWithConversation();useAppStore.getState().updateSettings({enabledTools:[...enabled]});
  const fetch=jest.spyOn(global,'fetch');fetch.mockClear();
  (llmService.generateResponseWithTools as jest.Mock).mockResolvedValueOnce({fullResponse:'',toolCalls:[{id:'call',name:'web_search',arguments:args}]}).mockResolvedValueOnce({fullResponse:'Cannot search.',toolCalls:[]});
  const result=jest.fn();
  await runToolLoop({conversationId,messages:[{id:'user',role:'user',content:'Synthetic private text must stay local',timestamp:1}],enabledToolIds:['web_search'],isAborted:()=>false,onThinkingDone:jest.fn(),onFinalResponse:jest.fn(),callbacks:{onToolCallComplete:result}});
  expect(fetch).not.toHaveBeenCalled();expect(result.mock.calls[0][1].error).toBeTruthy();
 });
});
