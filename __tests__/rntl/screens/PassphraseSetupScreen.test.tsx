/**
 * PassphraseSetupScreen Tests
 *
 * Tests for the passphrase setup/change screen including:
 * - Title display for new setup vs change mode
 * - Input fields rendering
 * - Cancel button behavior
 * - Form validation (too short, too long, mismatch)
 * - Successful submit for new passphrase
 * - Successful submit for change passphrase
 * - Error states (wrong current passphrase, service failure)
 * - Button disabled while submitting
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

jest.mock('../../../src/components', () => ({
  Card: ({ children, style }: any) => {
    const { View } = require('react-native');
    return <View style={style}>{children}</View>;
  },
  Button: ({ title, onPress, disabled }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} testID={`button-${title}`}>
        <Text>{title}</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock('../../../src/components/Button', () => ({
  Button: ({ title, onPress, disabled }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} testID={`button-${title}`}>
        <Text>{title}</Text>
      </TouchableOpacity>
    );
  },
}));

const mockShowAlert = jest.fn((_t: string, _m: string, _b?: any) => ({
  visible: true,
  title: _t,
  message: _m,
  buttons: _b || [],
}));

jest.mock('../../../src/components/CustomAlert', () => ({
  CustomAlert: ({ visible, title, message }: any) => {
    if (!visible) return null;
    const { View, Text } = require('react-native');
    return (
      <View testID="custom-alert">
        <Text testID="alert-title">{title}</Text>
        <Text testID="alert-message">{message}</Text>
      </View>
    );
  },
  showAlert: (...args: any[]) => (mockShowAlert as any)(...args),
  hideAlert: jest.fn(() => ({ visible: false, title: '', message: '', buttons: [] })),
  initialAlertState: { visible: false, title: '', message: '', buttons: [] },
}));

jest.mock('../../../src/components/AnimatedEntry', () => ({
  AnimatedEntry: ({ children }: any) => children,
}));


import { PassphraseSetupScreen } from '../../../src/screens/PassphraseSetupScreen';
import { useAuthStore } from '../../../src/stores/authStore';
const mockSetPIN = jest.fn();
const mockVerify = jest.fn();
const mockRemove = jest.fn();
const mockEnableBiometrics = jest.fn();
jest.mock('../../../src/services/authService', () => ({ authService: {
  setPIN: (...args: any[]) => mockSetPIN(...args), verifyPassphrase: (...args: any[]) => mockVerify(...args),
  removePassphrase: () => mockRemove(), enableBiometrics: (...args: any[]) => mockEnableBiometrics(...args),
} }));
const fillPIN = (screen: any, pin = '2846', confirm = pin) => {
  fireEvent.changeText(screen.getByLabelText('Four-digit PIN'), pin);
  fireEvent.changeText(screen.getByLabelText('Confirm PIN'), confirm);
};
describe('PIN setup', () => {
 beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({isEnabled:false,isLocked:false,failedAttempts:0,lockoutUntil:null,biometricEnabled:false});
  mockSetPIN.mockResolvedValue(true); mockVerify.mockResolvedValue(true); mockRemove.mockResolvedValue(true); mockEnableBiometrics.mockResolvedValue(true);
 });
 it('saves a confirmed four-digit PIN and enables the lock only after success', async () => {
  const complete=jest.fn(); const screen=render(<PassphraseSetupScreen onComplete={complete} onCancel={jest.fn()} />);
  fillPIN(screen); await act(async()=>fireEvent.press(screen.getByTestId('button-Set up PIN')));
  expect(mockSetPIN).toHaveBeenCalledWith('2846'); expect(complete).toHaveBeenCalled();
  expect(useAuthStore.getState().isEnabled).toBe(true);
 });
 it('rejects too-short and mismatched PINs', async () => {
  const screen=render(<PassphraseSetupScreen onComplete={jest.fn()} onCancel={jest.fn()} />);
  fillPIN(screen,'123'); await act(async()=>fireEvent.press(screen.getByTestId('button-Set up PIN')));
  expect(mockSetPIN).not.toHaveBeenCalled();
  fillPIN(screen,'2846','8462'); await act(async()=>fireEvent.press(screen.getByTestId('button-Set up PIN')));
  expect(mockSetPIN).not.toHaveBeenCalled();
 });
 it('preserves the current lock and input after Keychain failure', async () => {
  mockSetPIN.mockResolvedValue(false); const complete=jest.fn();
  const screen=render(<PassphraseSetupScreen onComplete={complete} onCancel={jest.fn()} />); fillPIN(screen);
  await act(async()=>fireEvent.press(screen.getByTestId('button-Set up PIN')));
  expect(complete).not.toHaveBeenCalled(); expect(useAuthStore.getState().isEnabled).toBe(false);
  expect(screen.getByLabelText('Four-digit PIN').props.value).toBe('2846');
 });
 it('requires the existing credential before replacing a legacy passphrase', async () => {
  mockVerify.mockResolvedValue(false); const screen=render(<PassphraseSetupScreen action="change" onComplete={jest.fn()} onCancel={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText('Current PIN or existing passphrase'),'wrong'); fillPIN(screen);
  await act(async()=>fireEvent.press(screen.getByTestId('button-Change PIN')));
  expect(mockSetPIN).not.toHaveBeenCalled(); expect(useAuthStore.getState().failedAttempts).toBe(1);
 });
 it('does not remove the lock without a valid current credential', async () => {
  mockVerify.mockResolvedValue(false); const screen=render(<PassphraseSetupScreen action="disable" onComplete={jest.fn()} onCancel={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText('Current PIN or existing passphrase'),'wrong');
  await act(async()=>fireEvent.press(screen.getByTestId('button-Disable app lock')));
  expect(mockRemove).not.toHaveBeenCalled();
 });
 it('does not enable biometric preference after cancellation', async () => {
  mockEnableBiometrics.mockResolvedValue(false); const screen=render(<PassphraseSetupScreen action="biometric" onComplete={jest.fn()} onCancel={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText('Current PIN or existing passphrase'),'2846');
  await act(async()=>fireEvent.press(screen.getByTestId('button-Enable biometric unlock')));
  expect(useAuthStore.getState().biometricEnabled).toBe(false);
 });
});
