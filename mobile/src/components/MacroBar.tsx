import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '../hooks/useTheme';
import { T } from '../theme';

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
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
          {percent !== undefined && (
            <Text style={[styles.percent, { color }]}>{Math.round(percent)}%</Text>
          )}
        </View>
        <View style={styles.valueRow}>
          <Text style={[styles.valueCurrent, { color }]}>{Math.round(current)}{unit}</Text>
          <Text style={[styles.valueSep, { color: theme.textMuted }]}> / </Text>
          <Text style={[styles.valueGoal, { color: theme.textMuted }]}>{Math.round(goal)}{unit}</Text>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: T.divider }]}>
        <View
          style={[
            styles.fill,
            { width: `${progress * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  percent: { fontSize: 12, fontWeight: '800' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  valueCurrent: { fontSize: 14, fontWeight: '700' },
  valueSep: { fontSize: 13 },
  valueGoal: { fontSize: 13, fontWeight: '500' },
  track: { height: 12, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
});
