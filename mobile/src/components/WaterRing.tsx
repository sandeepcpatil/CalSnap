import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { formatMl, glassesOf, waterProgress } from '../utils/water';
import { T } from '../theme';

interface Props {
  consumedMl: number;
  goalMl: number;
  size?: number;
}

/**
 * The hydration arc. Same geometry as `CalorieRing` on purpose — two rings on
 * two screens that read as one system — but the copy counts up ("1.2 of 3 L")
 * rather than down, because there is no penalty for going over on water.
 */
export function WaterRing({ consumedMl, goalMl, size = 200 }: Props) {
  const stroke = Math.round(size * 0.055);
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = waterProgress(consumedMl, goalMl);
  const remaining = Math.max(goalMl - consumedMl, 0);
  const met = consumedMl >= goalMl;

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={styles.svg}>
          <Defs>
            <LinearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={T.ringFrom} />
              <Stop offset="100%" stopColor={T.ringTo} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={T.surface2}
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={met ? T.success : 'url(#waterGrad)'}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>

        <View style={styles.center}>
          <Text style={[styles.value, { color: met ? T.success : T.primary, fontSize: size * 0.21 }]}>
            {formatMl(consumedMl)}
          </Text>
          <Text style={styles.goal}>of {formatMl(goalMl)}</Text>
        </View>
      </View>

      <Text style={styles.caption}>
        {met
          ? `Goal met · ${glassesOf(consumedMl)} glasses logged`
          : `${formatMl(remaining)} to go · ${glassesOf(consumedMl)} glass${glassesOf(consumedMl) === 1 ? '' : 'es'} logged`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 14 },
  svg: { position: 'absolute' },
  center: { alignItems: 'center', gap: 2 },
  value: { fontWeight: '800', letterSpacing: -1.5 },
  goal: { fontSize: 14, fontWeight: '600', color: T.textSecondary },
  caption: { fontSize: 13, fontWeight: '600', color: T.textMuted },
});
