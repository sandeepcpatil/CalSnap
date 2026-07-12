import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSubscriptionGate } from '../hooks/useSubscriptionGate';
import { useTheme } from '../hooks/useTheme';

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
  const { theme } = useTheme();

  if (!isOnTrial || trialDaysLeft === null) return null;

  const label =
    trialDaysLeft <= 0
      ? 'Pro trial ends today'
      : `Pro trial · ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left`;

  const Container: React.ComponentType<any> = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.banner, { backgroundColor: theme.primaryTint, borderColor: theme.primary }]}
    >
      <View style={styles.left}>
        <Ionicons name="sparkles" size={16} color={theme.primary} />
        <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
      </View>
      {onPress ? (
        <Text style={[styles.cta, { color: theme.primary }]}>Upgrade</Text>
      ) : null}
    </Container>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 13, fontWeight: '700' },
  cta: { fontSize: 13, fontWeight: '800' },
});
