import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '../hooks/useTheme';

interface Props {
  label: string;
  current: number;
  goal: number;
  color: string;
  unit?: string;
}

export function MacroBar({ label, current, goal, color, unit = 'g' }: Props) {
  const progress = goal > 0 ? Math.min(current / goal, 1) : 0;
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.valueCurrent, { color }]}>{Math.round(current)}{unit}</Text>
          <Text style={[styles.valueSep, { color: theme.textMuted }]}> / </Text>
          <Text style={[styles.valueGoal, { color: theme.textMuted }]}>{Math.round(goal)}{unit}</Text>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
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
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  valueCurrent: { fontSize: 14, fontWeight: '700' },
  valueSep: { fontSize: 13 },
  valueGoal: { fontSize: 13, fontWeight: '500' },
  track: { height: 12, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
});
