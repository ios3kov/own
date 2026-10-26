import Voice,{
SpeechResultsEvent,
SpeechErrorEvent,
SpeechStartEvent,
SpeechEndEvent,
} from '@react-native-voice/voice';
import { NativeModules } from 'react-native';
import logger from '../utils/logger';
import { useAppStore } from '../stores/appStore';

export type VoiceEventCallbacks = {
  onStart?: () => void;
  onEnd?: () => void;
  onResults?: (results: string[]) => void;
  onPartialResults?: (results: string[]) => void;
  onError?: (error: string) => void;
};

class VoiceService {
  private isInitialized = false;
  private callbacks: VoiceEventCallbacks = {};

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      logger.log('[VoiceService] Checking availability...');

      // Check if Voice is available
      const available = await Voice.isAvailable();
      logger.log('[VoiceService] Voice.isAvailable():', available);

      if (!available) {
        // Try to get more info about why it's not available
        try {
          const services = await Voice.getSpeechRecognitionServices();
          logger.log('[VoiceService] Available speech services:', services);
        } catch (e) {
          logger.log('[VoiceService] Could not get speech services:', e);
        }
        logger.warn('[VoiceService] Voice recognition is not available on this device');
        return false;
      }

      // Set up event listeners
      Voice.onSpeechStart = this.handleSpeechStart;
      Voice.onSpeechEnd = this.handleSpeechEnd;
      Voice.onSpeechResults = this.handleSpeechResults;
      Voice.onSpeechPartialResults = this.handleSpeechPartialResults;
      Voice.onSpeechError = this.handleSpeechError;

      this.isInitialized = true;
      logger.log('[VoiceService] Initialized successfully');
      return true;
    } catch (error) {
      logger.error('[VoiceService] Failed to initialize:', error);
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    ;
    // iOS handles permissions through Info.plist
    return true;
  }

  setCallbacks(callbacks: VoiceEventCallbacks) {
    this.callbacks = callbacks;
  }

  private handleSpeechStart = (_e: SpeechStartEvent) => {
    this.callbacks.onStart?.();
  };

  private handleSpeechEnd = (_e: SpeechEndEvent) => {
    this.callbacks.onEnd?.();
  };

  private handleSpeechResults = (e: SpeechResultsEvent) => {
    if (e.value) {
      this.callbacks.onResults?.(e.value);
    }
  };

  private handleSpeechPartialResults = (e: SpeechResultsEvent) => {
    if (e.value) {
      this.callbacks.onPartialResults?.(e.value);
    }
  };

  private handleSpeechError = (e: SpeechErrorEvent) => {
    const errorMessage = e.error?.message || 'Unknown error occurred';
    this.callbacks.onError?.(errorMessage);
  };

  async startListening(): Promise<void> {
    try {
      {
        if (useAppStore.getState().settings.allowAppleSpeech !== true) {
          throw new Error('Apple speech is disabled. Enable it in Voice settings.');
        }
        if (!NativeModules.Voice?.setCloudRecognitionAllowed) {
          throw new Error('Apple speech privacy control is unavailable.');
        }
        await NativeModules.Voice.setCloudRecognitionAllowed(true);
        if (useAppStore.getState().settings.allowAppleSpeech !== true) {
          await NativeModules.Voice.setCloudRecognitionAllowed(false);
          throw new Error('Apple speech is disabled.');
        }
      }
      const available = await this.initialize();
      if (!available) throw new Error('Speech recognition is unavailable.');
      if ((useAppStore.getState().settings.allowAppleSpeech !== true)) {
        await NativeModules.Voice.setCloudRecognitionAllowed(false);
        throw new Error('Apple speech is disabled.');
      }
      await Voice.start('en-US');
    } catch (error) {
      logger.error('Failed to start voice recognition:', error);
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    try {
      await Voice.stop();
    } catch (error) {
      logger.error('Failed to stop voice recognition:', error);
      throw error;
    }
  }

  async cancelListening(): Promise<void> {
    try {
      await Voice.cancel();
    } catch (error) {
      logger.error('Failed to cancel voice recognition:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    try {
      await Voice.destroy();
      this.isInitialized = false;
    } catch (error) {
      logger.error('Failed to destroy voice service:', error);
    }
  }

  async isRecognizing(): Promise<boolean> {
    try {
      const result = await Voice.isRecognizing();
      return Boolean(result);
    } catch {
      return false;
    }
  }
}

export const voiceService = new VoiceService();

// Revoke the native capability even if the settings screen changes during recording.
useAppStore.subscribe((state, previous) => {
  if ((previous.settings.allowAppleSpeech) && !state.settings.allowAppleSpeech) {
    NativeModules.Voice?.setCloudRecognitionAllowed?.(false).catch(() => {
      // Native start still defaults closed; stop the existing session as fallback.
      void voiceService.cancelListening();
    });
  }
});
