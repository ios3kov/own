import { initWhisper } from 'whisper.rn';
import RNFS from 'react-native-fs';
import { whisperService } from '../../../src/services/whisperService';

beforeEach(async () => {
  await whisperService.unloadModel();
  (RNFS.exists as jest.Mock).mockResolvedValue(true);
  (RNFS.stat as jest.Mock).mockResolvedValue({size:75*1024*1024});
});
afterEach(async () => { await whisperService.unloadModel(); });

it('releases a pending load before running an import queued after unload', async () => {
  let finish!: (context: any) => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => {entered=resolve;});
  (initWhisper as jest.Mock).mockImplementationOnce(() => {entered();return new Promise(resolve => {finish=resolve;});});
  const context = {release:jest.fn().mockResolvedValue(undefined),transcribe:jest.fn()};
  const loading = whisperService.loadModel('/speech.bin');
  await started;
  const unloading = whisperService.unloadModel();
  const importing = whisperService.transcribeFile('/audio.wav').catch(error => error);
  finish(context);
  await loading; await unloading;
  expect(await importing).toEqual(expect.objectContaining({message:'No Whisper model loaded'}));
  expect(context.release).toHaveBeenCalledTimes(1);
  expect(context.transcribe).not.toHaveBeenCalled();
  expect(whisperService.isModelLoaded()).toBe(false);
});

it('waits for a file recognition to finish before releasing its native context', async () => {
  let finish!: (result:any) => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => {entered=resolve;});
  const context = {release:jest.fn().mockResolvedValue(undefined),transcribe:jest.fn(() => {
    entered();return {promise:new Promise(resolve => {finish=resolve;}),stop:jest.fn()};
  })};
  (initWhisper as jest.Mock).mockResolvedValueOnce(context);
  await whisperService.loadModel('/speech.bin');
  const recognition = whisperService.transcribeFile('/audio.wav');
  await started;
  const unloading = whisperService.unloadModel();
  expect(context.release).not.toHaveBeenCalled();
  finish({result:'complete transcript'});
  expect(await recognition).toBe('complete transcript');
  await unloading;
  expect(context.release).toHaveBeenCalledTimes(1);
});

it('stops a realtime start cancelled before its native handle arrives and waits for final completion', async () => {
  let finishStart!: (handle:any) => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => {entered=resolve;});
  let onEvent!: (event:any) => void;
  const stop = jest.fn(() => {onEvent({isCapturing:false});});
  const context = {release:jest.fn().mockResolvedValue(undefined),transcribeRealtime:jest.fn(() => {
    entered();return new Promise(resolve => {finishStart=resolve;});
  })};
  (initWhisper as jest.Mock).mockResolvedValueOnce(context);
  await whisperService.loadModel('/speech.bin');
  const callback = jest.fn();
  const recording = whisperService.startRealtimeTranscription(callback);
  await started;
  await whisperService.stopTranscription();
  const unloading = whisperService.unloadModel();
  finishStart({stop,subscribe:(listener:any) => {onEvent=listener;}});
  await recording; await unloading;
  expect(stop).toHaveBeenCalledTimes(1);
  expect(callback).not.toHaveBeenCalled();
  expect(context.release).toHaveBeenCalledTimes(1);
});

it('uses the selected English-only model consistently for imported audio', async () => {
  const context = {release:jest.fn().mockResolvedValue(undefined),transcribe:jest.fn(() => ({
    promise:Promise.resolve({result:'English transcript'}),stop:jest.fn(),
  }))};
  (initWhisper as jest.Mock).mockResolvedValueOnce(context);
  await whisperService.loadModel('/ggml-tiny.en.bin');
  await expect(whisperService.transcribeFile('/audio.wav',{language:'ru'})).rejects.toThrow('English only');
  expect(context.transcribe).not.toHaveBeenCalled();
  expect(await whisperService.transcribeFile('/audio.wav')).toBe('English transcript');
  expect(context.transcribe).toHaveBeenCalledWith('/audio.wav',expect.objectContaining({language:'en'}));
});

it('does not start the microphone after cancellation during permission setup', async () => {
  const { AudioSessionIos } = require('whisper.rn');
  let finishPermission!: () => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => {entered=resolve;});
  AudioSessionIos.setActive.mockImplementationOnce(() => {entered();return new Promise<void>(resolve => {finishPermission=resolve;});});
  const context = {release:jest.fn().mockResolvedValue(undefined),transcribeRealtime:jest.fn()};
  (initWhisper as jest.Mock).mockResolvedValueOnce(context);
  await whisperService.loadModel('/speech.bin');
  const recording = whisperService.startRealtimeTranscription(jest.fn()).catch(error => error);
  await started;
  await whisperService.stopTranscription();
  finishPermission();
  expect(await recording).toEqual(expect.objectContaining({message:'Recording cancelled.'}));
  expect(context.transcribeRealtime).not.toHaveBeenCalled();
});

it('restores an idled speech model before a new file operation and preserves its file',async()=>{
 let finish!:()=>void;
 const old={release:jest.fn(()=>new Promise<void>(resolve=>{finish=resolve;}))};
 const fresh={release:jest.fn().mockResolvedValue(undefined),transcribe:jest.fn(()=>({promise:Promise.resolve({result:'new recording'}),stop:jest.fn()}))};
 (initWhisper as jest.Mock).mockResolvedValueOnce(old).mockResolvedValueOnce(fresh);
 await whisperService.loadModel('/speech.bin');const releasing=whisperService.releaseIfIdle();while(!finish) await Promise.resolve();
 expect(whisperService.isModelLoaded()).toBe(false);const work=whisperService.transcribeFile('/new.wav');finish();await releasing;
 expect(await work).toBe('new recording');expect(whisperService.getLoadedModelPath()).toBe('/speech.bin');expect(fresh.transcribe).toHaveBeenCalledTimes(1);
});
it('does not idle-release an active file transcription',async()=>{
 let finish!:(value:any)=>void;
 const context={release:jest.fn(),transcribe:()=>({promise:new Promise(resolve=>{finish=resolve;}),stop:jest.fn()})};
 (initWhisper as jest.Mock).mockResolvedValueOnce(context);await whisperService.loadModel('/speech.bin');const work=whisperService.transcribeFile('/new.wav');while(!finish) await Promise.resolve();
 expect(await whisperService.releaseIfIdle()).toBe(false);expect(context.release).not.toHaveBeenCalled();finish({result:'complete'});await work;
});

it('uses native language support for a renamed imported English-only model',async()=>{
 const context={multilingual:false,release:jest.fn().mockResolvedValue(undefined),transcribe:jest.fn()};
 (initWhisper as jest.Mock).mockResolvedValueOnce(context);
 await whisperService.loadModel('/imported-name.bin');
 await expect(whisperService.transcribeFile('/recording.wav',{language:'es'})).rejects.toThrow('English only');
 expect(context.transcribe).not.toHaveBeenCalled();
});

it('allows multilingual models even when an imported filename ends in .en.bin',async()=>{
 const context={multilingual:true,release:jest.fn().mockResolvedValue(undefined),transcribe:jest.fn().mockReturnValue({promise:Promise.resolve({result:'hola'}),stop:jest.fn()})};
 (initWhisper as jest.Mock).mockResolvedValueOnce(context);
 await whisperService.loadModel('/renamed.en.bin');
 await expect(whisperService.transcribeFile('/recording.wav',{language:'es'})).resolves.toBe('hola');
 expect(context.transcribe).toHaveBeenCalledWith('/recording.wav',expect.objectContaining({language:'es'}));
});
