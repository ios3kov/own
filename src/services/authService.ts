import { NativeModules } from 'react-native';
import * as Keychain from 'react-native-keychain';
import logger from '../utils/logger';

const SERVICE_NAME = 'io.github.ios3kov.own.auth';
const PASSPHRASE_KEY = 'passphrase_hash';
const BIOMETRIC_SERVICE = `${SERVICE_NAME}.biometric`;

class AuthService {
  async getLockKind(): Promise<'pin' | 'passphrase'> {
    const credentials = await Keychain.getGenericPassword({ service: SERVICE_NAME });
    return credentials && credentials.username === 'pin_verifier' ? 'pin' : 'passphrase';
  }

  async setPIN(pin: string): Promise<boolean> {
    if (!/^[0-9]{4}$/.test(pin)) return false;
    try {
      const verifier = await NativeModules.PrivacyCrypto.createVerifier(pin);
      const saved = await Keychain.setGenericPassword('pin_verifier', verifier, {
        service: SERVICE_NAME, accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      if (saved) await this.disableBiometrics();
      return !!saved;
    } catch { return false; }
  }

  async biometricName(): Promise<'Face ID' | 'Touch ID' | null> {
    try {
      const type = await Keychain.getSupportedBiometryType();
      if (type === Keychain.BIOMETRY_TYPE.FACE_ID) return 'Face ID';
      if (type === Keychain.BIOMETRY_TYPE.TOUCH_ID) return 'Touch ID';
      return null;
    } catch { return null; }
  }

  async enableBiometrics(pin: string): Promise<boolean> {
    if (!await this.verifyPassphrase(pin) || !await this.biometricName()) return false;
    try {
      const token = await NativeModules.PrivacyCrypto.createVerifier(pin);
      const saved = await Keychain.setGenericPassword('own_biometric_unlock', token, {
        service: BIOMETRIC_SERVICE, accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      });
      if (!saved) return false;
      if (await this.unlockWithBiometrics()) return true;
      await this.disableBiometrics();
      return false;
    } catch { await this.disableBiometrics(); return false; }
  }

  async unlockWithBiometrics(): Promise<boolean> {
    try {
      const credentials = await Keychain.getGenericPassword({ service: BIOMETRIC_SERVICE,
        authenticationPrompt: { title: 'Unlock Own', cancel: 'Use PIN' },
      });
      return !!credentials && credentials.username === 'own_biometric_unlock';
    } catch { return false; }
  }

  async disableBiometrics(): Promise<boolean> {
    try { return await Keychain.resetGenericPassword({ service: BIOMETRIC_SERVICE }); }
    catch { return false; }
  }

  async setPassphrase(passphrase: string): Promise<boolean> {
    try {
      const hash: string = await NativeModules.PrivacyCrypto.createVerifier(passphrase);
      const stored=await Keychain.setGenericPassword(PASSPHRASE_KEY, hash, {
        service: SERVICE_NAME,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
      });
      return !!stored;
    } catch (error) {
      logger.error('Failed to set passphrase:', error);
      return false;
    }
  }

  async verifyPassphrase(passphrase: string): Promise<boolean> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: SERVICE_NAME,
      });

      if (!credentials) {
        return false;
      }

      return await NativeModules.PrivacyCrypto.verifyPassphrase(passphrase, credentials.password);
    } catch (error) {
      logger.error('Failed to verify passphrase:', error);
      return false;
    }
  }

  async hasPassphrase(): Promise<boolean> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: SERVICE_NAME,
      });
      return credentials !== false;
    } catch (error) {
      logger.error('Failed to check passphrase:', error);
      return false;
    }
  }

  async removePassphrase(): Promise<boolean> {
    try {
      const removed = await Keychain.resetGenericPassword({ service: SERVICE_NAME });
      await this.disableBiometrics();
      return removed;
    } catch (error) {
      logger.error('Failed to remove passphrase:', error);
      return false;
    }
  }

  async changePassphrase(oldPassphrase: string, newPassphrase: string): Promise<boolean> {
    const isValid = await this.verifyPassphrase(oldPassphrase);
    if (!isValid) {
      return false;
    }
    return this.setPassphrase(newPassphrase);
  }
}

export const authService = new AuthService();
