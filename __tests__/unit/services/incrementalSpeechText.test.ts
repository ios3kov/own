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

it('bounds reparsing of a long unfinished paragraph while preserving inline formatting',()=>{
 const raw=('Ordinary words **bold** and _italic_ value < 100 with https://example.com/path. ').repeat(40);
 const sanitize=jest.fn(speechText);const parser=new IncrementalSpeechText(sanitize);
 for(let end=1;end<=raw.length;end+=17) {
  const prefix=raw.slice(0,end);
  expect(parser.get(prefix)).toBe(speechText(prefix));
 }
 expect(parser.get(raw,true)).toBe(speechText(raw,true));
 const processed=sanitize.mock.calls.reduce((total,[part])=>total+part.length,0);
 expect(processed).toBeLessThan(raw.length*40);
});
it('does not turn a mid-paragraph list-like phrase into a new list',()=>{
 const raw=`${'word '.repeat(110)}1. not a list and - not a bullet ${ 'tail '.repeat(120)}`;
 const parser=new IncrementalSpeechText(speechText);
 for(let end=1;end<=raw.length;end+=7) expect(parser.get(raw.slice(0,end))).toBe(speechText(raw.slice(0,end)));
 expect(parser.get(raw,true)).toBe(speechText(raw,true));
});

it.each([
 '<think>hidden words</think>',
 '`private code`',
 '[public label](https://example.com)',
 '<span title="label">public words</span>',
 '```js\nprivate();\n```',
 'value < 100 and **bold words**',
])('preserves full-parser output across long-paragraph boundaries: %s',middle=>{
 const raw='prefix '.repeat(90)+middle+' tail '.repeat(120);
 const parser=new IncrementalSpeechText(speechText);
 for(let end=1;end<=raw.length;end+=11) expect(parser.get(raw.slice(0,end))).toBe(speechText(raw.slice(0,end)));
 expect(parser.get(raw,true)).toBe(speechText(raw,true));
});

it.each([
 `<think>${ 'private '.repeat(100)}</think> 1. Visible answer. More text.`,
 `https://example.com/${ 'path'.repeat(160)} 1. Visible answer.`,
 `Intro.\n${' '.repeat(600)}# Heading and text.`,
])('preserves visible line-start parsing after long hidden or whitespace spans',raw=>{
 const parser=new IncrementalSpeechText(speechText);
 for(let end=1;end<=raw.length;end+=5) expect(parser.get(raw.slice(0,end))).toBe(speechText(raw.slice(0,end)));
 expect(parser.get(raw,true)).toBe(speechText(raw,true));
});
