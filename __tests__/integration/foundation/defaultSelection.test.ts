import { NativeModules, Platform } from 'react-native';
import { useAppStore } from '../../../src/stores/appStore';
import { foundationModelService, APPLE_MODEL_ID, useFoundationStore } from '../../../src/services/foundationModels';

describe('Apple default and explicit alternative selection', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
    useAppStore.setState({activeModelId: null});
    NativeModules.OwnFoundationModels = { availability: jest.fn().mockResolvedValue({available: true, reason: 'available'}) };
  });
  it('selects the built-in Apple model without downloading anything', async () => {
    await foundationModelService.refreshAvailability();
    expect(useAppStore.getState().activeModelId).toBe(APPLE_MODEL_ID);
    expect(useFoundationStore.getState().availability.available).toBe(true);
    expect(Object.keys(NativeModules.OwnFoundationModels)).toEqual(['availability']);
  });
  it.each(['modelNotReady','deviceNotEligible','appleIntelligenceNotEnabled','unsupportedOS'])('does not choose or download a fallback for %s', async reason => {
    NativeModules.OwnFoundationModels.availability.mockResolvedValue({available: false, reason});
    await foundationModelService.refreshAvailability();
    expect(useAppStore.getState().activeModelId).toBe(APPLE_MODEL_ID);
    expect(useFoundationStore.getState().availability).toEqual({available: false, reason});
  });
  it('preserves the user-selected downloaded model when Apple becomes available', async () => {
    useAppStore.setState({activeModelId: 'chosen-gguf'});
    await foundationModelService.refreshAvailability();
    expect(useAppStore.getState().activeModelId).toBe('chosen-gguf');
  });
  it('does not overwrite a selection made while the native check is pending', async () => {
    NativeModules.OwnFoundationModels.availability.mockImplementation(async () => {
      useAppStore.setState({activeModelId: 'chosen-during-check'});
      return {available: true, reason: 'available'};
    });
    await foundationModelService.refreshAvailability();
    expect(useAppStore.getState().activeModelId).toBe('chosen-during-check');
  });
  it('shares overlapping native checks while retaining each caller selection rule', async () => {
    let finish!: (status: {available:boolean; reason:string}) => void;
    NativeModules.OwnFoundationModels.availability.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
    const first = foundationModelService.refreshAvailability(true);
    const second = foundationModelService.refreshAvailability(() => true);
    expect(NativeModules.OwnFoundationModels.availability).toHaveBeenCalledTimes(1);
    finish({available:true,reason:'available'});
    await Promise.all([first,second]);
    expect(useAppStore.getState().activeModelId).toBeNull();
    NativeModules.OwnFoundationModels.availability.mockResolvedValue({available:false,reason:'modelNotReady'});
    expect((await foundationModelService.refreshAvailability()).available).toBe(false);
    expect(NativeModules.OwnFoundationModels.availability).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().activeModelId).toBe(APPLE_MODEL_ID);
  });
  it('fails closed when the native bridge fails', async () => {
    NativeModules.OwnFoundationModels.availability.mockRejectedValue(new Error('native failure'));
    await foundationModelService.refreshAvailability();
    expect(useFoundationStore.getState().availability).toEqual({available: false, reason: 'checkFailed'});
    expect(useAppStore.getState().activeModelId).toBe(APPLE_MODEL_ID);
  });
});
