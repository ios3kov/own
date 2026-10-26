import { NativeModules, Platform } from 'react-native';
import { useAppStore } from '../../../src/stores/appStore';
import { voiceService } from '../../../src/services/voiceService';
const Voice = require('@react-native-voice/voice');

describe('Apple speech opt-in at the actual service boundary', () => {
  const originalOS = Platform.OS;
  beforeEach(() => {
    Platform.OS = 'ios';
    useAppStore.getState().resetSettings();
    NativeModules.Voice = { setCloudRecognitionAllowed: jest.fn().mockResolvedValue(null) };
    Voice.isAvailable.mockResolvedValue(true);
    Voice.start.mockClear();
  });
  afterEach(() => { Platform.OS = originalOS; });
  it('defaults off and never starts Apple speech', async () => {
    expect(useAppStore.getState().settings.allowAppleSpeech).toBe(false);
    await expect(voiceService.startListening()).rejects.toThrow('disabled');
    expect(Voice.start).not.toHaveBeenCalled();
  });
  it('enables the native gate before starting an opted-in request', async () => {
    useAppStore.getState().updateSettings({allowAppleSpeech: true});
    await voiceService.startListening();
    expect(NativeModules.Voice.setCloudRecognitionAllowed).toHaveBeenCalledWith(true);
    expect(Voice.start).toHaveBeenCalledTimes(1);
  });
  it('fails closed if consent is revoked while opening the native gate', async () => {
    useAppStore.getState().updateSettings({allowAppleSpeech: true});
    NativeModules.Voice.setCloudRecognitionAllowed.mockImplementation(async () => {
      useAppStore.getState().updateSettings({allowAppleSpeech: false});
    });
    await expect(voiceService.startListening()).rejects.toThrow('disabled');
    expect(Voice.start).not.toHaveBeenCalled();
  });
  it('fails closed if the patched native module is unavailable', async () => {
    useAppStore.getState().updateSettings({allowAppleSpeech: true});
    delete NativeModules.Voice;
    await expect(voiceService.startListening()).rejects.toThrow();
    expect(Voice.start).not.toHaveBeenCalled();
  });
});
