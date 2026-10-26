import RNFS from 'react-native-fs';
import { NativeModules } from 'react-native';
import { pdfExtractor } from './pdfExtractor';
import { parseCSV, parseXLSX, LocalTable } from './tableData';

export const IMAGE_TEXT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.webp', '.tiff'];
export const AUDIO_EXTENSIONS = ['.wav', '.m4a', '.mp3', '.aac', '.aiff', '.caf'];
export async function readLocalTables(path: string, extension: string): Promise<LocalTable[]> {
  const size = Number((await RNFS.stat(path)).size);
  if (size > 5_000_000) throw new Error('Table files must be smaller than 5 MB.');
  if (extension === '.csv') return [parseCSV(await RNFS.readFile(path, 'utf8'))];
  const binary = atob(await RNFS.readFile(path, 'base64'));
  return parseXLSX(Uint8Array.from(binary, c => c.charCodeAt(0)));
}
export async function extractSpecialFile(path: string, extension: string, maxChars: number): Promise<string | null> {
  if (IMAGE_TEXT_EXTENSIONS.includes(extension)) return pdfExtractor.extractImageText(path, maxChars);
  if (extension === '.xlsx' || extension === '.csv') {
    const sheets = await readLocalTables(path, extension);
    // Explicit rows/columns, never executable formulas or arbitrary code.
    return sheets.map(sheet => `Table: ${sheet.name}\n${sheet.warnings.join('\n')}\n${JSON.stringify({columns: sheet.columns, rows: sheet.rows})}`).join('\n\n');
  }
  if (!AUDIO_EXTENSIONS.includes(extension)) return null;
  const { useWhisperStore } = require('../stores/whisperStore'); // NOSONAR
  const { whisperService } = require('./whisperService'); // NOSONAR
  const store = useWhisperStore.getState();
  if (!store.downloadedModelId) throw new Error('Choose and download a Whisper model in Voice Settings first. Audio stays on your device.');
  if (!store.isModelLoaded) await store.loadModel();
  if (!useWhisperStore.getState().isModelLoaded) throw new Error('Could not load the selected Whisper model. Check Voice Settings.');
  if (!NativeModules.AudioImport) throw new Error('Audio import is unavailable in this build.');
  const wav = await NativeModules.AudioImport.prepare(path);
  try {
    const text = await whisperService.transcribeFile(wav, { language: 'auto' });
    if (!text.trim()) throw new Error('No speech was found in this recording.');
    return `On-device audio transcript. Transcription can contain mistakes.\n\n${text}`;
  } finally { await RNFS.unlink(wav).catch(() => {}); }
}
