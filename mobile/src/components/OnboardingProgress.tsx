import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { T } from '../theme';

interface Props {
  step: number;
  total: number;
}

export function OnboardingProgress({ step, total }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.dotsRow}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < step ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
      <Text variant="bodySmall" style={styles.label}>Step {step} of {total}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 16, paddingBottom: 8, gap: 8 },
  dotsRow: { flexDirection: 'row', gap: 8 },
  dot: { width: 32, height: 4, borderRadius: 2 },
  dotActive: { backgroundColor: T.primary },
  dotInactive: { backgroundColor: T.border },
  label: { color: T.textMuted },
});
