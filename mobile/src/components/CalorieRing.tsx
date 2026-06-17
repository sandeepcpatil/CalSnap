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
          <Text style={[styles.consumed, { color: isOver ? theme.error : theme.textPrimary }]}>
            {formatCalories(consumed)}
          </Text>
          <Text style={[styles.goalLabel, { color: theme.textSecondary }]}>
            / {formatCalories(goal)} kcal
          </Text>
        </View>
      </View>

      {/* Energy badge */}
      <View style={[styles.badge, { backgroundColor: isOver ? theme.errorTint : ring.badgeBg }]}>
        <Text style={styles.badgeIcon}>⚡</Text>
        <Text style={[styles.badgeText, { color: isOver ? theme.error : ring.badgeText }]}>
          {isOver
            ? `${formatCalories(consumed - goal)} kcal over`
            : `${formatCalories(remaining)} kcal left`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16 },
  ringWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  svg: { position: 'absolute' },
  center: { alignItems: 'center', gap: 2 },
  consumed: { fontSize: 48, fontWeight: '800', letterSpacing: -1, lineHeight: 56 },
  consumedOver: {},
  goalLabel: { fontSize: 14, fontWeight: '700' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 50,
    marginTop: 12,
  },
  badgeIcon: { fontSize: 14 },
  badgeText: { fontSize: 14, fontWeight: '700' },
});
