import {AppState,NativeModules} from 'react-native';
import {ReplySpeech,useReplySpeechState} from '../../../src/services/replySpeech';
const tick=async()=>{for(let i=0;i<20;i++) await Promise.resolve();};
it('keeps multi-line protected blocks silent while incrementally reading later paragraphs',async()=>{
 AppState.currentState='active';NativeModules.OwnReplySpeech={begin:jest.fn().mockResolvedValue(undefined),stop:jest.fn().mockResolvedValue(undefined),speak:jest.fn().mockResolvedValue(undefined)};
 const speech=new ReplySpeech();speech.begin(true);
 const raw='First line.\n<think>Never read\nthis reasoning.</think>Second line.\n[1]\n```js\nprivate();\n```\nLast line.';
 for(let end=1;end<=raw.length;end++) {speech.update(raw.slice(0,end));await tick();}
 speech.finish();await tick();
 expect(NativeModules.OwnReplySpeech.speak.mock.calls.map((call:string[])=>call[0]).join(' ')).toBe('First line. Second line. Last line.');
 expect(useReplySpeechState.getState().error).toBeNull();await speech.stop();
});

it('reads a long streamed paragraph once without losing list-like text or speaking protected content',async()=>{
 AppState.currentState='active';NativeModules.OwnReplySpeech={begin:jest.fn().mockResolvedValue(undefined),stop:jest.fn().mockResolvedValue(undefined),speak:jest.fn().mockResolvedValue(undefined)};
 const speech=new ReplySpeech();speech.begin(true);
 const before='ordinary '.repeat(70);
 const after='remaining '.repeat(80);
 const raw=`${before}1. is part of the paragraph <think>private reasoning</think>value < 100. ${after}`;
 for(let end=1;end<=raw.length;end+=13){speech.update(raw.slice(0,end));await tick();}
 speech.update(raw);speech.finish();await tick();
 const read=NativeModules.OwnReplySpeech.speak.mock.calls.map((call:string[])=>call[0]).join(' ');
 expect(read).toBe((`${before}1. is part of the paragraph value < 100. ${after}`).trim());
 expect(useReplySpeechState.getState().error).toBeNull();await speech.stop();
});
