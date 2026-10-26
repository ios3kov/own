import {fitDocumentContext,knowledgeToolMessage} from '../../../src/services/documentTokenBudget';
const document='[1] Notes (part 1):\nText < 100 with math';
it('omits owned excerpts on tokenizer failure but preserves plain tool statuses',async()=>{
 const owned=knowledgeToolMessage(document);const status=knowledgeToolMessage('Document search is unavailable.');
 const params:any={messages:[owned,status],n_predict:10};
 await fitDocumentContext({getFormattedChat:async()=>{throw new Error('No formatter');}} as any,params,100);
 expect(params.messages[0].content).toContain('omitted');
 expect(params.messages[0].content).not.toContain('Text < 100');
 expect(params.messages[1]).toBe(status);
 expect(owned.content).toContain('Text < 100');
});
it('does not guess a reply allowance for unlimited generation',async()=>{
 const params:any={messages:[knowledgeToolMessage(document)],n_predict:-1};
 await fitDocumentContext({} as any,params,100);
 expect(params.messages[0].content).toContain('omitted');
 expect(params.messages[0].content).not.toContain('Text < 100');
});
