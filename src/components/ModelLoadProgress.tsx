import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useModelLoadStore } from '../stores/modelLoadStore';
import { useTheme } from '../theme';
import { SPACING, TYPOGRAPHY } from '../constants';

export function ModelLoadProgress() {
  const state = useModelLoadStore();
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const sweep = useSharedValue(0);
  const completed = useSharedValue(0);
  const { active, percent, ticket } = state;
  const segmentWidth = Math.max(24, trackWidth * 0.28);

  useEffect(() => {
    cancelAnimation(sweep);
    if (active && percent === null && trackWidth > 0 && !reducedMotion) {
      // Reset outside the clipped track. Phase text changes do not restart the sweep.
      sweep.value = 0;
      sweep.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
    } else {
      sweep.value = 0.5;
    }
    return () => cancelAnimation(sweep);
  }, [active, percent, reducedMotion, ticket, trackWidth, sweep]);

  useEffect(() => {
    cancelAnimation(completed);
    const target = percent === null ? 0 : percent / 100;
    completed.value = active ? (reducedMotion ? target : withTiming(target, { duration: 220 })) : 0;
    return () => cancelAnimation(completed);
  }, [active, percent, reducedMotion, ticket, completed]);

  const fillStyle = useAnimatedStyle(() => ({
    width: percent === null ? segmentWidth : trackWidth * completed.value,
    opacity: trackWidth > 0 ? 1 : 0,
    transform: [{ translateX: percent === null ? -segmentWidth + (trackWidth + segmentWidth) * sweep.value : 0 }],
  }));

  if (!active) return null;
  return (
    <View testID="model-load-progress" style={styles.container}>
      <View style={styles.heading}>
        <Text accessibilityLiveRegion="polite" style={[TYPOGRAPHY.bodySmall, styles.phase, { color: colors.text }]}>{state.phase}</Text>
        {percent !== null && <Text style={[TYPOGRAPHY.bodySmall, styles.percent, { color: colors.textSecondary }]}>{Math.round(percent)}%</Text>}
      </View>
      <View testID="model-load-track" accessible accessibilityRole="progressbar" accessibilityLabel="Preparing model for use"
        accessibilityValue={percent === null ? { text: state.phase } : { min: 0, max: 100, now: Math.round(percent) }}
        onLayout={event => setTrackWidth(Math.max(0, event.nativeEvent.layout.width))}
        style={[styles.track, { backgroundColor: colors.border }]}>
        <Animated.View testID="model-load-fill" style={[styles.fill, { backgroundColor: colors.primary }, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch', gap: SPACING.sm, marginVertical: SPACING.sm, minWidth: 160 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  phase: { flex: 1 },
  percent: { fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
});
