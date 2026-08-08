/**
 * Standalone tests for the weight analytics (no test runner in this repo).
 * Run with:  npx tsx src/utils/weightStats.test.ts
 */
import assert from 'assert';
import {
  changeKg,
  etaDaysToTarget,
  etaLabel,
  formatDeltaKg,
  formatKg,
  linearTrend,
  projectKg,
  toSeries,
  weeklyRateKg,
  type WeightPoint,
} from './weightStats';

// A clean line: 80.0 kg on day 0, losing 0.1 kg/day for 20 days.
const losing: WeightPoint[] = Array.from({ length: 21 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 0, 1 + i));
  return { date: d.toISOString().slice(0, 10), kg: 80 - i * 0.1 };
});

// ── toSeries: dedupe to latest-per-day, sorted ───────────────────────────────
{
  const s = toSeries([
    { logged_at: '2026-01-02T07:00:00.000Z', weight_kg: 80.5 },
    { logged_at: '2026-01-02T21:00:00.000Z', weight_kg: 80.1 }, // later same day wins
    { logged_at: '2026-01-01T08:00:00.000Z', weight_kg: 81.0 },
  ]);
  assert.deepStrictEqual(s.map((p) => p.date), ['2026-01-01', '2026-01-02']);
  assert.strictEqual(s[1].kg, 80.1);
}

// ── trend / rate ─────────────────────────────────────────────────────────────
{
  const t = linearTrend(losing)!;
  assert.ok(Math.abs(t.slopePerDay - -0.1) < 1e-9, `slope ${t.slopePerDay}`);
  assert.strictEqual(weeklyRateKg(losing), -0.7); // 0.7 kg/week down
  assert.strictEqual(changeKg(losing), -2);       // 80.0 → 78.0
}

// ── projection: 10 days past the last reading (78.0) at −0.1/day → 77.0 ──────
assert.strictEqual(projectKg(losing, 10), 77);

// ── ETA: from 78.0 toward 75.0 at −0.1/day ≈ 30 days ────────────────────────
assert.strictEqual(etaDaysToTarget(losing, 75), 30);
// A target in the wrong direction (gaining) has no ETA on a losing trend.
assert.strictEqual(etaDaysToTarget(losing, 85), null);
// Already at target.
assert.strictEqual(etaDaysToTarget(losing, 78), 0);

// ── not enough data → no trend, no crash ─────────────────────────────────────
assert.strictEqual(linearTrend([{ date: '2026-01-01', kg: 80 }]), null);
assert.strictEqual(weeklyRateKg([]), null);
assert.strictEqual(changeKg([{ date: '2026-01-01', kg: 80 }]), null);
assert.strictEqual(projectKg([], 30), null);
// All readings on one day can't define a slope.
assert.strictEqual(
  linearTrend([{ date: '2026-01-01', kg: 80 }, { date: '2026-01-01', kg: 79 }]),
  null,
);

// ── formatting ───────────────────────────────────────────────────────────────
assert.strictEqual(formatKg(74.25), '74.3 kg');
assert.strictEqual(formatDeltaKg(0.4), '+0.4 kg');
assert.strictEqual(formatDeltaKg(-1.2), '−1.2 kg');
assert.strictEqual(formatDeltaKg(0), '±0 kg');
assert.strictEqual(etaLabel(9), '~9 days');
assert.strictEqual(etaLabel(21), '~3 weeks');
assert.strictEqual(etaLabel(90), '~3 months');

// eslint-disable-next-line no-console
console.log('✓ weightStats — all assertions passed');
