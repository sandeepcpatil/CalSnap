/**
 * Standalone tests for the hydration maths (no test runner in this repo yet).
 * Run with:  npx tsx src/utils/water.test.ts
 */
import assert from 'assert';
import {
  clampCustomMl,
  formatMl,
  glassesOf,
  MAX_CUSTOM_ML,
  MIN_CUSTOM_ML,
  waterGoalMl,
  waterProgress,
} from './water';

// ── formatMl ────────────────────────────────────────────────────────────────
// Below a litre stays in ml; a round litre value must not read "2.0 L".
assert.strictEqual(formatMl(250), '250 ml');
assert.strictEqual(formatMl(999), '999 ml');
assert.strictEqual(formatMl(1000), '1 L');
assert.strictEqual(formatMl(1200), '1.2 L');
assert.strictEqual(formatMl(2000), '2 L');
assert.strictEqual(formatMl(0), '0 ml');

// ── waterGoalMl ─────────────────────────────────────────────────────────────
// An explicit goal always wins, even an unusual one.
assert.strictEqual(waterGoalMl(2500, 70), 2500);
// Derived from weight at 35 ml/kg, rounded to the nearest 250 ml.
assert.strictEqual(waterGoalMl(null, 70), 2500);  // 2450 → 2500
assert.strictEqual(waterGoalMl(null, 50), 1750);
// Clamped at both ends so an outlier weight can't produce a silly target.
assert.strictEqual(waterGoalMl(null, 20), 1500);
assert.strictEqual(waterGoalMl(null, 200), 5000);
// No weight on file (onboarding skipped) falls back to 3 L.
assert.strictEqual(waterGoalMl(null, null), 3000);
assert.strictEqual(waterGoalMl(0, 0), 3000);

// ── waterProgress ───────────────────────────────────────────────────────────
assert.strictEqual(waterProgress(1500, 3000), 0.5);
// Over-drinking must not overflow the ring.
assert.strictEqual(waterProgress(4000, 3000), 1);
assert.strictEqual(waterProgress(0, 3000), 0);
// A zero or missing goal must not produce NaN/Infinity in a width style.
assert.strictEqual(waterProgress(500, 0), 0);

// ── glassesOf ───────────────────────────────────────────────────────────────
assert.strictEqual(glassesOf(0), 0);
assert.strictEqual(glassesOf(250), 1);
assert.strictEqual(glassesOf(1200), 5);

// ── clampCustomMl ───────────────────────────────────────────────────────────
// Mirrors the DB CHECK, so a clamped value can never be rejected by Postgres.
assert.strictEqual(clampCustomMl(750), 750);
assert.strictEqual(clampCustomMl(1), MIN_CUSTOM_ML);
assert.strictEqual(clampCustomMl(99999), MAX_CUSTOM_ML);
assert.strictEqual(clampCustomMl(750.6), 751);

// eslint-disable-next-line no-console
console.log('✓ water utils — all assertions passed');
