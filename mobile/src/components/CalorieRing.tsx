import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { formatCalories } from '../utils/nutrition';
import { T, spacing, type, tabularNums } from '../theme';

interface Props {
  consumed: number;
  goal: number;
  /**
   * First load with no cached data: draw the track and placeholders instead
   * of presenting the whole goal as "remaining".
   */
  loading?: boolean;
}

const SIZE = 256;
const STROKE_WIDTH = 14;
const RADIUS = (SIZE - STROKE_WIDTH * 2) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CalorieRing({ consumed, goal, loading = false }: Props) {
  const isOver = !loading && consumed > goal;
  const progress = loading ? 0 : goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const remaining = Math.max(goal - consumed, 0);
  const over = Math.max(consumed - goal, 0);

  const heroLabel = loading ? 'Remaining' : isOver ? 'Over target' : 'Remaining';
  const heroValue = loading ? '—' : formatCalories(isOver ? over : remaining);
  const heroUnit = isOver ? 'kcal over' : 'kcal';

  return (
    <View
      style={styles.section}
      accessible
      accessibilityLabel={
        loading
          ? 'Loading today’s calories'
          : isOver
            ? `${formatCalories(over)} kilocalories over target`
            : `${formatCalories(remaining)} kilocalories remaining of ${formatCalories(goal)}`
      }
    >
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE} style={styles.svg}>
          <Defs>
            <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={T.ringFrom} />
              <Stop offset="100%" stopColor={T.ringTo} />
            </LinearGradient>
          </Defs>
          {/* Background track */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={T.surface2}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Progress arc — full and in the error colour once over target */}
          {!loading && (
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={isOver ? T.error : 'url(#ringGrad)'}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${SIZE / 2}, ${SIZE / 2}`}
            />
          )}
        </Svg>

        <View style={styles.center}>
          <Text style={[styles.heroLabel, isOver && { color: T.error }]}>{heroLabel}</Text>
          <Text
            style={[
              styles.heroValue,
              { color: loading ? T.textMuted : isOver ? T.error : T.primary },
            ]}
          >
            {heroValue}
          </Text>
          <Text style={styles.heroUnit}>{heroUnit}</Text>
        </View>
      </View>

      {/* Consumed | Target stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Consumed</Text>
          <Text style={styles.statValue}>{loading ? '—' : formatCalories(consumed)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Target</Text>
          <Text style={styles.statValue}>{formatCalories(goal)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { alignItems: 'center', paddingVertical: spacing['2xl'], paddingHorizontal: spacing.lg },
  ringWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  svg: { position: 'absolute' },
  center: { alignItems: 'center', gap: 2 },
  heroLabel: { ...type.label, color: T.textMuted },
  heroValue: { ...type.display, fontSize: 52, lineHeight: 60, letterSpacing: -2 },
  heroUnit: { ...type.body, fontWeight: '600', color: T.textSecondary },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, gap: 28 },
  statItem: { alignItems: 'center', gap: 2 },
  statLabel: { ...type.label, color: T.textMuted },
  statValue: { ...type.titleSm, ...tabularNums, color: T.textPrimary },
  divider: { width: 1, height: 32, borderRadius: 1, backgroundColor: T.divider },
});
