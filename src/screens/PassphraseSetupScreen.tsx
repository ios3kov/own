import React,{ useState } from 'react';
import {
View,
Text,
TextInput,
ScrollView,
KeyboardAvoidingView,TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button,Card } from '../components';
import { CustomAlert,showAlert,hideAlert,AlertState,initialAlertState } from '../components/CustomAlert';
import { useThemedStyles } from '../theme';
import type { ThemeColors,ThemeShadows } from '../theme';
import { TYPOGRAPHY,SPACING } from '../constants';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/authStore';

interface PassphraseSetupScreenProps {
  isChanging?: boolean;
  action?: 'set' | 'change' | 'disable' | 'biometric';
  onComplete: () => void;
  onCancel: () => void;
}

export const PassphraseSetupScreen: React.FC<PassphraseSetupScreenProps> = ({ isChanging = false, action, onComplete, onCancel }) => {
  const mode = action ?? (isChanging ? 'change' : 'set');
  const [current, setCurrent] = useState('');
  const [pin, setPIN] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [alertState, setAlertState] = useState<AlertState>(initialAlertState);
  const styles = useThemedStyles(createStyles);
  const auth = useAuthStore();
  const needsNewPIN = mode === 'set' || mode === 'change';
  const title = mode === 'disable' ? 'Disable app lock' : mode === 'biometric' ? 'Enable biometric unlock' : mode === 'change' ? 'Change PIN' : 'Set up PIN';
  const submit = async () => {
    if (busy || auth.checkLockout()) return;
    if (needsNewPIN && !/^[0-9]{4}$/.test(pin)) { setAlertState(showAlert('Invalid PIN', 'Enter exactly four digits.')); return; }
    if (needsNewPIN && pin !== confirmation) { setAlertState(showAlert('PINs do not match', 'Enter the same four digits twice.')); return; }
    setBusy(true);
    try {
      if (mode !== 'set' && !await authService.verifyPassphrase(current)) {
        auth.recordFailedAttempt();
        setAlertState(showAlert('Incorrect code', 'Enter your current PIN or existing passphrase. Too many attempts cause a five-minute lockout.'));
        return;
      }
      let saved = false;
      if (mode === 'disable') {
        saved = await authService.removePassphrase();
        if (saved) auth.setEnabled(false);
      } else if (mode === 'biometric') {
        saved = await authService.enableBiometrics(current);
        if (saved) auth.setBiometricEnabled(true);
      } else {
        saved = await authService.setPIN(pin);
        if (saved) { auth.setBiometricEnabled(false); auth.setEnabled(true); auth.setLocked(false); }
      }
      if (!saved) { setAlertState(showAlert('Could not save', 'Your current lock stays in place. Please try again.')); return; }
      auth.resetFailedAttempts();
      setCurrent(''); setPIN(''); setConfirmation('');
      onComplete();
    } finally { setBusy(false); }
  };
  return <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
    <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} disabled={busy} accessibilityRole="button"><Text maxFontSizeMultiplier={1.35} style={styles.cancelButton}>Cancel</Text></TouchableOpacity>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.title}>{title}</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <Card style={styles.inputCard}>
          {mode !== 'set' && <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Current PIN or existing passphrase</Text>
            <TextInput accessibilityLabel="Current PIN or existing passphrase" style={styles.input} value={current} onChangeText={setCurrent} secureTextEntry editable={!busy} autoCapitalize="none" autoCorrect={false} />
          </View>}
          {needsNewPIN && <>
            <Text style={styles.inputLabel}>Four-digit PIN</Text>
            <TextInput accessibilityLabel="Four-digit PIN" maxFontSizeMultiplier={1.5} style={styles.input} value={pin} onChangeText={text => setPIN(text.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={4} secureTextEntry editable={!busy} />
            <Text style={styles.inputLabel}>Confirm PIN</Text>
            <TextInput accessibilityLabel="Confirm PIN" maxFontSizeMultiplier={1.5} style={styles.input} value={confirmation} onChangeText={text => setConfirmation(text.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={4} secureTextEntry editable={!busy} />
          </>}
        </Card>
        <Text style={styles.description}>Face ID or Touch ID is optional. You can enable it in Security.</Text>
        <Text style={styles.description}>After five incorrect attempts, wait five minutes. Remember your PIN: there is no online reset. The app lock does not separately encrypt files.</Text>
        <Button title={busy ? 'Saving…' : title} onPress={submit} disabled={busy || (mode !== 'set' && !current) || (needsNewPIN && (!pin || !confirmation))} />
      </ScrollView>
    </KeyboardAvoidingView>
    <CustomAlert visible={alertState.visible} title={alertState.title} message={alertState.message} buttons={alertState.buttons} onClose={() => setAlertState(hideAlert())} />
  </SafeAreaView>;
};

const createStyles = (colors: ThemeColors, _shadows: ThemeShadows) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerSpacer: {
    width: 50,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelButton: {
    ...TYPOGRAPHY.body,
    color: colors.textSecondary,
  },
  title: {
    ...TYPOGRAPHY.h2,
    flex: 1,
    textAlign: 'right' as const,
    marginLeft: SPACING.md,
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },
  iconContainer: {
    alignItems: 'center' as const,
    marginVertical: SPACING.xl,
  },
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  description: {
    ...TYPOGRAPHY.body,
    color: colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: SPACING.xl,
  },
  inputCard: {
    marginBottom: SPACING.xl,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.text,
    marginBottom: SPACING.sm,
  },
  input: {
    ...TYPOGRAPHY.body,
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.md,
    color: colors.text,
  },
  tips: {
    marginBottom: SPACING.xl,
  },
  tipsTitle: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.textSecondary,
    marginBottom: SPACING.sm,
  },
  tipItem: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
  },
  submitButton: {
    marginBottom: 32,
  },
});
