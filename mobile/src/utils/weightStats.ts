/**
 * Body-weight analytics: trend line, weekly rate, projection and goal ETA.
 *
 * Pure and dependency-free so the maths can be unit-tested. Weight is noisy
 * day to day (water, food, time of day), so everything here leans on a
 * least-squares **trend** rather than "latest minus previous", which would
 * whipsaw wildly.
 */

/** One reading. `date` is a local `YYYY-MM-DD` key; there is at most one per day. */
export interface WeightPoint {
  date: string;
  kg: number;
}

export interface WeightTrend {
  /** kg per day; negative = losing. */
  slopePerDay: number;
  /** kg predicted at day 0 (the first point's day). */
  intercept: number;
  /** Day-number of the first point, so callers can place the line. */
  baseDay: number;
}

/** Integer day number for a `YYYY-MM-DD` key. Differences are timezone-safe. */
function dayNum(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

/**
 * Collapse raw logs to one point per day (the most recent reading that day),
 * sorted oldest → newest. Multiple weigh-ins in a day are common; the latest
 * is the one worth trending.
 */
export function toSeries(logs: readonly { logged_at: string; weight_kg: number }[]): WeightPoint[] {
  const byDay = new Map<string, { at: string; kg: number }>();
  for (const l of logs) {
    const day = l.logged_at.slice(0, 10);
    const prev = byDay.get(day);
    if (!prev || l.logged_at > prev.at) byDay.set(day, { at: l.logged_at, kg: l.weight_kg });
  }
  return [...byDay.entries()]
    .map(([date, v]) => ({ date, kg: v.kg }))
    .sort((a, b) => dayNum(a.date) - dayNum(b.date));
}

export const latestKg = (series: readonly WeightPoint[]): number | null =>
  series.length ? series[series.length - 1].kg : null;

export const firstKg = (series: readonly WeightPoint[]): number | null =>
  series.length ? series[0].kg : null;

/** Net change across the series (latest − first). Null if fewer than two points. */
export function changeKg(series: readonly WeightPoint[]): number | null {
  if (series.length < 2) return null;
  return Math.round((series[series.length - 1].kg - series[0].kg) * 10) / 10;
}

/** Least-squares trend, or null when there aren't two distinct days to fit. */
export function linearTrend(series: readonly WeightPoint[]): WeightTrend | null {
  const n = series.length;
  if (n < 2) return null;

  const base = dayNum(series[0].date);
  const xs = series.map((p) => dayNum(p.date) - base);
  const ys = series.map((p) => p.kg);
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null; // all readings on the same day

  const slopePerDay = num / den;
  return { slopePerDay, intercept: my - slopePerDay * mx, baseDay: base };
}

/** kg/week, positive or negative. Null when there's no trend yet. */
export function weeklyRateKg(series: readonly WeightPoint[]): number | null {
  const t = linearTrend(series);
  if (!t) return null;
  return Math.round(t.slopePerDay * 7 * 10) / 10;
}

/** Projected weight `daysAhead` from the latest reading, following the trend. */
export function projectKg(series: readonly WeightPoint[], daysAhead: number): number | null {
  const t = linearTrend(series);
  const last = latestKg(series);
  if (!t || last === null) return null;
  return Math.round((last + t.slopePerDay * daysAhead) * 10) / 10;
}

/**
 * Whole days until the target is reached at the current rate, or null when
 * there's no trend, the trend moves *away* from the target, or it's flat.
 */
export function etaDaysToTarget(series: readonly WeightPoint[], targetKg: number): number | null {
  const t = linearTrend(series);
  const last = latestKg(series);
  if (!t || last === null) return null;

  const diff = targetKg - last;
  if (Math.abs(diff) < 0.05) return 0;                 // already there
  if (t.slopePerDay === 0) return null;                 // flat
  const days = diff / t.slopePerDay;
  if (days <= 0) return null;                            // moving the wrong way
  return Math.round(days);
}

/** "74.2 kg". */
export const formatKg = (kg: number): string => `${(Math.round(kg * 10) / 10).toFixed(1)} kg`;

/** "+0.4 kg" / "−1.2 kg" / "±0 kg" — signed, with a real minus glyph. */
export function formatDeltaKg(kg: number): string {
  const r = Math.round(kg * 10) / 10;
  if (r === 0) return '±0 kg';
  return `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(1)} kg`;
}

/** A friendly horizon label for an ETA in days. */
export function etaLabel(days: number): string {
  if (days <= 0) return 'now';
  if (days < 14) return `~${days} days`;
  if (days < 60) return `~${Math.round(days / 7)} weeks`;
  return `~${Math.round(days / 30)} months`;
}
