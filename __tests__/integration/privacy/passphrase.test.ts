import { NativeModules } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { authService } from '../../../src/services/authService';

describe('personal passphrase storage and native bridge', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stores a salted verifier and rejects the former colliding password', async () => {
    let saved = '';
    (Keychain.setGenericPassword as jest.Mock).mockImplementation(async (_name: string, value: string) => {
      saved = value;
      return true;
    });
    (Keychain.getGenericPassword as jest.Mock).mockImplementation(async () => ({ password: saved }));
    expect(await authService.setPassphrase('Aa12345')).toBe(true);
    expect(saved).toMatch(/^pbkdf2-sha256\$600000\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
    expect(saved).not.toContain('Aa12345');
    expect(await authService.verifyPassphrase('Aa12345')).toBe(true);
    expect(await authService.verifyPassphrase('BB12345')).toBe(false);
  });

  it('fails closed when the native crypto module is missing', async () => {
    const original = NativeModules.PrivacyCrypto;
    try {
      NativeModules.PrivacyCrypto = undefined;
      expect(await authService.setPassphrase('new-password')).toBe(false);
      expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
    } finally {
      NativeModules.PrivacyCrypto = original;
    }
  });
});
