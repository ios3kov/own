import { NativeModules, Platform } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { useVoiceInput } from '../../../src/components/ChatInput/Voice';
import { useAppStore } from '../../../src/stores/appStore';

const mockStart = jest.fn().mockResolvedValue(undefined);
const mockClear = jest.fn();
const mockAppleClear = jest.fn();
jest.mock('../../../src/hooks/useWhisperTranscription', () => ({useWhisperTranscription: () => ({
  isRecording:false, isModelLoading:false, isTranscribing:false, partialResult:'', finalResult:null,
  error:null, startRecording:mockStart, stopRecording:jest.fn(), clearResult:mockClear,
})}));
jest.mock('../../../src/hooks/useVoiceRecording', () => ({useVoiceRecording: () => ({clearResult:mockAppleClear})}));

describe('speech to microphone handoff', () => {
  let stopped: () => void;
  beforeEach(() => {
    jest.clearAllMocks(); Platform.OS = 'ios'; useAppStore.getState().updateSettings({allowAppleSpeech:false});
    NativeModules.OwnReplySpeech = {stop: jest.fn(() => new Promise<void>(resolve => { stopped = resolve; }))};
  });
  it('waits for native speech to stop before starting the microphone', async () => {
    const {result} = renderHook(() => useVoiceInput({conversationId:'one', onTranscript:jest.fn()}));
    let pending!: Promise<void>;
    act(() => { pending = result.current.startRecording(); });
    expect(mockStart).not.toHaveBeenCalled();
    await act(async () => { stopped(); await pending; });
    expect(mockStart).toHaveBeenCalledTimes(1);
  });
  it('does not start a pending microphone request in another conversation', async () => {
    const {result, rerender} = renderHook<ReturnType<typeof useVoiceInput>, {id:string}>(({id}) => useVoiceInput({conversationId:id, onTranscript:jest.fn()}), {initialProps:{id:'one'}});
    let pending!: Promise<void>;
    act(() => { pending = result.current.startRecording(); });
    rerender({id:'two'});
    await act(async () => { stopped(); await pending; });
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockClear).toHaveBeenCalled();
  });
  it('does not start a pending microphone request after unmount', async () => {
    const {result, unmount} = renderHook(() => useVoiceInput({conversationId:'one', onTranscript:jest.fn()}));
    let pending!: Promise<void>;
    act(() => { pending = result.current.startRecording(); });
    unmount();
    await act(async () => { stopped(); await pending; });
    expect(mockStart).not.toHaveBeenCalled();
  });
});
