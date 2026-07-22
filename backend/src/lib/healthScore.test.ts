/**
 * Standalone tests for computeHealthScore (no test runner in this repo yet).
 * Run with:  npx ts-node src/lib/healthScore.test.ts
 */
import assert from 'assert';
import { computeHealthScore } from './healthScore';
import type { LabelNutrition } from '../types/shared';

const base: LabelNutrition = {
  energy_kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  sugar_g: 0,
  total_fat_g: 0,
  sat_fat_g: 0,
  fiber_g: 0,
  sodium_mg: 0,
};

// 1. Neutral product (nothing bad, nothing good): solid-but-not-perfect score,
//    grade B, no negatives. (0 Nutri-Score points = B in the official bands.)
{
  const r = computeHealthScore(base, ['water']);
  assert.ok(r.score >= 80, `neutral score should be ≥80, got ${r.score}`);
  assert.strictEqual(r.grade, 'B');
  assert.strictEqual(r.negatives.length, 0);
}

// 2. Roasted chana (healthy snack): high protein & fibre → A/B, high score
{
  const chana: LabelNutrition = {
    ...base,
    energy_kcal: 370,
    protein_g: 19,
    carbs_g: 58,
    sugar_g: 4,
    total_fat_g: 6,
    sat_fat_g: 0.8,
    fiber_g: 17,
    sodium_mg: 60,
  };
  const r = computeHealthScore(chana, ['roasted bengal gram', 'salt']);
  assert.ok(r.score >= 70, `chana score should be ≥70, got ${r.score}`);
  assert.ok(['A', 'B'].includes(r.grade), `chana grade should be A/B, got ${r.grade}`);
  assert.ok(r.positives.some((p) => p.includes('protein')), 'chana should flag high protein');
  assert.ok(r.positives.some((p) => p.includes('fibre')), 'chana should flag high fibre');
}

// 3. Fried chips with palm oil: low score, D/E, flags palm oil + high sat fat/sodium
{
  const chips: LabelNutrition = {
    ...base,
    energy_kcal: 550,
    protein_g: 7,
    carbs_g: 52,
    sugar_g: 2,
    total_fat_g: 34,
    sat_fat_g: 14,
    fiber_g: 4,
    sodium_mg: 800,
  };
  const r = computeHealthScore(chips, ['potato', 'palm oil', 'salt', 'ins 621']);
  assert.ok(r.score <= 45, `chips score should be ≤45, got ${r.score}`);
  assert.ok(['D', 'E'].includes(r.grade), `chips grade should be D/E, got ${r.grade}`);
  assert.ok(r.negatives.some((n) => n.includes('palm oil')), 'should flag palm oil');
  assert.ok(r.negatives.some((n) => n.includes('MSG')), 'should flag MSG (ins 621)');
  assert.ok(r.negatives.some((n) => n.includes('saturated fat')), 'should flag high sat fat');
}

// 4. Sugary cola (scored as a BEVERAGE): stricter drink thresholds kick in →
//    D-grade territory, added-sugar flag, far below chana.
{
  const cola: LabelNutrition = {
    ...base,
    energy_kcal: 42,
    carbs_g: 10.6,
    sugar_g: 10.6,
  };
  const r = computeHealthScore(cola, ['carbonated water', 'sugar', 'caramel colour', 'phosphoric acid'], true);
  assert.ok(r.negatives.some((n) => n.includes('added sugars')), 'cola should flag added sugars');
  assert.ok(r.score <= 50, `cola-as-beverage should be ≤50, got ${r.score}`);
  assert.ok(['D', 'E'].includes(r.grade), `cola grade should be D/E, got ${r.grade}`);
  const chanaScore = computeHealthScore(
    { ...base, energy_kcal: 370, protein_g: 19, sugar_g: 4, sat_fat_g: 0.8, fiber_g: 17, sodium_mg: 60, carbs_g: 58, total_fat_g: 6 },
    ['roasted bengal gram'],
  ).score;
  assert.ok(r.score < chanaScore, `cola (${r.score}) should score below chana (${chanaScore})`);

  // Same cola scored as a solid food would look far too good — the beverage
  // flag must make a material difference.
  const asFood = computeHealthScore(cola, ['carbonated water', 'sugar'], false);
  assert.ok(r.score < asFood.score, 'beverage thresholds must be stricter than food thresholds');
}

// 5. Clamping: absurdly bad product stays within 0–100
{
  const junk: LabelNutrition = {
    energy_kcal: 900,
    protein_g: 0,
    carbs_g: 60,
    sugar_g: 60,
    total_fat_g: 60,
    sat_fat_g: 30,
    fiber_g: 0,
    sodium_mg: 2000,
  };
  const r = computeHealthScore(junk, ['sugar', 'hydrogenated vegetable oil', 'palm oil', 'aspartame', 'tartrazine']);
  assert.ok(r.score >= 0 && r.score <= 100, `score must stay in 0–100, got ${r.score}`);
  assert.strictEqual(r.grade, 'E');
  assert.ok(r.score <= 10, `junk score should be ≤10, got ${r.score}`);
}

// 6. Determinism: same input → same output
{
  const a = computeHealthScore(base, ['water']);
  const b = computeHealthScore(base, ['water']);
  assert.deepStrictEqual(a, b);
}

// 7. Summary: always present, and names the biggest drivers
{
  // Neutral label → generic but non-empty sentence.
  const neutral = computeHealthScore(base, ['water']);
  assert.ok(neutral.summary.length > 0, 'neutral summary should not be empty');

  // Chips (low score) → summary should lead with the dominant negative.
  const chips = computeHealthScore(
    { ...base, energy_kcal: 550, protein_g: 7, carbs_g: 52, sugar_g: 2, total_fat_g: 34, sat_fat_g: 14, fiber_g: 4, sodium_mg: 800 },
    ['potato', 'palm oil', 'salt', 'ins 621'],
  );
  assert.ok(chips.summary.includes('saturated fat'), `chips summary should name saturated fat, got: "${chips.summary}"`);
  assert.ok(chips.summary.toLowerCase().includes('rated low'), `chips summary should read as low, got: "${chips.summary}"`);

  // Chana (high score) → positive-led summary naming protein/fibre.
  const chana = computeHealthScore(
    { ...base, energy_kcal: 370, protein_g: 19, carbs_g: 58, sugar_g: 4, total_fat_g: 6, sat_fat_g: 0.8, fiber_g: 17, sodium_mg: 60 },
    ['roasted bengal gram', 'salt'],
  );
  assert.ok(
    chana.summary.includes('protein') || chana.summary.includes('fibre'),
    `chana summary should credit protein/fibre, got: "${chana.summary}"`,
  );
}

console.log('✅ all healthScore tests passed');
