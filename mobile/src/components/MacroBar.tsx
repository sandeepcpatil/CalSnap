import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../context/ThemeContext';

interface Props {
  label: string;
  current: number;
  goal: number;
  color: string;
  unit?: string;
}

export function MacroBar({ label, current, goal, color, unit = 'g' }: Props) {
  const progress = goal > 0 ? Math.min(current / goal, 1) : 0;
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: theme.onSurface }]}>{label}</Text>
        <Text style={[styles.value, { color: theme.onSurfaceVariant }]}>
          {Math.round(current)}{unit} / {Math.round(goal)}{unit}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.surfaceTrack }]}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  label: { fontSize: 14, fontWeight: '700' },
  value: { fontSize: 14, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
