/**
 * Standalone tests for the History aggregation (no test runner in this repo).
 * Run with:  npx tsx src/utils/historyStats.test.ts
 */
import assert from 'assert';
import {
  averageOverLoggedDays,
  bucketize,
  granularityFor,
  trendPct,
  type DayPoint,
} from './historyStats';

// ── granularityFor ──────────────────────────────────────────────────────────
assert.strictEqual(granularityFor(7), 'day');
assert.strictEqual(granularityFor(30), 'week');
assert.strictEqual(granularityFor(90), 'month');

// ── averageOverLoggedDays — empty days excluded ─────────────────────────────
assert.strictEqual(averageOverLoggedDays([]), 0);
assert.strictEqual(
  averageOverLoggedDays([{ date: 'a', calories: 2000 }, { date: 'b', calories: 0 }, { date: 'c', calories: 1000 }]),
  1500, // (2000 + 1000) / 2 logged days, NOT / 3
);

// ── trendPct ────────────────────────────────────────────────────────────────
assert.deepStrictEqual(trendPct(1100, 1000), { pct: 10, dir: 'up' });
assert.deepStrictEqual(trendPct(900, 1000), { pct: 10, dir: 'down' });
assert.deepStrictEqual(trendPct(1000, 0), { pct: 0, dir: 'neutral' }); // no baseline → no NaN

// Local YYYY-MM-DD, so the helper doesn't shift a day under a non-UTC clock.
function keyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Helper: build N consecutive days ending on `end`, each with the same kcal.
function daysEnding(end: string, n: number, kcal: number): DayPoint[] {
  const [y, m, dd] = end.split('-').map(Number);
  const base = new Date(y, m - 1, dd);
  const out: DayPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(base);
    day.setDate(base.getDate() - i);
    out.push({ date: keyOf(day), calories: kcal });
  }
  return out;
}

// ── day granularity: one bar per day, today flagged ─────────────────────────
{
  const days = daysEnding('2026-08-06', 7, 2000);
  const buckets = bucketize(days, 'day', '2026-08-06');
  assert.strictEqual(buckets.length, 7);
  assert.strictEqual(buckets[6].isCurrent, true);
  assert.strictEqual(buckets[6].avgKcal, 2000);
}

// ── week granularity: 30 days → 5 bars, each = avg/day (not a 7× sum) ────────
{
  const days = daysEnding('2026-08-06', 30, 2000);
  const buckets = bucketize(days, 'week', '2026-08-06');
  assert.strictEqual(buckets.length, 5); // 30 / 7 → 4 full + 1 short
  // Every weekly bar is the average day, so it stays on the daily scale.
  buckets.forEach((b) => assert.strictEqual(b.avgKcal, 2000));
  // The newest bucket holds today.
  assert.strictEqual(buckets[buckets.length - 1].isCurrent, true);
}

// ── month granularity: 90 days → one bar per calendar month ─────────────────
{
  const days = daysEnding('2026-08-06', 90, 1800); // spans May–Aug
  const buckets = bucketize(days, 'month', '2026-08-06');
  assert.ok(buckets.length >= 3 && buckets.length <= 4, `got ${buckets.length} month bars`);
  assert.strictEqual(buckets[buckets.length - 1].label, 'Aug');
  assert.strictEqual(buckets[buckets.length - 1].isCurrent, true);
  buckets.forEach((b) => assert.strictEqual(b.avgKcal, 1800));
}

// ── a sparse bucket still averages only its logged days ─────────────────────
{
  const days: DayPoint[] = [
    { date: '2026-08-01', calories: 2400 },
    { date: '2026-08-02', calories: 0 },
    { date: '2026-08-03', calories: 0 },
  ];
  const [bar] = bucketize(days, 'week', '2026-08-03');
  assert.strictEqual(bar.avgKcal, 2400); // one logged day, not 800
}

// eslint-disable-next-line no-console
console.log('✓ historyStats — all assertions passed');
