import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { formatCalories } from '../utils/nutrition';
import { useTheme } from '../hooks/useTheme';

interface Props {
  consumed: number;
  goal: number;
}

const SIZE = 256;
const STROKE_WIDTH = 14;
const RADIUS = (SIZE - STROKE_WIDTH * 2) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CalorieRing({ consumed, goal }: Props) {
  const progress = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const remaining = Math.max(goal - consumed, 0);
  const isOver = consumed > goal;
  const { theme } = useTheme();
  const { ring } = theme;

  return (
    <View style={styles.section}>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE} style={styles.svg}>
          <Defs>
            <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={ring.gradFrom} />
              <Stop offset="100%" stopColor={ring.gradTo} />
            </LinearGradient>
          </Defs>
          {/* Background track */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={ring.track}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Progress arc */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={isOver ? '#ba1a1a' : 'url(#ringGrad)'}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        </Svg>

        <View style={styles.center}>
          <Text style={[styles.remainingLabel, { color: theme.textMuted }]}>Remaining</Text>
          <Text style={[styles.remainingValue, { color: isOver ? theme.error : '#00e3fd' }]}>
            {formatCalories(remaining)}
          </Text>
          <Text style={[styles.kcalUnit, { color: theme.textSecondary }]}>kcal</Text>
        </View>
      </View>

      {/* Consumed | Target stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Consumed</Text>
          <Text style={[styles.statValue, { color: theme.textPrimary }]}>{formatCalories(consumed)}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.dividerColor }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Target</Text>
          <Text style={[styles.statValue, { color: theme.textPrimary }]}>{formatCalories(goal)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  ringWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  svg: { position: 'absolute' },
  center: { alignItems: 'center', gap: 2 },
  remainingLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  remainingValue: { fontSize: 52, fontWeight: '800', letterSpacing: -2, lineHeight: 60 },
  kcalUnit: { fontSize: 16, fontWeight: '600' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 28 },
  statItem: { alignItems: 'center', gap: 2 },
  statLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  statValue: { fontSize: 18, fontWeight: '700' },
  divider: { width: 1, height: 32, borderRadius: 1 },
});
