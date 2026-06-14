import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';
import { formatCalories } from '../utils/nutrition';

interface Props {
  consumed: number;
  goal: number;
}

const SIZE = 220;
const STROKE_WIDTH = 18;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CalorieRing({ consumed, goal }: Props) {
  const progress = Math.min(consumed / goal, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const remaining = Math.max(goal - consumed, 0);
  const isOver = consumed > goal;

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE} style={styles.svg}>
        {/* Background track */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#e0f2f1"
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={isOver ? '#ef5350' : '#01696f'}
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
        <Text variant="headlineMedium" style={[styles.consumed, isOver && styles.consumedOver]}>
          {formatCalories(consumed)}
        </Text>
        <Text variant="bodySmall" style={styles.unit}>/ {formatCalories(goal)} kcal</Text>
        <View style={styles.badge}>
          <Text variant="labelSmall" style={[styles.remaining, isOver && styles.remainingOver]}>
            {isOver
              ? `${formatCalories(consumed - goal)} kcal over`
              : `${formatCalories(remaining)} kcal left`}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', height: SIZE, marginTop: 8 },
  svg: { position: 'absolute' },
  center: { alignItems: 'center', gap: 2 },
  consumed: { color: '#212121', fontWeight: '800' },
  consumedOver: { color: '#ef5350' },
  unit: { color: '#90a4ae' },
  badge: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#e0f2f1',
    borderRadius: 20,
  },
  remaining: { color: '#01696f', fontWeight: '600' },
  remainingOver: { color: '#ef5350' },
});
