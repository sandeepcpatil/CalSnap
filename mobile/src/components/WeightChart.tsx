import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Line } from 'react-native-svg';
import { linearTrend, formatKg, type WeightPoint } from '../utils/weightStats';
import { T } from '../theme';

interface Props {
  series: readonly WeightPoint[];
  width: number;
  height?: number;
}

const PAD_X = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;

/** Integer day number, matching weightStats. */
function dayNum(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

/**
 * A weight line over time with a dashed least-squares trend line behind it.
 * The raw line is noisy on purpose (real weigh-ins bounce); the trend line is
 * the thing to read.
 */
export function WeightChart({ series, width, height = 180 }: Props) {
  if (series.length === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>Log a few weigh-ins to see your trend.</Text>
      </View>
    );
  }

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

  const plotW = width - PAD_X * 2;
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

  return (
    <View style={{ width }}>
      <Svg width={width} height={height}>
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

      <View style={styles.axis}>
        <Text style={styles.axisLabel}>{series[0].date.slice(5)}</Text>
        <Text style={styles.axisRange}>{formatKg(rawMin)} – {formatKg(rawMax)}</Text>
        <Text style={styles.axisLabel}>{series[series.length - 1].date.slice(5)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: T.textMuted },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAD_X,
    marginTop: 2,
  },
  axisLabel: { fontSize: 10.5, fontWeight: '600', color: T.textMuted },
  axisRange: { fontSize: 10.5, fontWeight: '700', color: T.textSecondary },
});
