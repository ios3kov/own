import { replySpeech } from '../../services/replySpeech';
import { useEffect, useRef } from 'react';
import { useWhisperTranscription } from '../../hooks/useWhisperTranscription';
import { Platform } from 'react-native';
import { useVoiceRecording } from '../../hooks/useVoiceRecording';
import { useAppStore, useWhisperStore } from '../../stores';

interface UseVoiceInputParams {
  conversationId?: string | null;
  onTranscript: (text: string) => void;
}

export function useVoiceInput({ conversationId, onTranscript }: UseVoiceInputParams) {
  const recordingRequestRef = useRef(0);
  const recordingConversationIdRef = useRef<string | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const { downloadedModelId } = useWhisperStore();

  const appleEnabled = useAppStore(s => s.settings.allowAppleSpeech) && Platform.OS === 'ios';
  const apple = useVoiceRecording(appleEnabled);
  const whisper = useWhisperTranscription();
  const selected = appleEnabled ? {
    ...apple, isModelLoading: false, isTranscribing: false,
  } : whisper;
  const {
    isRecording,
    isModelLoading,
    isTranscribing,
    partialResult,
    finalResult,
    error,
    startRecording: startRecordingBase,
    stopRecording,
    clearResult,
  } = selected;

  const clearWhisper = whisper.clearResult;
  const clearApple = apple.clearResult;
  const voiceAvailable = appleEnabled ? apple.isAvailable : !!downloadedModelId;

  useEffect(() => {
    recordingConversationIdRef.current = null;
    if (appleEnabled) clearWhisper();
    else clearApple();
  }, [appleEnabled, clearWhisper, clearApple]);

  useEffect(() => () => { recordingRequestRef.current += 1; }, [conversationId, appleEnabled]);

  const startRecording = async () => {
    const request = ++recordingRequestRef.current;
    recordingConversationIdRef.current = conversationId || null;
    await replySpeech.stop();
    if (recordingRequestRef.current !== request) return;
    await startRecordingBase();
  };

  useEffect(() => {
    if (recordingConversationIdRef.current && recordingConversationIdRef.current !== conversationId) {
      clearResult();
      recordingConversationIdRef.current = null;
    }
  }, [conversationId, clearResult]);

  useEffect(() => {
    if (finalResult) {
      if (!recordingConversationIdRef.current || recordingConversationIdRef.current === conversationId) {
        onTranscriptRef.current(finalResult);
      }
      clearResult();
      recordingConversationIdRef.current = null;
    }
  }, [finalResult, clearResult, conversationId]);

  return { isRecording, isModelLoading, isTranscribing, partialResult, error, voiceAvailable, startRecording, stopRecording, clearResult };
}
