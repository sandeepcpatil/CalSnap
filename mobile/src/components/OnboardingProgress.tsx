import React from 'react';
import { View, StyleSheet } from 'react-native';
import { T, spacing } from '../theme';

interface Props {
  step: number;
  total: number;
}

/**
 * Five dots, the filled ones counting completed steps. The "Step 1 of 5"
 * caption was redundant with the dots visually, so it now lives only in the
 * accessibility label where it is actually useful.
 */
export function OnboardingProgress({ step, total }: Props) {
  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}
      accessibilityValue={{ min: 0, max: total, now: step }}
    >
      <View style={styles.dotsRow}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < step ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.sm },
  dotsRow: { flexDirection: 'row', gap: spacing.sm },
  dot: { width: 32, height: 4, borderRadius: 2 },
  dotActive: { backgroundColor: T.primary },
  dotInactive: { backgroundColor: T.border },
});
