import { AppState, NativeModules } from 'react-native';
import { ReplySpeech, useReplySpeechState } from '../../../src/services/replySpeech';

it('streams a mathematical comparison through parsing and the speech queue without truncation', async () => {
  AppState.currentState = 'active';
  const speak = jest.fn().mockResolvedValue(null);
  NativeModules.OwnReplySpeech = {begin: jest.fn().mockResolvedValue(null), stop: jest.fn().mockResolvedValue(null), speak};
  const speech = new ReplySpeech();
  speech.begin(true);
  for (const text of ['Value ', 'Value < ', 'Value < 100. ', 'Value < 100. Keep the rest.']) speech.update(text);
  speech.finish();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(speak.mock.calls.map(call => call[0])).toEqual(['Value < 100.', 'Keep the rest.']);
  expect(useReplySpeechState.getState().error).toBeNull();
  await speech.stop();
});


it('reads long sentences and more than twelve sentences without dropping queued text', async () => {
  AppState.currentState = 'active';
  const speak = jest.fn().mockResolvedValue(null);
  NativeModules.OwnReplySpeech = {begin:jest.fn().mockResolvedValue(null),stop:jest.fn().mockResolvedValue(null),speak};
  const speech = new ReplySpeech();
  const text = `${'word '.repeat(500).trim()}. ${Array.from({length:30}, (_,i) => `Sentence ${i}.`).join(' ')}`;
  speech.begin(true); speech.update(text); speech.finish();
  for (let i=0;i<180;i++) await Promise.resolve();
  expect(speak.mock.calls.map(call => call[0]).join(' ').replace(/\s+/g,' ').trim()).toBe(text);
  expect(speak.mock.calls.every(call => call[0].length <= 800)).toBe(true);
  expect(useReplySpeechState.getState().error).toBeNull();
  await speech.stop();
});
