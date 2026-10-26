import React, { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { useTheme } from '../theme';
import { SPACING, TYPOGRAPHY } from '../constants';
import { useAppStore, useRemoteServerStore } from '../stores';
import {
  foundationModelService,
  useFoundationStore,
  APPLE_MODEL_ID,
  APPLE_MODEL_NAME,
  appleAvailabilityMessage,
} from '../services/foundationModels';
import { activeModelService } from '../services/activeModelService';
import { generationService } from '../services/generationService';
import { remoteServerManager } from '../services/remoteServerManager';

export function FoundationModelCard({
  onChooseModel,
}: {
  onChooseModel: () => void;
}) {
  const { colors } = useTheme();
  const availability = useFoundationStore(s => s.availability);
  const selected = useAppStore(s => s.activeModelId === APPLE_MODEL_ID);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (select: boolean) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const status = await foundationModelService.refreshAvailability(
        () => !!useRemoteServerStore.getState().activeServerId,
      );
      if (select && status.available) {
        await generationService.stopGeneration();
        await activeModelService.unloadTextModel();
        remoteServerManager.clearActiveRemoteModel();
        useAppStore.getState().setActiveModelId(APPLE_MODEL_ID);
      }
    } catch {
      setError(
        'Could not switch models. Your current model was kept where possible. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ marginBottom: SPACING.lg }}>
      <Text style={{ ...TYPOGRAPHY.h3, color: colors.text }}>
        {APPLE_MODEL_NAME}
      </Text>
      <Text
        style={{
          ...TYPOGRAPHY.bodySmall,
          color: colors.textSecondary,
          marginVertical: SPACING.sm,
        }}
      >
        {selected && availability.available
          ? 'Current model · on device'
          : appleAvailabilityMessage(availability)}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          {error}
        </Text>
      ) : null}
      {busy ? (
        <ActivityIndicator accessibilityLabel="Checking Apple model" />
      ) : (
        <View style={{ gap: SPACING.sm }}>
          {!availability.available && (
            <Button
              title="Check again"
              variant="outline"
              onPress={() => run(false)}
            />
          )}
          {availability.available && !selected && (
            <Button title="Use Apple model" onPress={() => run(true)} />
          )}
          <Button
            title="Choose another model"
            variant="outline"
            onPress={onChooseModel}
          />
        </View>
      )}
      <Text
        style={{
          ...TYPOGRAPHY.meta,
          color: colors.textMuted,
          marginTop: SPACING.sm,
        }}
      >
        Additional models download only when you request them.
      </Text>
    </Card>
  );
}
