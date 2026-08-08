/**
 * Standalone tests for the weekly-recap stats (no test runner in this repo).
 * Run with:  npx ts-node --transpile-only src/lib/weekStats.test.ts
 */
import assert from 'assert';
import {
  computeWeekStats,
  lastCompletedWeek,
  waterGoalMl,
  weekLabel,
} from './weekStats';

const bounds = { week_start: '2026-07-20', week_end: '2026-07-26' };

const stats = computeWeekStats(
  bounds,
  [
    { logged_at: '2026-07-20T09:00:00Z', calories: 2000, protein_g: 60, sodium_mg: 2500 },  // day 1 (high)
    { logged_at: '2026-07-21T09:00:00Z', calories: 1000, protein_g: 40, sodium_mg: 500 },   // day 2 (two rows → 900)
    { logged_at: '2026-07-21T19:00:00Z', calories: 1000, protein_g: 40, sodium_mg: 400 },
    { logged_at: '2026-07-22T13:00:00Z', calories: 1500, protein_g: 100, sodium_mg: 1500 }, // day 3
  ],
  [
    { logged_at: '2026-07-20T10:00:00Z', amount_ml: 2500 }, // day 1 hits 2500
    { logged_at: '2026-07-21T10:00:00Z', amount_ml: 1000 }, // day 2 misses
  ],
  [
    { logged_at: '2026-07-20T07:00:00Z', weight_kg: 74.0 },
    { logged_at: '2026-07-22T07:00:00Z', weight_kg: 73.5 },
  ],
  { daily_calorie_goal: 2000, daily_protein_goal: 80, daily_water_ml_goal: 2500, weight_kg: 70, activity_level: 'sedentary' },
);

assert.strictEqual(stats.days_logged, 3);
assert.strictEqual(stats.avg_calories, 1833);        // (2000+2000+1500)/3
assert.strictEqual(stats.avg_protein, 80);           // (60+80+100)/3
assert.strictEqual(stats.days_protein_low, 1);       // only day 1 (60) < 80
assert.strictEqual(stats.best_protein_day_kg, 100);
assert.strictEqual(stats.water_goal_ml, 2500);
assert.strictEqual(stats.days_with_water, 2);
assert.strictEqual(stats.days_water_goal_hit, 1);    // day 1 only
assert.strictEqual(stats.weight_change_kg, -0.5);
assert.strictEqual(stats.week_label, '20–26 Jul');
// Sodium: days = [2500, 900, 1500] → avg 1633, one day over 2000.
assert.strictEqual(stats.avg_sodium_mg, 1633);
assert.strictEqual(stats.days_high_sodium, 1);

// ── water goal derivation (no explicit goal → weight × 32 × activity) ────────
assert.strictEqual(waterGoalMl({ daily_water_ml_goal: null, weight_kg: 74, activity_level: 'moderate' } as never), 2750);
assert.strictEqual(waterGoalMl({ daily_water_ml_goal: null, weight_kg: null, activity_level: null } as never), 3000);
assert.strictEqual(waterGoalMl({ daily_water_ml_goal: 2000, weight_kg: 74, activity_level: 'active' } as never), 2000);

// ── no weigh-ins / one weigh-in → no change ─────────────────────────────────
const noWeight = computeWeekStats(bounds, [], [], [{ logged_at: '2026-07-20T07:00:00Z', weight_kg: 74 }],
  { daily_calorie_goal: null, daily_protein_goal: null, daily_water_ml_goal: null, weight_kg: null, activity_level: null });
assert.strictEqual(noWeight.weight_change_kg, null);
assert.strictEqual(noWeight.days_logged, 0);
assert.strictEqual(noWeight.avg_calories, 0);

// ── lastCompletedWeek: a Monday start, 7-day span ending the prior Sunday ────
{
  const wk = lastCompletedWeek(new Date('2026-08-08T12:00:00Z')); // a Saturday
  // Prior completed week is Mon 27 Jul – Sun 2 Aug 2026.
  assert.strictEqual(wk.week_start, '2026-07-27');
  assert.strictEqual(wk.week_end, '2026-08-02');
  assert.strictEqual(new Date(wk.week_start + 'T00:00:00Z').getUTCDay(), 1); // Monday
}

assert.strictEqual(weekLabel('2026-07-28', '2026-08-03'), '28 Jul – 3 Aug');

// eslint-disable-next-line no-console
console.log('✓ weekStats — all assertions passed');
