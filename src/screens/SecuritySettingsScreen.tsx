import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { Button } from '../components/Button';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../components';
import { CustomAlert, hideAlert, AlertState, initialAlertState } from '../components/CustomAlert';
import { useTheme, useThemedStyles } from '../theme';
import type { ThemeColors, ThemeShadows } from '../theme';
import { TYPOGRAPHY, SPACING } from '../constants';
import { useAuthStore } from '../stores';
import { authService } from '../services/authService';
import { PassphraseSetupScreen } from './PassphraseSetupScreen';

export const SecuritySettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [showPassphraseSetup, setShowPassphraseSetup] = useState(false);
  const [action, setAction] = useState<'set' | 'change' | 'disable' | 'biometric'>('set');
  const [biometricName, setBiometricName] = useState<string | null>(null);
  useEffect(() => { authService.biometricName().then(setBiometricName); }, []);
  const [alertState, setAlertState] = useState<AlertState>(initialAlertState);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const {
    isEnabled: authEnabled,
    biometricEnabled, setBiometricEnabled,
  } = useAuthStore();

  const handleTogglePassphrase = () => {
    setAction(authEnabled ? 'disable' : 'set');
    setShowPassphraseSetup(true);
  };
  const handleChangePassphrase = () => { setAction('change'); setShowPassphraseSetup(true); };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button" accessibilityLabel="Back"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} numberOfLines={1} adjustsFontSizeToFit style={styles.title}>Security</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>App Lock</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>PIN lock</Text>
              <Text style={styles.settingHint}>Use a four-digit PIN to open Own</Text>
            </View>
            <Switch
              value={authEnabled}
              onValueChange={handleTogglePassphrase}
              trackColor={{ false: colors.surfaceLight, true: `${colors.primary  }80` }}
              thumbColor={authEnabled ? colors.primary : colors.textMuted}
            />
          </View>

          {authEnabled && biometricName && <View style={styles.settingRow}>
            <View style={styles.settingInfo}><Text style={styles.settingLabel}>{biometricName}</Text><Text style={styles.settingHint}>Use your PIN as a fallback</Text></View>
            <Switch accessibilityLabel={`Unlock with ${biometricName}`} value={biometricEnabled} onValueChange={async enabled => {
              if (enabled) { setAction('biometric'); setShowPassphraseSetup(true); }
              else if (await authService.disableBiometrics()) setBiometricEnabled(false);
            }} />
          </View>}

          {authEnabled && (
            <Button
              title="Change PIN"
              variant="primary"
              size="medium"
              onPress={handleChangePassphrase}
              icon={<Icon name="edit-2" size={16} color={colors.primary} />}
              style={{ alignSelf: 'flex-start' as const, marginTop: SPACING.lg }}
            />
          )}
        </Card>

        <Card style={styles.infoCard}>
          <Icon name="info" size={18} color={colors.textMuted} />
          <Text style={styles.infoText}>
            When enabled, the app will lock automatically when you switch away or close it. Your PIN verifier stays in Keychain. Face ID and Touch ID are handled by iOS; Own does not receive biometric data.
          </Text>
        </Card>
      </ScrollView>

      <Modal
        visible={showPassphraseSetup}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowPassphraseSetup(false)}
      >
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <PassphraseSetupScreen
          action={action}
          onComplete={() => setShowPassphraseSetup(false)}
          onCancel={() => setShowPassphraseSetup(false)}
        />
        </SafeAreaProvider>
      </Modal>
      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onClose={() => setAlertState(hideAlert())}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: ThemeColors, shadows: ThemeShadows) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.small,
    zIndex: 1,
    gap: SPACING.md,
  },
  backButton: {
    padding: SPACING.xs,
  },
  title: {
    ...TYPOGRAPHY.h2,
    flex: 1,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.label,
    textTransform: 'uppercase' as const,
    color: colors.textMuted,
    marginBottom: SPACING.md,
    letterSpacing: 0.3,
  },
  settingRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    ...TYPOGRAPHY.body,
    color: colors.text,
  },
  settingHint: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: SPACING.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
