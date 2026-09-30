import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { T, spacing, type, tabularNums } from '../theme';

interface Props {
  label: string;
  current: number;
  goal: number;
  color: string;
  unit?: string;
  /** Share of today's calories from this macro — shown as a colored dot + %. */
  percent?: number;
}

export function MacroBar({ label, current, goal, color, unit = 'g', percent }: Props) {
  const progress = goal > 0 ? Math.min(current / goal, 1) : 0;
  const over = Math.round(current - goal);
  const isOver = goal > 0 && over > 0;
  // Once past the goal the bar is full and turns to the warning colour, and the
  // overshoot is spelled out beside the numbers rather than hidden by the clamp.
  const fillColor = isOver ? T.warning : color;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`${label}: ${Math.round(current)} of ${Math.round(goal)} ${unit}${isOver ? `, ${over} ${unit} over` : ''}`}
    >
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={styles.label}>{label}</Text>
          {percent !== undefined && (
            <Text style={[styles.percent, { color }]}>{Math.round(percent)}%</Text>
          )}
        </View>
        <View style={styles.valueRow}>
          <Text style={[styles.valueCurrent, { color: fillColor }]}>{Math.round(current)}{unit}</Text>
          <Text style={styles.valueGoal}> / {Math.round(goal)}{unit}</Text>
          {isOver && <Text style={styles.overMarker}>  +{over} {unit}</Text>}
        </View>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${progress * 100}%`, backgroundColor: fillColor },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { ...type.bodySm, fontWeight: '600', color: T.textSecondary },
  percent: { ...type.bodySm, fontWeight: '800', ...tabularNums },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  valueCurrent: { ...type.bodySm, fontSize: 14, fontWeight: '700', ...tabularNums },
  valueGoal: { ...type.bodySm, color: T.textMuted, ...tabularNums },
  overMarker: { ...type.bodySm, fontWeight: '700', color: T.warning, ...tabularNums },
  track: { height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: T.divider },
  fill: { height: '100%', borderRadius: 6 },
});
