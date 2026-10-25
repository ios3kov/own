import {IncrementalSpeechText} from '../../../src/services/incrementalSpeechText';
import {speechText} from '../../../src/services/replySpeech';
it.each([
 'First line.\nSecond **bold** line.\nValue < 100.',
 '<think>Hidden.\nStill hidden.</think>Answer.\nDone.',
 '<tool_call>Hidden\nsecret</tool_call>Public.\nNext.',
 '<|channel>thought\nHidden\n<channel|>Answer.\nDone.',
 '```js\nsecret();\n```\nVisible.\n',
 'Before `secret\nmore secret` after.\n[Read\nthis](https://example.com).\n[1]\n',
 '~~~\nsecret\n~~~\nNext.\n',
 '<span\n title="hello">Readable</span>\n',
])('matches the full parser at every split, case %#',raw=>{
 const parser=new IncrementalSpeechText(speechText);
 for(let i=1;i<=raw.length;i++) expect(parser.get(raw.slice(0,i))).toBe(speechText(raw.slice(0,i)));
 expect(parser.get(raw,true)).toBe(speechText(raw,true));
});
it('does not reparse committed lines or reparse unchanged text while speech drains',()=>{
 const sanitize=jest.fn(speechText);const parser=new IncrementalSpeechText(sanitize);
 parser.get('First line.\n');sanitize.mockClear();
 parser.get('First line.\nSecond');parser.get('First line.\nSecond');
 expect(sanitize).toHaveBeenCalledTimes(1);expect(sanitize).toHaveBeenCalledWith('Second',false);
});
it('resets parser state when a response is replaced',()=>{
 const parser=new IncrementalSpeechText(speechText);parser.get('Old.\n<think>hidden');
 expect(parser.get('New.\nAnswer.')).toBe('New.\nAnswer.');
});
it('matches the existing parser across combined markup and citation boundaries',()=>{
 const parts=['Public.\n','[1]\n','`private\ncode`\n','<think>hidden\nthought</think>\n','[label](https://example.com)\n','~~~\nsecret\n~~~\n','<TOOL_CALL>hidden\n</TOOL_CALL>\n'];
 for(let a=0;a<parts.length;a++) for(let b=0;b<parts.length;b++) {
  const raw=`${parts[a]}${parts[b]}End.`;const parser=new IncrementalSpeechText(speechText);
  for(let end=1;end<=raw.length;end++) expect(parser.get(raw.slice(0,end))).toBe(speechText(raw.slice(0,end)));
 }
});
