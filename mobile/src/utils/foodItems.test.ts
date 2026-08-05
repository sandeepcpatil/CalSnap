/**
 * Standalone tests for the food-item maths (no test runner in this repo yet).
 * Run with:  npx tsx src/utils/foodItems.test.ts
 *
 * The focus is the numeric-from-DB boundary: Postgres returns the DECIMAL macro
 * columns as JSON *strings*, and before `num()` a two-item sum concatenated
 * ("22.8" + "19.5") into NaN, which then rendered as 0.
 */
import assert from 'assert';
import { num, rescaleItem, sumItems } from './foodItems';
import type { FoodItem } from '../services/api';

// A boiled-egg row exactly as fetchLoggableFoods would build it from PostgREST:
// integer `calories` is a number, the DECIMAL macros are strings.
const egg = {
  name: 'Boiled eggs',
  quantity: 3.5,
  unit: 'piece',
  grams: 175,
  calories: 271,
  protein_g: '22.8',
  carbs_g: '1.9',
  fat_g: '19.3',
  fiber_g: '0',
} as unknown as FoodItem;

// ── num ─────────────────────────────────────────────────────────────────────
assert.strictEqual(num('22.8'), 22.8);
assert.strictEqual(num(22.8), 22.8);
assert.strictEqual(num(''), 0);
assert.strictEqual(num(null), 0);
assert.strictEqual(num(undefined), 0);
assert.strictEqual(num('not a number'), 0);

// ── rescaleItem holds density while coercing the stringy protein ─────────────
const five = rescaleItem(egg, 5, 'piece');
// 22.8 * (250g / 175g) = 32.57 → 32.6
assert.strictEqual(five.protein_g, 32.6);
assert.strictEqual(typeof five.protein_g, 'number');
assert.strictEqual(five.calories, 387);

// ── sumItems: the bug. Two stringy items must add, not concatenate ───────────
const two = sumItems([egg, { ...egg, protein_g: '19.5' } as unknown as FoodItem]);
assert.strictEqual(two.protein_g, 42.3, `expected 42.3, got ${two.protein_g}`);
assert.ok(!Number.isNaN(two.protein_g), 'protein must never be NaN');

// A single stringy item still sums to itself.
assert.strictEqual(sumItems([egg]).protein_g, 22.8);

// eslint-disable-next-line no-console
console.log('✓ foodItems — all assertions passed');
