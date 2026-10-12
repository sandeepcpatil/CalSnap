import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { T, scoreColor, withAlpha, radius, spacing, tabularNums } from '../theme';

interface Props {
  score: number;
  /** Optional suffix such as "+12" shown beside the score in the same colour. */
  delta?: number;
  accessibilityLabel?: string;
}

/**
 * A compact health-score pill tinted by band (green / amber / red), for list
 * rows and table headers where the full ring would be too big.
 */
export function ScoreChip({ score, delta, accessibilityLabel }: Props) {
  const color = scoreColor(score);
  return (
    <View
      style={[styles.chip, { backgroundColor: withAlpha(color, 0.16) }]}
      accessible
      accessibilityLabel={accessibilityLabel ?? `Health score ${score} out of 100`}
    >
      <Text style={[styles.score, { color }]}>{score}</Text>
      {delta != null && delta > 0 && (
        <Text style={[styles.delta, { color }]}>{`+${delta}`}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs,
    borderRadius: radius.pill, alignSelf: 'flex-start',
  },
  score: { fontSize: 15, lineHeight: 20, fontWeight: '800', ...tabularNums },
  delta: { fontSize: 12, lineHeight: 16, fontWeight: '700', ...tabularNums, color: T.textSecondary },
});
