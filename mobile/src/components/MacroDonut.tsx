import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle, G } from 'react-native-svg';
import { macroCalorieSplit } from '../utils/nutrition';

interface Props {
  protein: number;
  carbs: number;
  fat: number;
}

const SIZE = 132;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const COLORS = {
  protein: '#85d3da',
  carbs: '#bdf4ff',
  fat: '#c0c1ff',
  track: 'rgba(255,255,255,0.07)',
  label: '#bec8c9',
  value: '#e0e3e5',
};

/**
 * Donut showing how today's calories split across protein / carbs / fat.
 * Percentages are of *calories* (protein·4, carbs·4, fat·9), which is the
 * meaningful nutritional split — not raw grams.
 */
export function MacroDonut({ protein, carbs, fat }: Props) {
  const split = macroCalorieSplit(protein, carbs, fat);
  const hasData = split.total > 0;

  const segments = [
    { key: 'protein', pct: split.proteinPct, color: COLORS.protein, label: 'Protein', grams: protein },
    { key: 'carbs', pct: split.carbsPct, color: COLORS.carbs, label: 'Carbs', grams: carbs },
    { key: 'fat', pct: split.fatPct, color: COLORS.fat, label: 'Fat', grams: fat },
  ] as const;

  // Accumulate rotation so each arc starts where the previous ended (12 o'clock origin).
  let offsetPct = 0;

  return (
    <View style={styles.row}>
      <View style={styles.donutWrap}>
        <Svg width={SIZE} height={SIZE}>
          <G rotation={-90} originX={SIZE / 2} originY={SIZE / 2}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={COLORS.track}
              strokeWidth={STROKE}
              fill="none"
            />
            {hasData &&
              segments.map((seg) => {
                const dash = (seg.pct / 100) * CIRCUMFERENCE;
                const rotation = (offsetPct / 100) * 360;
                offsetPct += seg.pct;
                if (seg.pct <= 0) return null;
                return (
                  <Circle
                    key={seg.key}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    stroke={seg.color}
                    strokeWidth={STROKE}
                    fill="none"
                    strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                    strokeLinecap="butt"
                    originX={SIZE / 2}
                    originY={SIZE / 2}
                    rotation={rotation}
                  />
                );
              })}
          </G>
        </Svg>
        <View style={styles.centerLabel} pointerEvents="none">
          <Text style={styles.centerNum}>{hasData ? `${Math.round(split.total)}` : '--'}</Text>
          <Text style={styles.centerUnit}>macro kcal</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {segments.map((seg) => (
          <View key={seg.key} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
            <Text style={styles.legendLabel}>{seg.label}</Text>
            <Text style={styles.legendPct}>{hasData ? `${Math.round(seg.pct)}%` : '--'}</Text>
            <Text style={styles.legendGrams}>{Math.round(seg.grams)}g</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  donutWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  centerLabel: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  centerNum: { fontSize: 26, fontWeight: '800', color: COLORS.value, letterSpacing: -0.5 },
  centerUnit: { fontSize: 9, fontWeight: '600', color: COLORS.label, letterSpacing: 0.5, textTransform: 'uppercase' },

  legend: { flex: 1, gap: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13, color: COLORS.label, fontWeight: '500' },
  legendPct: { fontSize: 14, fontWeight: '800', color: COLORS.value, minWidth: 38, textAlign: 'right' },
  legendGrams: { fontSize: 11, color: COLORS.label, minWidth: 40, textAlign: 'right' },
});
