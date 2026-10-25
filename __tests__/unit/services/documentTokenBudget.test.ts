import { fitDocumentContext } from '../../../src/services/documentTokenBudget';

const block = '<knowledge_base>\nThe following excerpts are from the user\'s project knowledge base. Use them to inform your response when relevant.\n\n[Source: First (part 1)]\n"first"\n\n---\n\n[Source: Second (part 1)]\n"second"\n</knowledge_base>';
const makeContext = () => ({
 getFormattedChat: jest.fn(async (messages: any[], _template: unknown, options: any) => ({
  prompt: JSON.stringify({messages,tools:options.tools}),media_paths:['/image'],
 })),
 tokenize: jest.fn(async (prompt: string, options: any) => ({tokens:new Array(
  30 + (prompt.includes('first') ? 20 : 0) + (prompt.includes('second') ? 20 : 0)
   + (prompt.includes('calculator') ? 10 : 0) + (options.media_paths.length ? 10 : 0),
 ).fill(1)})),
});
it('keeps higher ranked excerpts within the complete request and reply budget',async()=>{
 const context=makeContext();
 const original=[{role:'system',content:`Instructions\n${block}`},{role:'user',content:'Question'}];
 const params:any={messages:original,tools:[{name:'calculator'}],n_predict:10};
 await fitDocumentContext(context as any,params,150);
 expect(params.messages[0].content).toContain('first');
 expect(params.messages[0].content).not.toContain('second');
 expect(original[0].content).toContain('second');
 expect(params.messages[1]).toEqual(original[1]);
 expect(context.tokenize).toHaveBeenLastCalledWith(expect.any(String),{media_paths:['/image']});
});
it('removes all excerpts when history and reply leave no room',async()=>{
 const params:any={messages:[{role:'system',content:`Instructions\n${block}`}],n_predict:50};
 await fitDocumentContext(makeContext() as any,params,120);
 expect(params.messages[0].content).toBe('Instructions\n');
});
it('does not tokenize requests without injected document excerpts',async()=>{
 const context=makeContext();const params:any={messages:[{role:'user',content:block}],n_predict:10};
 await fitDocumentContext(context as any,params,150);
 expect(context.tokenize).not.toHaveBeenCalled();
});
it('keeps documents when a full formatted request fits',async()=>{
 const params:any={messages:[{role:'system',content:block}],n_predict:10};
 await fitDocumentContext(makeContext() as any,params,300);
 expect(params.messages[0].content).toBe(block);
});
it('omits excerpts if the native tokenizer fails instead of guessing a fit',async()=>{
 const context=makeContext();context.tokenize.mockRejectedValue(new Error('unavailable'));
 const params:any={messages:[{role:'system',content:`Instructions\n${block}`}],n_predict:10};
 await fitDocumentContext(context as any,params,150);
 expect(params.messages[0].content).toBe('Instructions\n');
});

it('removes every injected block on counting failure and keeps surrounding instructions',async()=>{
 const context=makeContext();context.tokenize.mockRejectedValue(new Error('unavailable'));
 const params:any={messages:[{role:'system',content:`Before${block}Between${block}After`}],n_predict:10};
 await fitDocumentContext(context as any,params,150);
 expect(params.messages[0].content).toBe('BeforeBetweenAfter');
});
it('does not invent a reply reserve when output length is unbounded',async()=>{
 const params:any={messages:[{role:'system',content:block}],n_predict:-1};
 await fitDocumentContext(makeContext() as any,params,150);
 expect(params.messages[0].content).toBe('');
});
