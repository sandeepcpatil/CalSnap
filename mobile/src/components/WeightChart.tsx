import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Line } from 'react-native-svg';
import { linearTrend, formatKg, type WeightPoint } from '../utils/weightStats';
import { T, spacing, tabularNums } from '../theme';

interface Props {
  series: readonly WeightPoint[];
  width: number;
  height?: number;
}

type BodyGoal = 'lose_weight' | 'maintain' | 'gain_muscle' | null | undefined;

const PAD_X = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 10;
/** Right-hand column that holds the min/max kg labels, so they never read as dates. */
const GUTTER_W = 56;
const LABEL_LINE_H = 16;

/** Integer day number, matching weightStats. */
function dayNum(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

/**
 * "30 Sep" — the short date every weight surface uses. Accepts a `YYYY-MM-DD`
 * key (parsed at local noon so it never shifts a day) or a full timestamp.
 */
export function shortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Below this a change is scale noise, not a direction. */
const NOISE_KG = 0.3;
/** How far a "maintain" goal may drift before it is worth flagging. */
const MAINTAIN_BAND_KG = 1.0;

/**
 * Colour for a weight change read through the user's goal. Down is only
 * "good" for a lose-weight goal; for a muscle-gain goal it is the reverse; a
 * maintain goal is neutral inside its band; with no goal the change is simply
 * neutral and the sign carries the direction.
 */
export function weightDeltaColor(deltaKg: number, goal: BodyGoal): string {
  if (Math.abs(deltaKg) < NOISE_KG) return T.textSecondary;
  switch (goal) {
    case 'lose_weight':
      return deltaKg < 0 ? T.success : T.warning;
    case 'gain_muscle':
      return deltaKg > 0 ? T.success : T.warning;
    case 'maintain':
      return Math.abs(deltaKg) <= MAINTAIN_BAND_KG ? T.textSecondary : T.warning;
    default:
      return T.textSecondary;
  }
}

/**
 * A weight line over time with a dashed least-squares trend line behind it.
 * The raw line is noisy on purpose (real weigh-ins bounce); the trend line is
 * the thing to read. Dates sit under the plot, kg bounds in a gutter beside it.
 */
export function WeightChart({ series, width, height = 180 }: Props) {
  if (series.length === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>Log a few weigh-ins to see your trend.</Text>
      </View>
    );
  }

  const svgW = Math.max(40, width - GUTTER_W);

  const xs = series.map((p) => dayNum(p.date));
  const ys = series.map((p) => p.kg);
  const minX = xs[0];
  const maxX = xs[xs.length - 1];
  const spanX = Math.max(1, maxX - minX);

  // Pad the value axis a little so the line never hugs the edges.
  const rawMin = Math.min(...ys);
  const rawMax = Math.max(...ys);
  const pad = Math.max(0.5, (rawMax - rawMin) * 0.15);
  const minY = rawMin - pad;
  const maxY = rawMax + pad;
  const spanY = Math.max(0.1, maxY - minY);

  const plotW = svgW - PAD_X * 2;
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const sx = (day: number) => PAD_X + ((day - minX) / spanX) * plotW;
  const sy = (kg: number) => PAD_TOP + (1 - (kg - minY) / spanY) * plotH;

  const linePath = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(xs[i]).toFixed(1)} ${sy(p.kg).toFixed(1)}`)
    .join(' ');

  const areaPath =
    `${linePath} L ${sx(maxX).toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)}` +
    ` L ${sx(minX).toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} Z`;

  const trend = linearTrend(series);

  // Align the gutter labels with where the highest and lowest readings sit.
  const gutterTop = Math.max(0, sy(rawMax) - LABEL_LINE_H / 2);
  const gutterBottom = Math.max(0, height - sy(rawMin) - LABEL_LINE_H / 2);

  return (
    <View style={{ width }}>
      <View style={styles.plotRow}>
        <Svg width={svgW} height={height}>
          <Defs>
            <LinearGradient id="wArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={T.primary} stopOpacity={0.22} />
              <Stop offset="1" stopColor={T.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Trend line (dashed) behind the raw line. */}
          {trend && (
            <Line
              x1={sx(minX)}
              y1={sy(trend.intercept + trend.slopePerDay * (minX - trend.baseDay))}
              x2={sx(maxX)}
              y2={sy(trend.intercept + trend.slopePerDay * (maxX - trend.baseDay))}
              stroke={T.textMuted}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          )}

          <Path d={areaPath} fill="url(#wArea)" />
          <Path d={linePath} stroke={T.primary} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />

          {/* Endpoint dot only — interior dots get noisy over 180 days. */}
          <Circle cx={sx(maxX)} cy={sy(ys[ys.length - 1])} r={4} fill={T.primary} stroke={T.bg} strokeWidth={2} />
        </Svg>

        <View style={[styles.gutter, { height, paddingTop: gutterTop, paddingBottom: gutterBottom }]}>
          <Text style={styles.gutterLabel} numberOfLines={1}>{formatKg(rawMax)}</Text>
          <Text style={styles.gutterLabel} numberOfLines={1}>{formatKg(rawMin)}</Text>
        </View>
      </View>

      <View style={[styles.axis, { width: svgW }]}>
        <Text style={styles.axisLabel}>{shortDate(series[0].date)}</Text>
        <Text style={styles.axisLabel}>{shortDate(series[series.length - 1].date)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: T.textMuted },
  plotRow: { flexDirection: 'row', alignItems: 'flex-start' },
  gutter: {
    width: GUTTER_W,
    justifyContent: 'space-between',
    paddingLeft: spacing.sm,
  },
  gutterLabel: {
    fontSize: 13,
    lineHeight: LABEL_LINE_H,
    fontWeight: '700',
    color: T.textSecondary,
    ...tabularNums,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAD_X,
    marginTop: 2,
  },
  axisLabel: { fontSize: 12, fontWeight: '600', color: T.textMuted },
});
