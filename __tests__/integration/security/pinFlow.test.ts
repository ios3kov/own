import * as Keychain from 'react-native-keychain';
import { authService } from '../../../src/services/authService';
import { useAuthStore } from '../../../src/stores/authStore';

const entries = new Map<string, {username: string; password: string}>();
describe('PIN and protected biometric credentials', () => {
 beforeEach(() => {
  entries.clear(); useAuthStore.setState({isEnabled:false,isLocked:true,failedAttempts:0,lockoutUntil:null,biometricEnabled:false});
  (Keychain.setGenericPassword as jest.Mock).mockImplementation(async (username,password,options)=>{entries.set(options.service,{username,password});return true;});
  (Keychain.getGenericPassword as jest.Mock).mockImplementation(async options=>entries.get(options.service)||false);
  (Keychain.resetGenericPassword as jest.Mock).mockImplementation(async options=>{entries.delete(options.service);return true;});
  (Keychain.getSupportedBiometryType as jest.Mock).mockResolvedValue(Keychain.BIOMETRY_TYPE.FACE_ID);
 });
 it('uses a salted verifier, retains leading zeroes and rejects incorrect PINs', async () => {
  expect(await authService.setPIN('0284')).toBe(true);
  expect(await authService.getLockKind()).toBe('pin');
  expect(await authService.verifyPassphrase('0284')).toBe(true);
  expect(await authService.verifyPassphrase('284')).toBe(false);
  expect(await authService.verifyPassphrase('0285')).toBe(false);
  expect([...entries.values()][0].password).not.toContain('0284');
 });
 it('validates the exact digit count before writing to Keychain', async () => {
  for (const pin of ['12', '12345', 'abcd', '１２３４']) expect(await authService.setPIN(pin)).toBe(false);
  expect(entries.size).toBe(0);
 });
 it('preserves an old credential when replacement storage fails', async () => {
  await authService.setPassphrase('synthetic-old-passphrase');
  (Keychain.setGenericPassword as jest.Mock).mockResolvedValueOnce(false);
  expect(await authService.setPIN('2846')).toBe(false);
  expect(await authService.getLockKind()).toBe('passphrase');
  expect(await authService.verifyPassphrase('synthetic-old-passphrase')).toBe(true);
 });
 it('requires the current PIN and uses biometric enrollment-bound Keychain storage', async () => {
  await authService.setPIN('2846');
  expect(await authService.enableBiometrics('wrong')).toBe(false);
  expect(await authService.enableBiometrics('2846')).toBe(true);
  expect(Keychain.setGenericPassword).toHaveBeenCalledWith('own_biometric_unlock', expect.any(String), expect.objectContaining({accessControl:Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,accessible:Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY}));
  await authService.setPIN('8462');
  expect(await authService.unlockWithBiometrics()).toBe(false);
 });
 it('keeps the five-attempt lockout through store serialization', () => {
  for(let i=0;i<5;i++)useAuthStore.getState().recordFailedAttempt();
  expect(useAuthStore.getState().checkLockout()).toBe(true);
  expect(useAuthStore.getState().getLockoutRemaining()).toBeGreaterThan(0);
 });
});
