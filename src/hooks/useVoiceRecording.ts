import { useState, useEffect, useCallback, useRef } from 'react';
import { voiceService } from '../services/voiceService';
import logger from '../utils/logger';

export interface UseVoiceRecordingResult {
  isRecording: boolean;
  isAvailable: boolean;
  partialResult: string;
  finalResult: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => Promise<void>;
  clearResult: () => void;
}

export const useVoiceRecording = (enabled = true): UseVoiceRecordingResult => {
  const [isRecording, setIsRecording] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [partialResult, setPartialResult] = useState('');
  const [finalResult, setFinalResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isCancelled = useRef(false);

  useEffect(() => {
    let subscribed = true;
    isCancelled.current = !enabled;
    if (!enabled) {
      setIsRecording(false);
      setIsAvailable(false);
      setFinalResult('');
      setPartialResult('');
      return;
    }
    const initVoice = async () => {
      logger.log('[Voice] Starting initialization...');

      const hasPermission = await voiceService.requestPermissions();
      logger.log('[Voice] Permission granted:', hasPermission);

      if (hasPermission) {
        const initialized = await voiceService.initialize();
        logger.log('[Voice] Initialized:', initialized);
        if (!subscribed || isCancelled.current) return;
        setIsAvailable(initialized);

        if (!initialized) {
          setError('Voice recognition not available on this device. Check if Google app is installed.');
        }
      } else {
        logger.log('[Voice] Permission denied');
        setIsAvailable(false);
        setError('Microphone permission denied');
      }
    };

    initVoice();

    voiceService.setCallbacks({
      onStart: () => {
        if (!subscribed || isCancelled.current) return;
        setIsRecording(true);
        setError(null);
      },
      onEnd: () => {
        setIsRecording(false);
      },
      onResults: (results) => {
        if (subscribed && !isCancelled.current && results.length > 0) {
          setFinalResult(results[0]);
          setPartialResult('');
        }
      },
      onPartialResults: (results) => {
        if (subscribed && !isCancelled.current && results.length > 0) {
          setPartialResult(results[0]);
        }
      },
      onError: (errorMsg) => {
        if (!subscribed || isCancelled.current) return;
        setError(errorMsg);
        setIsRecording(false);
      },
    });

    return () => {
      subscribed = false;
      isCancelled.current = true;
      voiceService.destroy();
    };
  }, [enabled]);

  const startRecording = useCallback(async () => {
    if (!enabled) return;
    try {
      isCancelled.current = false;
      setError(null);
      setPartialResult('');
      setFinalResult('');
      await voiceService.startListening();
    } catch {
      setError('Failed to start recording');
      setIsRecording(false);
    }
  }, [enabled]);

  const stopRecording = useCallback(async () => {
    try {
      await voiceService.stopListening();
    } catch {
      setError('Failed to stop recording');
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    try {
      isCancelled.current = true;
      setPartialResult('');
      setFinalResult('');
      await voiceService.cancelListening();
      setIsRecording(false);
    } catch {
      setError('Failed to cancel recording');
    }
  }, []);

  const clearResult = useCallback(() => {
    isCancelled.current = true;
    setFinalResult('');
    setPartialResult('');
    setIsRecording(false);
    if (enabled) void voiceService.cancelListening();
  }, [enabled]);

  return {
    isRecording,
    isAvailable,
    partialResult,
    finalResult,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    clearResult,
  };
};
