import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSubscriptionGate } from '../hooks/useSubscriptionGate';
import { T, spacing, radius, type, HIT_TARGET } from '../theme';

interface TrialBannerProps {
  /** Optional: tapping the banner (e.g. to open the paywall). */
  onPress?: () => void;
}

/**
 * Shows the remaining days in the user's free 7-day Pro trial.
 * Renders nothing when the user isn't on a trial. The day count is derived
 * from `trial_end_date` on each render, so it stays current without any
 * realtime subscription.
 */
export function TrialBanner({ onPress }: TrialBannerProps) {
  const { isOnTrial, trialDaysLeft } = useSubscriptionGate();

  if (!isOnTrial || trialDaysLeft === null) return null;

  const label =
    trialDaysLeft <= 0
      ? 'Pro trial ends today'
      : `Pro trial · ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left`;

  const inner = (
    <>
      <View style={styles.left}>
        <Ionicons name="sparkles" size={16} color={T.primary} />
        <Text style={styles.label}>{label}</Text>
      </View>
      {onPress ? <Text style={styles.cta}>Upgrade</Text> : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={styles.banner}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Upgrade`}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return <View style={styles.banner}>{inner}</View>;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: HIT_TARGET,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: T.primaryTint,
    borderColor: T.primaryBorder,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  label: { ...type.bodySm, fontWeight: '700', color: T.textPrimary, flexShrink: 1 },
  cta: { ...type.bodySm, fontWeight: '800', color: T.primary },
});
