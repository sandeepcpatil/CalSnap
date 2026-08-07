/**
 * History analytics: turn a run of per-day calorie totals into the numbers the
 * History chart shows, at a granularity that matches the selected range.
 *
 * Pure and dependency-free so the aggregation can be unit-tested — the screen
 * only wires these to state.
 */

export type RangeDays = 7 | 30 | 90;
export type Granularity = 'day' | 'week' | 'month';

/** One day's total. `date` is a local `YYYY-MM-DD` key; `calories` may be 0. */
export interface DayPoint {
  date: string;
  calories: number;
}

/** One bar in the chart. */
export interface Bucket {
  key: string;
  /** Short axis label — "MON", "5 Aug", "Jun". */
  label: string;
  /** Average kcal/day over the *logged* days in this bucket (0 if none). */
  avgKcal: number;
  /** This bucket contains today — highlighted in the chart. */
  isCurrent: boolean;
}

/** Longer ranges need coarser bars: 7 daily bars is fine, 90 is not. */
export function granularityFor(range: RangeDays): Granularity {
  if (range <= 7) return 'day';
  if (range <= 30) return 'week';
  return 'month';
}

/**
 * Mean calories over the days that were actually logged. Empty days are
 * excluded on purpose — "your average day is 1,900 kcal" should describe the
 * days you ate tracked, not be dragged to zero by days you forgot.
 */
export function averageOverLoggedDays(days: readonly DayPoint[]): number {
  const logged = days.filter((d) => d.calories > 0);
  if (logged.length === 0) return 0;
  return Math.round(logged.reduce((s, d) => s + d.calories, 0) / logged.length);
}

/** Signed percentage change, guarded against a zero baseline. */
export function trendPct(current: number, prior: number): { pct: number; dir: 'up' | 'down' | 'neutral' } {
  if (prior <= 0 || current <= 0) return { pct: 0, dir: 'neutral' };
  const pct = Math.round(((current - prior) / prior) * 100);
  return { pct: Math.abs(pct), dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral' };
}

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parse a `YYYY-MM-DD` key as a *local* date (no timezone shift). */
function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function dayLabel(key: string): string {
  return DOW[parseDay(key).getDay()];
}
function weekLabel(startKey: string): string {
  const d = parseDay(startKey);
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
}
function monthLabel(key: string): string {
  return MONTH[parseDay(key).getMonth()];
}

/** Split into fixed-size groups aligned to the *end*, so the newest bucket is
 *  always a full window and any short bucket is the oldest one. */
function chunkFromEnd<T>(arr: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let end = arr.length; end > 0; end -= size) {
    chunks.unshift(arr.slice(Math.max(0, end - size), end));
  }
  return chunks;
}

/**
 * Bucket a range of days (ordered oldest → newest) into chart bars.
 *
 * - day:   one bar per day.
 * - week:  seven-day bars, newest window aligned to "today".
 * - month: one bar per calendar month.
 *
 * Every bar's height is the average kcal/day over its logged days, so bars stay
 * on the same scale no matter which granularity is showing.
 */
export function bucketize(days: readonly DayPoint[], granularity: Granularity, today: string): Bucket[] {
  if (granularity === 'day') {
    return days.map((d) => ({
      key: d.date,
      label: dayLabel(d.date),
      avgKcal: Math.round(d.calories),
      isCurrent: d.date === today,
    }));
  }

  if (granularity === 'week') {
    return chunkFromEnd(days, 7).map((group) => ({
      key: group[0].date,
      label: weekLabel(group[0].date),
      avgKcal: averageOverLoggedDays(group),
      isCurrent: group.some((d) => d.date === today),
    }));
  }

  // month — group consecutive days by calendar month (YYYY-MM).
  const groups: DayPoint[][] = [];
  let currentMonth = '';
  for (const d of days) {
    const m = d.date.slice(0, 7);
    if (m !== currentMonth) { groups.push([]); currentMonth = m; }
    groups[groups.length - 1].push(d);
  }
  return groups.map((group) => ({
    key: group[0].date.slice(0, 7),
    label: monthLabel(group[0].date),
    avgKcal: averageOverLoggedDays(group),
    isCurrent: group.some((d) => d.date === today),
  }));
}

/** Human label for the trend block per range. */
export function trendLabel(range: RangeDays): string {
  if (range <= 7) return 'Week Trend';
  if (range <= 30) return 'Month Trend';
  return '90-Day Trend';
}
