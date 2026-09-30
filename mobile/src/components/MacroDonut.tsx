import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle, G } from 'react-native-svg';
import { macroCalorieSplit } from '../utils/nutrition';
import { T, spacing, type, tabularNums } from '../theme';

interface Props {
  protein: number;
  carbs: number;
  fat: number;
  /** Hide the text legend when the rows below already label each macro. */
  showLegend?: boolean;
}

const SIZE = 132;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Donut showing how today's calories split across protein / carbs / fat.
 * Percentages are of *calories* (protein·4, carbs·4, fat·9), which is the
 * meaningful nutritional split — not raw grams.
 *
 * The centre shows protein's share only: the card already has a calorie
 * number in the ring above it, so a second "macro kcal" total was one number
 * too many for the card to be about.
 */
export function MacroDonut({ protein, carbs, fat, showLegend = true }: Props) {
  const split = macroCalorieSplit(protein, carbs, fat);
  const hasData = split.total > 0;

  const segments = [
    { key: 'protein', pct: split.proteinPct, color: T.protein, label: 'Protein', grams: protein },
    { key: 'carbs', pct: split.carbsPct, color: T.carbs, label: 'Carbs', grams: carbs },
    { key: 'fat', pct: split.fatPct, color: T.fat, label: 'Fat', grams: fat },
  ] as const;

  // Accumulate rotation so each arc starts where the previous ended (12 o'clock origin).
  let offsetPct = 0;

  return (
    <View
      style={showLegend ? styles.row : styles.rowCentered}
      accessible
      accessibilityLabel={
        hasData
          ? `Macros: ${Math.round(split.proteinPct)} percent protein, ${Math.round(split.carbsPct)} percent carbs, ${Math.round(split.fatPct)} percent fat`
          : 'Macros: nothing logged yet'
      }
    >
      <View style={styles.donutWrap}>
        <Svg width={SIZE} height={SIZE}>
          <G rotation={-90} originX={SIZE / 2} originY={SIZE / 2}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={T.surface2}
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
          <Text style={styles.centerNum}>{hasData ? `${Math.round(split.proteinPct)}%` : '—'}</Text>
          <Text style={styles.centerUnit}>protein</Text>
        </View>
      </View>

      {showLegend && (
        <View style={styles.legend}>
          {segments.map((seg) => (
            <View key={seg.key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
              <Text style={styles.legendLabel}>{seg.label}</Text>
              <Text style={styles.legendPct}>{hasData ? `${Math.round(seg.pct)}%` : '—'}</Text>
              <Text style={styles.legendGrams}>{Math.round(seg.grams)}g</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  rowCentered: { alignItems: 'center' },
  donutWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  centerLabel: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  centerNum: { ...type.title, fontSize: 24, lineHeight: 28, fontWeight: '800', color: T.textPrimary, ...tabularNums },
  centerUnit: { ...type.bodySm, color: T.textSecondary },

  legend: { flex: 1, gap: spacing.md },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { ...type.bodySm, flex: 1, color: T.textSecondary },
  legendPct: { ...type.bodySm, fontSize: 14, fontWeight: '800', color: T.textPrimary, minWidth: 38, textAlign: 'right', ...tabularNums },
  legendGrams: { ...type.bodySm, color: T.textSecondary, minWidth: 40, textAlign: 'right', ...tabularNums },
});
