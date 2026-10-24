import { speechText, ReplySpeech, useReplySpeechState } from '../../../src/services/replySpeech';
import { AppState, NativeModules, Platform } from 'react-native';

const tick = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };
describe('local reply speech', () => {
  beforeEach(() => {
    Platform.OS = 'ios'; AppState.currentState = 'active';
    NativeModules.OwnReplySpeech = { begin: jest.fn().mockResolvedValue(null), stop: jest.fn().mockResolvedValue(null), speak: jest.fn().mockResolvedValue(null) };
  });
  it('removes reasoning, code, links and Markdown while keeping readable text', () => {
    expect(speechText('<think>Private.</think>## Answer\n**Read** [this](https://example.com) [1].\n```js\nsecret();\n```\nDone.', true)).toBe('Answer\nRead this .\n\nDone.');
    expect(speechText('<|channel>thought\nPrivate.<channel|>Answer.', true)).toBe('Answer.');
    expect(speechText('<|channel|>analysis<|message|>Private.<|channel|>final<|message|>Answer.', true)).toBe('Answer.');
  });
  it.each(['<think>Private.', '```js\nsecret();', '[link](https://example.com', '<tool_call>secret.', '<|tool_call>secret.', '`secret', '``secret. ', '<thi'])('holds incomplete protected text: %s', value => {
    expect(speechText(value)).toBe('');
  });
  it('is silent while off and stops late speech after cancellation', async () => {
    const speech = new ReplySpeech();
    speech.begin(false); speech.update('Never speak.'); speech.finish(); await tick();
    expect(NativeModules.OwnReplySpeech.speak).not.toHaveBeenCalled();
    let resolve!: () => void;
    NativeModules.OwnReplySpeech.speak.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    speech.begin(true); speech.update('First. Second. '); await tick();
    expect(NativeModules.OwnReplySpeech.speak).toHaveBeenCalledTimes(1);
    await speech.stop(); resolve(); await tick();
    expect(NativeModules.OwnReplySpeech.speak).toHaveBeenCalledTimes(1);
  });
  it('keeps split tokens and protected blocks silent at every stream boundary', async () => {
    const raw = '<think>Do not read this.</think>**Hello world.**\n[Read this](https://example.com).\n```js\nsecret();\n```\n``another secret.``\n<tool_call>hidden tool.</tool_call>Goodbye';
    const speech = new ReplySpeech(); speech.begin(true);
    for (let i = 1; i <= raw.length; i += 1) { speech.update(raw.slice(0, i)); await tick(); }
    speech.finish(); await tick();
    const spoken = NativeModules.OwnReplySpeech.speak.mock.calls.map((call: string[]) => call[0]).join(' ');
    expect(spoken).toBe('Hello world. Read this. Goodbye');
    expect(useReplySpeechState.getState().error).toBeNull();
  });
  it('bounds pending speech and reports failure without exposing the text', async () => {
    const speech = new ReplySpeech(); speech.begin(true); speech.update('X'.repeat(64_001)); await tick();
    expect(NativeModules.OwnReplySpeech.speak).not.toHaveBeenCalled();
    expect(useReplySpeechState.getState().error).toBe('Spoken reply stopped because it was too long.');
  });
  it('cannot let an old failed request cancel a new session', async () => {
    let reject!: (e: Error) => void;
    NativeModules.OwnReplySpeech.speak.mockImplementationOnce(() => new Promise((_done, fail) => { reject = fail; }));
    const speech = new ReplySpeech(); speech.begin(true); speech.update('Old. '); await tick();
    speech.begin(true); speech.update('New. '); reject(new Error('old')); await tick();
    expect(NativeModules.OwnReplySpeech.speak.mock.calls.map((call: string[]) => call[0])).toEqual(['Old.', 'New.']);
    expect(useReplySpeechState.getState().error).toBeNull();
  });
});
