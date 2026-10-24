import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import { extractSpecialFile, readLocalTables } from '../../../src/services/localFileContent';
const mockTranscribe=jest.fn(); const mockLoad=jest.fn();
let mockWhisperState:any;
jest.mock('../../../src/stores/whisperStore',()=>({useWhisperStore:{getState:()=>mockWhisperState}}));
jest.mock('../../../src/services/whisperService',()=>({whisperService:{transcribeFile:(...args:any[])=>mockTranscribe(...args)}}));
describe('local file routing and processing',()=>{
 beforeEach(()=>{jest.clearAllMocks();mockWhisperState={downloadedModelId:'tiny',isModelLoaded:true,loadModel:mockLoad};
  NativeModules.PDFExtractorModule={extractImageText:jest.fn().mockResolvedValue('x < 5, ORCHID')};
  NativeModules.AudioImport={prepare:jest.fn().mockResolvedValue('/tmp/own-audio-fixture.wav')};
  mockTranscribe.mockResolvedValue('Synthetic transcript');
 });
 it('routes local photos through the native OCR bridge',async()=>{
  // PDF wrapper captures the native bridge at module initialization; use its current object.
  const {pdfExtractor}=require('../../../src/services/pdfExtractor');
  const spy=jest.spyOn(pdfExtractor,'extractImageText').mockResolvedValue('x < 5, ORCHID');
  expect(await extractSpecialFile('/documents/photo.png','.png',1000)).toContain('x < 5');
  expect(spy).toHaveBeenCalledWith('/documents/photo.png',1000);spy.mockRestore();
 });
 it('reads CSV as structured data and calculates without any model or server',async()=>{
  (RNFS.stat as jest.Mock).mockResolvedValue({size:25});
  (RNFS.readFile as jest.Mock).mockResolvedValue('team,value\nA,2\nA,3');
  const [table]=await readLocalTables('/documents/data.csv','.csv');
  const {analyzeTable}=require('../../../src/services/tableData');
  expect(analyzeTable(table,{operation:'group',column:0,valueColumn:1}).rows).toEqual([['A','5']]);
 });
 it('decodes/transcribes audio locally and removes only its temporary WAV',async()=>{
  expect(await extractSpecialFile('/documents/recording.m4a','.m4a',1000)).toContain('Synthetic transcript');
  expect(NativeModules.AudioImport.prepare).toHaveBeenCalledWith('/documents/recording.m4a');
  expect(mockTranscribe).toHaveBeenCalledWith('/tmp/own-audio-fixture.wav',{language:'auto'});
  expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/own-audio-fixture.wav');
 });
 it('does not download a missing speech model or convert the recording',async()=>{
  mockWhisperState.downloadedModelId=null;
  await expect(extractSpecialFile('/recording.m4a','.m4a',1000)).rejects.toThrow('Voice Settings');
  expect(mockLoad).not.toHaveBeenCalled();expect(NativeModules.AudioImport.prepare).not.toHaveBeenCalled();
 });
 it('cleans temporary audio after a transcription failure',async()=>{
  mockTranscribe.mockRejectedValueOnce(new Error('decoder failed'));
  await expect(extractSpecialFile('/recording.m4a','.m4a',1000)).rejects.toThrow('decoder failed');
  expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/own-audio-fixture.wav');
 });
});
