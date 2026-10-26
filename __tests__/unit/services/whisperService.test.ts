/**
 * WhisperService Unit Tests
 *
 * Tests for Whisper speech-to-text service.
 * Priority: P1 - Voice input support.
 */

import { initWhisper,AudioSessionIos } from 'whisper.rn';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { whisperService,WHISPER_MODELS,whisperLanguage } from '../../../src/services/whisperService';
import { backgroundDownloadService } from '../../../src/services/backgroundDownloadService';

jest.mock('../../../src/services/backgroundDownloadService', () => ({
  backgroundDownloadService: {
    isAvailable: jest.fn(() => true),
    downloadFileTo: jest.fn(),
    cancelDownload: jest.fn(() => Promise.resolve()),
  },
}));

const mockedBDS = backgroundDownloadService as jest.Mocked<typeof backgroundDownloadService>;
const mockedAudioSessionIos = AudioSessionIos as jest.Mocked<typeof AudioSessionIos>;

const mockedRNFS = RNFS as jest.Mocked<typeof RNFS>;
const mockedInitWhisper = initWhisper as jest.MockedFunction<typeof initWhisper>;

  /** Mock RNFS to report a valid model file (exists + large enough) */
const mockValidModelFile = () => {
  mockedRNFS.exists.mockResolvedValue(true);
  mockedRNFS.stat.mockResolvedValue({ size: 75 * 1024 * 1024, isFile: () => true } as any);
};

describe('WhisperService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    // Reset singleton state
    (whisperService as any).resourceWork = Promise.resolve();
    (whisperService as any).context = null;
    (whisperService as any).currentModelPath = null;
    (whisperService as any).isTranscribing = false;
    (whisperService as any).stopFn = null;
    (whisperService as any).isReleasingContext = false;
    (whisperService as any).transcriptionFullyStopped = Promise.resolve();
    (whisperService as any).activeDownloadId = null;
    // Default backgroundDownloadService mock
    mockedBDS.isAvailable.mockReturnValue(true);
    mockedBDS.downloadFileTo.mockReturnValue({
      downloadId: 0,
      downloadIdPromise: Promise.resolve(0),
      promise: Promise.resolve(),
    } as any);
    mockedBDS.cancelDownload.mockResolvedValue(undefined as any);
    // Re-establish default AudioSessionIos mock implementations
    // (previous tests may have set mockRejectedValue which clearAllMocks doesn't reset)
    mockedAudioSessionIos.setCategory.mockResolvedValue(undefined as any);
    mockedAudioSessionIos.setMode.mockResolvedValue(undefined as any);
    mockedAudioSessionIos.setActive.mockResolvedValue(undefined as any);
  });

  // ========================================================================
  // getModelsDir / getModelPath
  // ========================================================================
  describe('getModelsDir', () => {
    it('returns path under DocumentDirectoryPath', () => {
      expect(whisperService.getModelsDir()).toBe('/mock/documents/whisper-models');
    });
  });

  describe('getModelPath', () => {
    it('returns correct path for a model ID', () => {
      expect(whisperService.getModelPath('tiny.en')).toBe(
        '/mock/documents/whisper-models/ggml-tiny.en.bin'
      );
    });
  });

  // ========================================================================
  // isModelDownloaded
  // ========================================================================
  describe('isModelDownloaded', () => {
    it('returns true when file exists', async () => {
      mockedRNFS.exists.mockResolvedValue(true);
      expect(await whisperService.isModelDownloaded('tiny.en')).toBe(true);
    });

    it('returns false when file does not exist', async () => {
      mockedRNFS.exists.mockResolvedValue(false);
      expect(await whisperService.isModelDownloaded('tiny.en')).toBe(false);
    });
  });

  // ========================================================================
  // downloadModel
  // ========================================================================
  describe('downloadModel', () => {
    it('throws for unknown model ID', async () => {
      await expect(whisperService.downloadModel('nonexistent')).rejects.toThrow('Unknown model');
    });

    it('returns existing path if already downloaded', async () => {
      mockedRNFS.exists.mockResolvedValue(true);

      const result = await whisperService.downloadModel('tiny.en');

      expect(result).toBe('/mock/documents/whisper-models/ggml-tiny.en.bin');
      expect(mockedBDS.downloadFileTo).not.toHaveBeenCalled();
    });

    it('downloads via backgroundDownloadService when not present', async () => {
      mockedRNFS.exists
        .mockResolvedValueOnce(true)  // dir exists
        .mockResolvedValueOnce(false) // model not yet downloaded
        .mockResolvedValueOnce(true); // validateModelFile: file exists
      mockedRNFS.stat.mockResolvedValueOnce({ size: 75 * 1024 * 1024, isFile: () => true } as any);

      mockedBDS.downloadFileTo.mockReturnValue({
        downloadId: 1,
        downloadIdPromise: Promise.resolve(1),
        promise: Promise.resolve(),
      } as any);

      const result = await whisperService.downloadModel('tiny.en');

      expect(mockedBDS.downloadFileTo).toHaveBeenCalledWith(expect.objectContaining({
        params: expect.objectContaining({ url: WHISPER_MODELS[0].url }),
        destPath: '/mock/documents/whisper-models/ggml-tiny.en.bin',
      }));
      expect(result).toBe('/mock/documents/whisper-models/ggml-tiny.en.bin');
    });

    it('calls progress callback', async () => {
      mockedRNFS.exists
        .mockResolvedValueOnce(true)  // dir exists
        .mockResolvedValueOnce(false) // model doesn't exist
        .mockResolvedValueOnce(true); // validateModelFile: file exists
      mockedRNFS.stat.mockResolvedValueOnce({ size: 75 * 1024 * 1024, isFile: () => true } as any);

      let capturedOnProgress: ((b: number, t: number) => void) | undefined;
      mockedBDS.downloadFileTo.mockImplementation((opts: any) => {
        capturedOnProgress = opts.onProgress;
        return {
          downloadId: 1,
          downloadIdPromise: Promise.resolve(1),
          promise: Promise.resolve(),
        } as any;
      });

      const progressCb = jest.fn();
      await whisperService.downloadModel('tiny.en', progressCb);

      if (capturedOnProgress) {
        capturedOnProgress(37500000, 75000000);
        expect(progressCb).toHaveBeenCalledWith(0.5);
      }
    });

    it('cleans up partial file and rethrows when download fails', async () => {
      mockedRNFS.exists
        .mockResolvedValueOnce(true)  // dir exists
        .mockResolvedValueOnce(false); // model not yet downloaded
      mockedRNFS.unlink.mockResolvedValue(undefined as any);

      mockedBDS.downloadFileTo.mockReturnValue({
        downloadId: 1,
        downloadIdPromise: Promise.resolve(1),
        promise: Promise.reject(new Error('network_lost')),
      } as any);

      await expect(whisperService.downloadModel('tiny.en')).rejects.toThrow('network_lost');
      expect(RNFS.unlink).toHaveBeenCalledWith('/mock/documents/whisper-models/ggml-tiny.en.bin');
    });
  });

  // ========================================================================
  // deleteModel
  // ========================================================================
  describe('deleteModel', () => {
    it('deletes file when it exists', async () => {
      mockedRNFS.exists.mockResolvedValue(true);

      await whisperService.deleteModel('tiny.en');

      expect(RNFS.unlink).toHaveBeenCalledWith('/mock/documents/whisper-models/ggml-tiny.en.bin');
    });

    it('does nothing when file does not exist', async () => {
      mockedRNFS.exists.mockResolvedValue(false);

      await whisperService.deleteModel('tiny.en');

      expect(RNFS.unlink).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // validateModelFile
  // ========================================================================
  describe('validateModelFile', () => {
    it('throws when path is empty', async () => {
      await expect(whisperService.validateModelFile('')).rejects.toThrow('empty or undefined');
    });

    it('throws when file does not exist', async () => {
      mockedRNFS.exists.mockResolvedValue(false);

      await expect(whisperService.validateModelFile('/missing/model.bin')).rejects.toThrow('not found');
    });

    it('throws and deletes file when file is too small (corrupted)', async () => {
      mockedRNFS.exists.mockResolvedValue(true);
      mockedRNFS.stat.mockResolvedValue({ size: 1000, isFile: () => true } as any);
      mockedRNFS.unlink.mockResolvedValue(undefined as any);

      await expect(whisperService.validateModelFile('/path/model.bin')).rejects.toThrow('too small');
      expect(RNFS.unlink).toHaveBeenCalledWith('/path/model.bin');
    });

    it('passes for valid file with sufficient size', async () => {
      mockedRNFS.exists.mockResolvedValue(true);
      mockedRNFS.stat.mockResolvedValue({ size: 75 * 1024 * 1024, isFile: () => true } as any);

      await expect(whisperService.validateModelFile('/path/model.bin')).resolves.toBeUndefined();
    });
  });

  // ========================================================================
  // loadModel
  // ========================================================================
  describe('loadModel', () => {
    it('calls initWhisper with file path', async () => {
      mockValidModelFile();
      const mockContext = {
        id: 'test-whisper',
        release: jest.fn(),
        transcribeRealtime: jest.fn(),
        transcribe: jest.fn(),
      };
      mockedInitWhisper.mockResolvedValue(mockContext as any);

      await whisperService.loadModel('/path/to/model.bin');

      expect(initWhisper).toHaveBeenCalledWith({ filePath: '/path/to/model.bin' });
      expect(whisperService.isModelLoaded()).toBe(true);
      expect(whisperService.getLoadedModelPath()).toBe('/path/to/model.bin');
    });

    it('unloads different model before loading new one', async () => {
      mockValidModelFile();
      const mockContext1 = {
        id: 'ctx1',
        release: jest.fn(() => Promise.resolve()),
        transcribeRealtime: jest.fn(),
        transcribe: jest.fn(),
      };
      const mockContext2 = {
        id: 'ctx2',
        release: jest.fn(() => Promise.resolve()),
        transcribeRealtime: jest.fn(),
        transcribe: jest.fn(),
      };

      mockedInitWhisper.mockResolvedValueOnce(mockContext1 as any);
      await whisperService.loadModel('/path/model1.bin');

      mockedInitWhisper.mockResolvedValueOnce(mockContext2 as any);
      await whisperService.loadModel('/path/model2.bin');

      expect(mockContext1.release).toHaveBeenCalled();
      expect(whisperService.getLoadedModelPath()).toBe('/path/model2.bin');
    });

    it('skips loading if same model already loaded', async () => {
      mockValidModelFile();
      const mockContext = {
        id: 'ctx',
        release: jest.fn(),
        transcribeRealtime: jest.fn(),
        transcribe: jest.fn(),
      };
      mockedInitWhisper.mockResolvedValueOnce(mockContext as any);

      await whisperService.loadModel('/path/model.bin');
      await whisperService.loadModel('/path/model.bin');

      expect(initWhisper).toHaveBeenCalledTimes(1);
    });

    it('throws on initWhisper failure and clears context', async () => {
      mockValidModelFile();
      mockedInitWhisper.mockRejectedValue(new Error('Load failed'));

      await expect(whisperService.loadModel('/bad/model.bin')).rejects.toThrow('Load failed');
      expect(whisperService.isModelLoaded()).toBe(false);
      expect(whisperService.getLoadedModelPath()).toBeNull();
    });

    it('throws when model file is missing (prevents native crash)', async () => {
      mockedRNFS.exists.mockResolvedValue(false);

      await expect(whisperService.loadModel('/missing/model.bin')).rejects.toThrow('not found');
      expect(initWhisper).not.toHaveBeenCalled();
    });

    it('throws when model file is corrupted/too small (prevents native crash)', async () => {
      mockedRNFS.exists.mockResolvedValue(true);
      mockedRNFS.stat.mockResolvedValue({ size: 500, isFile: () => true } as any);
      mockedRNFS.unlink.mockResolvedValue(undefined as any);

      await expect(whisperService.loadModel('/corrupted/model.bin')).rejects.toThrow('too small');
      expect(initWhisper).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // unloadModel
  // ========================================================================
  describe('unloadModel', () => {
    it('releases context and clears state', async () => {
      mockValidModelFile();
      const mockContext = {
        id: 'ctx',
        release: jest.fn(() => Promise.resolve()),
        transcribeRealtime: jest.fn(),
        transcribe: jest.fn(),
      };
      mockedInitWhisper.mockResolvedValueOnce(mockContext as any);
      await whisperService.loadModel('/path/model.bin');

      await whisperService.unloadModel();

      expect(mockContext.release).toHaveBeenCalled();
      expect(whisperService.isModelLoaded()).toBe(false);
      expect(whisperService.getLoadedModelPath()).toBeNull();
    });

    it('does nothing when no model loaded', async () => {
      await whisperService.unloadModel(); // Should not throw
      expect(whisperService.isModelLoaded()).toBe(false);
    });
  });

  // ========================================================================
  // requestPermissions
  // ========================================================================
  describe('requestPermissions', () => {
    const originalOS = Platform.OS;

    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { get: () => originalOS });
    });


    describe('iOS', () => {
      beforeEach(() => {
        Object.defineProperty(Platform, 'OS', { get: () => 'ios' });
      });

      it('configures audio session and returns true', async () => {
        expect(await whisperService.requestPermissions()).toBe(true);

        expect(mockedAudioSessionIos.setCategory).toHaveBeenCalledWith(
          'PlayAndRecord',
          ['AllowBluetooth', 'MixWithOthers']
        );
        expect(mockedAudioSessionIos.setMode).toHaveBeenCalledWith('Default');
        expect(mockedAudioSessionIos.setActive).toHaveBeenCalledWith(true);
      });

      it('calls setCategory before setMode before setActive', async () => {
        const callOrder: string[] = [];
        mockedAudioSessionIos.setCategory.mockImplementation(async () => { callOrder.push('setCategory'); });
        mockedAudioSessionIos.setMode.mockImplementation(async () => { callOrder.push('setMode'); });
        mockedAudioSessionIos.setActive.mockImplementation(async () => { callOrder.push('setActive'); });

        await whisperService.requestPermissions();

        expect(callOrder).toEqual(['setCategory', 'setMode', 'setActive']);
      });

      it('returns false when audio session setup fails', async () => {
        mockedAudioSessionIos.setCategory.mockRejectedValue(new Error('Audio session error'));

        expect(await whisperService.requestPermissions()).toBe(false);
      });

      it('returns false when setActive fails (permission denied)', async () => {
        mockedAudioSessionIos.setActive.mockRejectedValue(new Error('Microphone permission denied'));

        expect(await whisperService.requestPermissions()).toBe(false);
      });


    });
  });

  // ========================================================================
  // startRealtimeTranscription
  // ========================================================================
  describe('startRealtimeTranscription', () => {
    const originalOS = Platform.OS;

    beforeEach(() => {
      // Most tests in this block need a loaded model, which requires valid file mocks
      mockValidModelFile();
    });

    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { get: () => originalOS });
    });

    it('throws when no model loaded', async () => {
      await expect(
        whisperService.startRealtimeTranscription(jest.fn())
      ).rejects.toThrow('No Whisper model loaded');
    });

    it('stops existing transcription before starting new one', async () => {
      // Set up a loaded model
      const mockStop = jest.fn();
      const mockContext = {
        id: 'ctx',
        release: jest.fn(),
        transcribeRealtime: jest.fn(() => Promise.resolve({
          stop: mockStop,
          subscribe: jest.fn(),
        })),
        transcribe: jest.fn(),
      };
      mockedInitWhisper.mockResolvedValueOnce(mockContext as any);
      await whisperService.loadModel('/path/model.bin');

      // Simulate existing transcription
      (whisperService as any).isTranscribing = true;
      (whisperService as any).stopFn = jest.fn();

      Object.defineProperty(Platform, 'OS', { get: () => 'ios' }); // auto-grant permissions

      await whisperService.startRealtimeTranscription(jest.fn());

      // The old stopFn should have been called
      expect((whisperService as any).stopFn).not.toBeNull(); // New stopFn is set
    });

    it('throws when permission denied', async () => {
      const mockContext = {
        id: 'ctx',
        release: jest.fn(),
        transcribeRealtime: jest.fn(),
        transcribe: jest.fn(),
      };
      mockedInitWhisper.mockResolvedValueOnce(mockContext as any);
      await whisperService.loadModel('/path/model.bin');

      mockedAudioSessionIos.setActive.mockRejectedValueOnce(new Error('Microphone permission denied'));

      await expect(
        whisperService.startRealtimeTranscription(jest.fn())
      ).rejects.toThrow('Microphone permission denied');
    });

    it('calls transcribeRealtime with correct options', async () => {
      const mockContext = {
        id: 'ctx',
        release: jest.fn(),
        transcribeRealtime: jest.fn(() => Promise.resolve({
          stop: jest.fn(),
          subscribe: jest.fn(),
        })),
        transcribe: jest.fn(),
      };
      mockedInitWhisper.mockResolvedValueOnce(mockContext as any);
      await whisperService.loadModel('/path/model.bin');

      Object.defineProperty(Platform, 'OS', { get: () => 'ios' });

      await whisperService.startRealtimeTranscription(jest.fn(), { language: 'fr', maxLen: 100 });

      expect(mockContext.transcribeRealtime).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'fr',
          maxLen: 100,
        })
      );
    });

    it('includes audioSessionOnStartIos options on iOS', async () => {
      const mockContext = {
        id: 'ctx',
        release: jest.fn(),
        transcribeRealtime: jest.fn(() => Promise.resolve({
          stop: jest.fn(),
          subscribe: jest.fn(),
        })),
        transcribe: jest.fn(),
      };
      mockedInitWhisper.mockResolvedValueOnce(mockContext as any);
      await whisperService.loadModel('/path/model.bin');

      Object.defineProperty(Platform, 'OS', { get: () => 'ios' });

      await whisperService.startRealtimeTranscription(jest.fn());

      expect(mockContext.transcribeRealtime).toHaveBeenCalledWith(
        expect.objectContaining({
          audioSessionOnStartIos: expect.objectContaining({
            category: 'PlayAndRecord',
            options: ['AllowBluetooth', 'MixWithOthers'],
            mode: 'Default',
          }),
          audioSessionOnStopIos: 'restore',
        })
      );
    });


    it('forwards events to callback via subscribe', async () => {
      let subscribeFn: any;
      const mockContext = {
        id: 'ctx',
        release: jest.fn(),
        transcribeRealtime: jest.fn(() => Promise.resolve({
          stop: jest.fn(),
          subscribe: (fn: any) => { subscribeFn = fn; },
        })),
        transcribe: jest.fn(),
      };
      mockedInitWhisper.mockResolvedValueOnce(mockContext as any);
      await whisperService.loadModel('/path/model.bin');

      Object.defineProperty(Platform, 'OS', { get: () => 'ios' });

      const resultCb = jest.fn();
      await whisperService.startRealtimeTranscription(resultCb);

      // Simulate event from subscribe
      subscribeFn({
        isCapturing: true,
        data: { result: 'hello world' },
        processTime: 100,
        recordingTime: 200,
      });

      expect(resultCb).toHaveBeenCalledWith({
        text: 'hello world',
        isCapturing: true,
        processTime: 100,
        recordingTime: 200,
      });
    });
  });

  // ========================================================================
  // stopTranscription
  // ========================================================================
  describe('stopTranscription', () => {
    it('calls stored stop function', async () => {
      const mockStopFn = jest.fn();
      (whisperService as any).stopFn = mockStopFn;
      (whisperService as any).isTranscribing = true;
      // Context must exist for stopFn to be called (guard against SIGSEGV on freed context)
      (whisperService as any).context = { release: jest.fn() };

      await whisperService.stopTranscription();

      expect(mockStopFn).toHaveBeenCalled();
      expect(whisperService.isCurrentlyTranscribing()).toBe(false);
    });

    it('skips stopFn when context is already released', async () => {
      const mockStopFn = jest.fn();
      (whisperService as any).stopFn = mockStopFn;
      (whisperService as any).isTranscribing = true;
      (whisperService as any).context = null; // Context already freed

      await whisperService.stopTranscription();

      expect(mockStopFn).not.toHaveBeenCalled();
      expect(whisperService.isCurrentlyTranscribing()).toBe(false);
    });

    it('handles error in stop function gracefully', async () => {
      (whisperService as any).stopFn = () => { throw new Error('stop error'); };
      (whisperService as any).isTranscribing = true;
      (whisperService as any).context = { release: jest.fn() };

      await whisperService.stopTranscription(); // Should not throw

      expect(whisperService.isCurrentlyTranscribing()).toBe(false);
    });

    it('is safe to call when not transcribing', async () => {
      await whisperService.stopTranscription(); // Should not throw
      expect(whisperService.isCurrentlyTranscribing()).toBe(false);
    });
  });

  // ========================================================================
  // transcribeFile
  // ========================================================================
  describe('transcribeFile', () => {
    it('does not let an old file completion clear a newer transcription', async () => {
      mockValidModelFile();
      let finishOld!: (result: any) => void;
      let finishNew!: (result: any) => void;
      const stopOld = jest.fn();
      const stopNew = jest.fn();
      let signalNew!: () => void;
      const startedNew = new Promise<void>(resolve => { signalNew = resolve; });
      const transcribe = jest.fn()
        .mockReturnValueOnce({promise:new Promise(resolve => {finishOld=resolve;}),stop:stopOld})
        .mockImplementationOnce(() => { signalNew(); return {promise:new Promise(resolve => {finishNew=resolve;}),stop:stopNew}; });
      mockedInitWhisper.mockResolvedValueOnce({release:jest.fn(),transcribe} as any);
      await whisperService.loadModel('/model.bin');
      const old = whisperService.transcribeFile('/old.wav');
      await Promise.resolve();
      await whisperService.stopTranscription();
      const current = whisperService.transcribeFile('/new.wav');
      finishOld({result:'old'}); await old; await startedNew;
      expect(whisperService.isCurrentlyTranscribing()).toBe(true);
      await whisperService.stopTranscription();
      expect(stopNew).toHaveBeenCalledTimes(1);
      finishNew({result:'new'}); await current;
    });

    it('throws when no model loaded', async () => {
      await expect(
        whisperService.transcribeFile('/path/to/audio.wav')
      ).rejects.toThrow('No Whisper model loaded');
    });

    it('returns transcription result', async () => {
      mockValidModelFile();
      const mockContext = {
        id: 'ctx',
        release: jest.fn(),
        transcribeRealtime: jest.fn(),
        transcribe: jest.fn(() => ({
          promise: Promise.resolve({ result: 'transcribed text' }),
        })),
      };
      mockedInitWhisper.mockResolvedValueOnce(mockContext as any);
      await whisperService.loadModel('/path/model.bin');

      const result = await whisperService.transcribeFile('/audio.wav');

      expect(result).toBe('transcribed text');
      expect(mockContext.transcribe).toHaveBeenCalledWith('/audio.wav', expect.objectContaining({
        language: 'auto',
      }));
    });
  });

  // ========================================================================
  // forceReset
  // ========================================================================
  describe('forceReset', () => {
    it('resets transcription state', () => {
      (whisperService as any).isTranscribing = true;
      (whisperService as any).stopFn = jest.fn();

      whisperService.forceReset();

      expect(whisperService.isCurrentlyTranscribing()).toBe(false);
    });

    it('calls native stopFn when context exists (prevents SIGSEGV)', () => {
      const mockStopFn = jest.fn();
      (whisperService as any).isTranscribing = true;
      (whisperService as any).stopFn = mockStopFn;
      (whisperService as any).context = { release: jest.fn() };

      whisperService.forceReset();

      expect(mockStopFn).toHaveBeenCalled();
      expect(whisperService.isCurrentlyTranscribing()).toBe(false);
    });

    it('does not call stopFn when context is null (prevents SIGSEGV on freed context)', () => {
      const mockStopFn = jest.fn();
      (whisperService as any).isTranscribing = true;
      (whisperService as any).stopFn = mockStopFn;
      (whisperService as any).context = null;

      whisperService.forceReset();

      expect(mockStopFn).not.toHaveBeenCalled();
      expect(whisperService.isCurrentlyTranscribing()).toBe(false);
    });

    it('handles stopFn error gracefully during forceReset', () => {
      (whisperService as any).isTranscribing = true;
      (whisperService as any).stopFn = () => { throw new Error('stop error'); };
      (whisperService as any).context = { release: jest.fn() };

      // Should not throw
      whisperService.forceReset();

      expect(whisperService.isCurrentlyTranscribing()).toBe(false);
    });
  });

  // ========================================================================
  // stopTranscription — double-stop race condition fix
  // ========================================================================
  describe('stopTranscription race condition', () => {
    it('prevents double-stop by atomically clearing stopFn', async () => {
      const mockStopFn = jest.fn();
      (whisperService as any).isTranscribing = true;
      (whisperService as any).stopFn = mockStopFn;
      (whisperService as any).context = { release: jest.fn() };

      // Call stopTranscription twice concurrently (simulates trailing audio + clearResult race)
      await Promise.all([
        whisperService.stopTranscription(),
        whisperService.stopTranscription(),
      ]);

      // Native stop should only be called once, not twice
      expect(mockStopFn).toHaveBeenCalledTimes(1);
    });

    it('clears stopFn before calling it to prevent reentry', async () => {
      let stopFnDuringCall: any = 'not-checked';
      const mockStopFn = jest.fn(() => {
        // Check that stopFn is already null while this is executing
        stopFnDuringCall = (whisperService as any).stopFn;
      });
      (whisperService as any).isTranscribing = true;
      (whisperService as any).stopFn = mockStopFn;
      (whisperService as any).context = { release: jest.fn() };

      await whisperService.stopTranscription();

      expect(mockStopFn).toHaveBeenCalled();
      expect(stopFnDuringCall).toBeNull();
    });
  });
});

 describe('Whisper language policy', () => {
  it('uses automatic language detection for multilingual models', () => {
    expect(whisperLanguage('/ggml-base.bin')).toBe('auto');
    expect(whisperLanguage('/ggml-base.bin','ru')).toBe('ru');
  });
  it('uses English for English-only models and rejects incompatible requests', () => {
    expect(whisperLanguage('/ggml-tiny.en.bin')).toBe('en');
    expect(whisperLanguage('/ggml-tiny.en.bin','en-US')).toBe('en');
    expect(() => whisperLanguage('/ggml-tiny.en.bin','es')).toThrow('multilingual');
  });
});


it('uses actual model metadata ahead of imported filenames for speech language',()=>{
 expect(whisperLanguage('/renamed.bin',undefined,false)).toBe('en');
 expect(()=>whisperLanguage('/renamed.bin','ru',false)).toThrow('English only');
 expect(whisperLanguage('/renamed.en.bin','ru',true)).toBe('ru');
 expect(whisperLanguage('/renamed.en.bin',undefined,true)).toBe('auto');
});
