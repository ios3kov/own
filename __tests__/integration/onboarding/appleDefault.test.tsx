import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeModules } from 'react-native';
import { OnboardingScreen } from '../../../src/screens/OnboardingScreen';
import { useAppStore } from '../../../src/stores/appStore';
import { APPLE_MODEL_ID, foundationModelService } from '../../../src/services/foundationModels';
jest.mock('../../../src/services/networkDiscovery', () => ({ discoverLANServers: jest.fn().mockResolvedValue([]) }));

describe('onboarding preserves the Apple default', () => {
  it.each([true, false])('opens Home without forcing model setup when Apple availability is %s', async available => {
    useAppStore.setState({ activeModelId: null, downloadedModels: [], hasCompletedOnboarding: false });
    NativeModules.OwnFoundationModels = { availability: jest.fn().mockResolvedValue({ available, reason: available ? 'available' : 'modelNotReady' }) };
    await foundationModelService.refreshAvailability(false);
    const replace = jest.fn();
    const screen = render(<OnboardingScreen navigation={{ replace } as any} />);
    fireEvent.press(screen.getByTestId('onboarding-skip'));
    expect(replace).toHaveBeenCalledWith('Main');
    expect(useAppStore.getState().activeModelId).toBe(APPLE_MODEL_ID);
    expect(useAppStore.getState().downloadedModels).toEqual([]);
    screen.unmount();
  });
});
