import { requireDownloadConsent } from './downloadConsent';
import { initWhisper,WhisperContext,RealtimeTranscribeEvent,AudioSessionIos } from 'whisper.rn';
import RNFS from 'react-native-fs';
import logger from '../utils/logger';
import { backgroundDownloadService } from './backgroundDownloadService';

export interface TranscriptionResult {
  text: string;
  isCapturing: boolean;
  processTime: number;
  recordingTime: number;
}
export type TranscriptionCallback = (result: TranscriptionResult) => void;

export const WHISPER_MODELS = [
  { id: 'tiny.en', name: 'Whisper Tiny (English)', size: 75, url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin', description: 'Fastest, English only, good for basic transcription' },
  { id: 'tiny', name: 'Whisper Tiny (Multilingual)', size: 75, url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin', description: 'Fast, supports multiple languages' },
  { id: 'base.en', name: 'Whisper Base (English)', size: 142, url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin', description: 'Better accuracy, English only' },
  { id: 'base', name: 'Whisper Base (Multilingual)', size: 142, url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin', description: 'Better accuracy, multiple languages' },
  { id: 'small.en', name: 'Whisper Small (English)', size: 466, url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin', description: 'High accuracy, English only, needs more RAM' },
];

export function whisperLanguage(modelPath: string | null, requested?: string, multilingual?: boolean): string {
  const language = requested?.trim().toLowerCase() || 'auto';
  const englishOnly = multilingual === false || (multilingual !== true && /\.en\.bin$/i.test(modelPath ?? ''));
  if (!englishOnly) return language;
  if (language === 'auto' || language === 'en' || language.startsWith('en-')) return 'en';
  throw new Error('This speech model supports English only. Choose a multilingual Whisper model for this language.');
}

class WhisperService {
  private context: WhisperContext | null = null;
  private currentModelPath: string | null = null;
  private isTranscribing: boolean = false;
  private transcriptionEpoch = 0;
  private stopVersion = 0;
  private stopFn: (() => void) | null = null;
  private isReleasingContext: boolean = false;
  private contextReleasePromise: Promise<void> = Promise.resolve();
  private transcriptionFullyStopped: Promise<void> = Promise.resolve();
  private activeDownloadId: string | null = null;
  private resourceOperations=0;
  private idleReleasing=false;
  private idleRestorePath:string|null=null;
  private resourceWork: Promise<void> = Promise.resolve();
  private withResource<T>(work: () => Promise<T>): Promise<T> {
    this.resourceOperations+=1;
    const pending = this.resourceWork.then(work).finally(()=>{this.resourceOperations-=1;});
    this.resourceWork = pending.then(() => {}, () => {});
    return pending;
  }
  loadModel(modelPath: string): Promise<void> {
    this.idleRestorePath=null;
    return this.withResource(() => this.loadModelNow(modelPath));
  }
  unloadModel(): Promise<void> {
    this.idleRestorePath=null;
    return this.withResource(() => this.unloadModelNow());
  }
  startRealtimeTranscription(onResult: TranscriptionCallback, options?: {language?: string; maxLen?: number}): Promise<void> {
    const version = this.stopVersion;
    return this.withResource(async()=>{await this.restoreAfterIdle();return this.startRealtimeTranscriptionNow(onResult, options, version);});
  }
  transcribeFile(filePath: string, options?: {language?: string; onProgress?: (progress: number) => void}): Promise<string> {
    return this.withResource(async()=>{await this.restoreAfterIdle();return this.transcribeFileNow(filePath, options);});
  }

  async releaseIfIdle():Promise<boolean> {
    if(!this.context || this.resourceOperations || this.isTranscribing || this.stopFn || this.isReleasingContext) return false;
    this.idleRestorePath=this.currentModelPath;this.idleReleasing=true;
    try {await this.withResource(()=>this.unloadModelNow());return true;} finally {this.idleReleasing=false;}
  }
  private async restoreAfterIdle():Promise<void> {
    if(!this.context && this.idleRestorePath) await this.loadModelNow(this.idleRestorePath);
  }
  getModelsDir(): string { return `${RNFS.DocumentDirectoryPath}/whisper-models`; }
  async ensureModelsDirExists(): Promise<void> {
    const dir = this.getModelsDir();
    if (!await RNFS.exists(dir)) await RNFS.mkdir(dir);
  }
  getModelPath(modelId: string): string { return `${this.getModelsDir()}/ggml-${modelId}.bin`; }
  async isModelDownloaded(modelId: string): Promise<boolean> { return RNFS.exists(this.getModelPath(modelId)); }

  async downloadModel(modelId: string, onProgress?: (progress: number) => void): Promise<string> {
    const model = WHISPER_MODELS.find(m => m.id === modelId);
    if (!model) throw new Error(`Unknown model: ${modelId}`);
    await this.ensureModelsDirExists();
    const destPath = this.getModelPath(modelId);
    if (await RNFS.exists(destPath)) return destPath;
    await requireDownloadConsent({name: model.name, files: [{size: model.size * 1_000_000, url: model.url}], estimated: true});
    logger.log(`[Whisper] Downloading ${model.name} via background download service...`);
    const fileName = `ggml-${modelId}.bin`;
    const { downloadIdPromise, promise } = backgroundDownloadService.downloadFileTo({
      params: {
        url: model.url,
        fileName,
        modelId: `whisper-${modelId}`,
        totalBytes: 0,
      },
      destPath,
      onProgress: onProgress
        ? (bytesDownloaded, totalBytes) => {
            onProgress(totalBytes > 0 ? bytesDownloaded / totalBytes : 0);
          }
        : undefined,
      silent: true,
    });
    try {
      this.activeDownloadId = await downloadIdPromise;
      await promise;
    } catch (error) {
      logger.error('[Whisper] Download failed:', error);
      await RNFS.unlink(destPath).catch(() => {});
      throw error;
    } finally {
      this.activeDownloadId = null;
    }
    try {
      await this.validateModelFile(destPath);
    } catch (validationError) {
      await RNFS.unlink(destPath).catch(err => logger.error('[Whisper] Failed to delete invalid model file:', err));
      throw new Error(`Downloaded model file is invalid: ${validationError instanceof Error ? validationError.message : 'unknown error'}`);
    }
    logger.log(`[Whisper] Downloaded to ${destPath}`);
    return destPath;
  }
  async deleteModel(modelId: string): Promise<void> {
    if (this.activeDownloadId !== null) {
      await backgroundDownloadService.cancelDownload(this.activeDownloadId).catch(() => {});
      this.activeDownloadId = null;
    }
    const path = this.getModelPath(modelId);
    if (await RNFS.exists(path)) await RNFS.unlink(path);
  }

  /**
   * Minimum valid model file size in bytes (10 MB).
   * The smallest whisper model (tiny) is ~75 MB, so anything under 10 MB
   * is almost certainly a corrupted or incomplete download.
   */
  private static readonly MIN_MODEL_FILE_SIZE = 10 * 1024 * 1024;

  /**
   * Validate that a whisper model file exists and has a reasonable size
   * before passing it to the native layer. The native initWithModelPath
   * calls abort() on invalid files, which kills the process without
   * giving JS a chance to handle the error.
   */
  async validateModelFile(modelPath: string): Promise<void> {
    if (!modelPath) {
      throw new Error('Whisper model path is empty or undefined');
    }

    const exists = await RNFS.exists(modelPath);
    if (!exists) {
      throw new Error(`Whisper model file not found at: ${modelPath}`);
    }

    const stat = await RNFS.stat(modelPath);
    const fileSize = Number(stat.size);
    if (Number.isNaN(fileSize) || fileSize < WhisperService.MIN_MODEL_FILE_SIZE) {
      // Remove the corrupted file so the user can re-download
      await RNFS.unlink(modelPath).catch(() => {});
      throw new Error(
        `Whisper model file is too small (${Math.round(fileSize / 1024)} KB) and likely corrupted. ` +
        'The file has been removed. Please re-download the model.'
      );
    }

    logger.log(`[Whisper] Model file validated: ${modelPath} (${Math.round(fileSize / (1024 * 1024))} MB)`);
  }

  private async loadModelNow(modelPath: string): Promise<void> {
    if (this.context && this.currentModelPath !== modelPath) await this.unloadModelNow();
    if (this.context && this.currentModelPath === modelPath) return;
    if (this.isReleasingContext) {
      logger.log('[WhisperService] Waiting for context release to finish before loading');
      await this.contextReleasePromise;
    }

    // Validate model file before passing to native layer.
    // Native initWithModelPath calls abort() on invalid files, crashing the app.
    await this.validateModelFile(modelPath);

    logger.log(`[Whisper] Loading model: ${modelPath}`);
    try {
      this.context = await initWhisper({ filePath: modelPath });
      this.currentModelPath = modelPath;
      this.idleRestorePath=null;
      logger.log('[Whisper] Model loaded successfully');
    } catch (error) {
      logger.error('[Whisper] Failed to load model:', error);
      this.context = null;
      this.currentModelPath = null;
      throw error;
    }
  }

  private async unloadModelNow(): Promise<void> {
    if (!this.context) return;
    // Stop active transcription to prevent SIGSEGV on freed context
    if (this.isTranscribing || this.stopFn) {
      logger.log('[WhisperService] Stopping active transcription before unloading model');
      await this.stopTranscription();
      await this.transcriptionFullyStopped;
    }
    await this.transcriptionFullyStopped;
    if (this.isReleasingContext) { logger.log('[WhisperService] Context release already in progress, skipping'); return; }
    this.isReleasingContext = true;
    this.contextReleasePromise = (async () => {
      try { await this.context!.release(); } catch (error) { logger.error('[WhisperService] Error releasing context:', error); }
      finally { this.context = null; this.currentModelPath = null; this.isReleasingContext = false; }
    })()
    await this.contextReleasePromise;
  }
  isModelLoaded(): boolean { return this.context !== null && !this.idleReleasing; }
  getLoadedModelPath(): string | null { return this.currentModelPath; }

  async requestPermissions(): Promise<boolean> {
    try {
      await AudioSessionIos.setCategory('PlayAndRecord', ['AllowBluetooth', 'MixWithOthers']);
      await AudioSessionIos.setMode('Default');
      await AudioSessionIos.setActive(true);
      return true;
    } catch (error) {
      logger.error('[Whisper] iOS audio session/permission error:', error);
      return false;
    }
  }

  private async startRealtimeTranscriptionNow(
    onResult: TranscriptionCallback,
    options?: {
      language?: string;
      maxLen?: number;
    },
    stopVersion = this.stopVersion,
  ): Promise<void> {
    if (stopVersion !== this.stopVersion) throw new Error('Recording cancelled.');
    logger.log('[WhisperService] startRealtimeTranscription called');
    logger.log('[WhisperService] Context exists:', !!this.context);
    logger.log('[WhisperService] isTranscribing:', this.isTranscribing);

    if (!this.context) {
      throw new Error('No Whisper model loaded');
    }

    // If already transcribing, force stop before starting new
    if (this.isTranscribing || this.stopFn) {
      logger.log('[WhisperService] Stopping previous transcription before starting new one');
      await this.stopTranscriptionNow();
      await this.transcriptionFullyStopped;
    }

    logger.log('[WhisperService] Requesting permissions...');
    const hasPermission = await this.requestPermissions();
    logger.log('[WhisperService] Permission granted:', hasPermission);

    if (!hasPermission) {
      throw new Error('Microphone permission denied');
    }

    if (stopVersion !== this.stopVersion) throw new Error('Recording cancelled.');
    const operation = ++this.transcriptionEpoch;
    this.isTranscribing = true;

    // Create a promise that resolves when the native side fully finishes
    let resolveTranscriptionStopped: () => void = () => {};
    this.transcriptionFullyStopped = new Promise<void>(resolve => {
      resolveTranscriptionStopped = resolve;
    });

    try {
      // Guard: context could have been released during the async permission check
      if (!this.context) {
        this.isTranscribing = false;
        resolveTranscriptionStopped();
        throw new Error('Whisper context was released before transcription could start');
      }

      logger.log('[WhisperService] Calling transcribeRealtime...');
      // Use the transcribeRealtime API
      const { stop, subscribe } = await this.context.transcribeRealtime({
        language: whisperLanguage(this.currentModelPath, options?.language, this.context.multilingual),
        maxLen: options?.maxLen || 0, // 0 = no limit
        realtimeAudioSec: 30, // Process in 30-second chunks
        realtimeAudioSliceSec: 3, // Slice every 3 seconds for faster intermediate results
        ...(({
          audioSessionOnStartIos: {
            category: 'PlayAndRecord',
            options: ['AllowBluetooth', 'MixWithOthers'],
            mode: 'Default',
          },
          audioSessionOnStopIos: 'restore',
        })),
      });

      logger.log('[WhisperService] transcribeRealtime started successfully');
      const cancelledDuringStart = operation !== this.transcriptionEpoch || !this.isTranscribing;
      if (!cancelledDuringStart) this.stopFn = stop;

      subscribe((evt: RealtimeTranscribeEvent) => {
        if (cancelledDuringStart || operation !== this.transcriptionEpoch) {
          if (!evt.isCapturing) resolveTranscriptionStopped();
          return;
        }
        logger.log('[WhisperService] Event received:', {
          isCapturing: evt.isCapturing,
          hasData: !!evt.data,
          text: evt.data?.result?.slice(0, 50),
        });

        const { isCapturing, data, processTime, recordingTime } = evt;
        onResult({
          text: data?.result || '',
          isCapturing,
          processTime: processTime || 0,
          recordingTime: recordingTime || 0,
        });

        if (!isCapturing) {
          logger.log('[WhisperService] Recording finished');
          this.isTranscribing = false;
          this.stopFn = null;
          // Signal that native processing is complete - safe to release context
          resolveTranscriptionStopped();
        }
      });
      if (cancelledDuringStart) {
        stop();
        await this.transcriptionFullyStopped;
      }
    } catch (error) {
      logger.error('[WhisperService] transcribeRealtime error:', error);
      if (operation === this.transcriptionEpoch) {
        this.isTranscribing = false;
        this.stopFn = null;
      }
      resolveTranscriptionStopped();
      throw error;
    }
  }

  async stopTranscription(): Promise<void> {
    this.stopVersion += 1;
    await this.stopTranscriptionNow();
  }

  private async stopTranscriptionNow(): Promise<void> {
    logger.log('[WhisperService] stopTranscription called');
    try {
      // Grab and clear stopFn atomically to prevent double-stop race conditions.
      // Two concurrent callers (e.g. trailing audio timeout + clearResult) could
      // both see stopFn as non-null and call it twice, causing SIGSEGV in
      // finishRealtimeTranscribeJob on the native side.
      const fn = this.stopFn;
      this.stopFn = null;
      if (fn) {
        // Guard: only call stop if context still exists
        // Calling stop on a freed context causes SIGSEGV
        if (this.context) {
          fn();
        } else {
          logger.log('[WhisperService] Context already released, skipping stopFn call');
        }
      }
    } catch (error) {
      logger.error('[WhisperService] Error stopping transcription:', error);
    } finally {
      this.isTranscribing = false;
    }
  }

  /** Force reset state — also calls native stop to prevent SIGSEGV from orphaned jobs. */
  forceReset(): void {
    logger.log('[WhisperService] Force resetting state');
    this.transcriptionEpoch += 1;
    this.stopVersion += 1;
    // Atomic grab-and-clear to match stopTranscription's pattern and prevent double-stop
    const fn = this.stopFn;
    this.stopFn = null;
    if (fn && this.context) {
      try { fn(); } catch (e) { logger.error('[WhisperService] Error calling stopFn during forceReset:', e); }
    }
    this.isTranscribing = false;
    // Keep the native completion barrier: resetting UI state does not free native work.
  }

  isCurrentlyTranscribing(): boolean { return this.isTranscribing; }

  // Transcribe a single audio file
  private async transcribeFileNow(
    filePath: string,
    options?: {
      language?: string;
      onProgress?: (progress: number) => void;
    }
  ): Promise<string> {
    if (!this.context) {
      throw new Error('No Whisper model loaded');
    }

    if (this.isTranscribing) throw new Error('Another transcription is running. Stop it before importing audio.');
    await this.transcriptionFullyStopped;
    if (!this.context) throw new Error('No Whisper model loaded');
    if (this.isTranscribing) throw new Error('Another transcription is running. Stop it before importing audio.');
    const operation = ++this.transcriptionEpoch;
    this.isTranscribing = true;
    try {
      const { promise, stop } = this.context.transcribe(filePath, {
        language: whisperLanguage(this.currentModelPath, options?.language, this.context.multilingual), onProgress: options?.onProgress,
      });
      this.stopFn = stop;
      this.transcriptionFullyStopped = promise.then(() => {}, () => {});
      const { result } = await promise;
      return result;
    } finally {
      if (operation === this.transcriptionEpoch) {
        this.stopFn = null;
        this.isTranscribing = false;
      }
    }
  }
}

export const whisperService = new WhisperService();
