import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SecuritySettingsScreen } from '../../../src/screens/SecuritySettingsScreen';
import { useAuthStore } from '../../../src/stores/authStore';
const mockBiometricName = jest.fn();
jest.mock('../../../src/services/authService', () => ({authService: {
 biometricName: ()=>mockBiometricName(), disableBiometrics: jest.fn().mockResolvedValue(true),
}}));
jest.mock('../../../src/screens/PassphraseSetupScreen', () => ({PassphraseSetupScreen: ({action,onCancel}:any) => {
 const {Text,TouchableOpacity}=require('react-native');return <TouchableOpacity onPress={onCancel}><Text>{`Setup action: ${action}`}</Text></TouchableOpacity>;
}}));
describe('Security options',()=>{
 beforeEach(()=>{useAuthStore.setState({isEnabled:false,biometricEnabled:false});mockBiometricName.mockResolvedValue('Face ID');});
 it('offers a PIN and requests authenticated setup before disabling',async()=>{
  const screen=render(<SecuritySettingsScreen />); await act(async()=>{});
  expect(screen.getByText('PIN lock')).toBeTruthy();
  fireEvent(screen.getByRole('switch'),'valueChange',true);
  expect(screen.getByText('Setup action: set')).toBeTruthy();
 });
 it('uses the supported biometric name and requires an explicit enable action',async()=>{
  useAuthStore.setState({isEnabled:true});mockBiometricName.mockResolvedValue('Touch ID');
  const screen=render(<SecuritySettingsScreen />); await act(async()=>{});
  expect(screen.getByText('Touch ID')).toBeTruthy();
  fireEvent(screen.getByLabelText('Unlock with Touch ID'),'valueChange',true);
  expect(screen.getByText('Setup action: biometric')).toBeTruthy();
 });
 it('hides biometric controls on devices without supported hardware',async()=>{
  mockBiometricName.mockResolvedValue(null);useAuthStore.setState({isEnabled:true});
  const screen=render(<SecuritySettingsScreen />); await act(async()=>{});
  expect(screen.queryByText('Face ID')).toBeNull();expect(screen.queryByText('Touch ID')).toBeNull();
 });
});
