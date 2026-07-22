import type { LabelNutrition, HealthScoreDetail } from '../types/shared';

/**
 * CalSnap Health Score — deterministic 0–100 rating for packaged foods.
 *
 * The AI only *reads* the label; this module *judges* it, so the same product
 * always gets the same score and every point is explainable.
 *
 * Method: Nutri-Score (2017 general-foods algorithm) computed from per-100g
 * values, mapped onto 0–100, then adjusted with small penalties for
 * ingredient red flags (added sugars, palm oil, artificial sweeteners, etc.).
 *
 * Simplifications vs. official Nutri-Score (documented deliberately):
 * - Fruit/veg/nut % is not printed on most labels → treated as 0.
 * - The "protein capped when N ≥ 11" rule is skipped for simplicity.
 * This makes scores slightly conservative for fruit-based products.
 */

// ── Nutri-Score point thresholds (per 100 g) ─────────────────────────────────
const ENERGY_KJ_STEPS = [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350];
const SUGAR_G_STEPS = [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45];
const SAT_FAT_G_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SODIUM_MG_STEPS = [90, 180, 270, 360, 450, 540, 630, 720, 810, 900];
const FIBER_G_STEPS = [0.9, 1.9, 2.8, 3.7, 4.7];
const PROTEIN_G_STEPS = [1.6, 3.2, 4.8, 6.4, 8.0];

// Beverages use much stricter energy/sugar bands (per 100 ml) — a cola must
// not score like a biscuit. From the Nutri-Score drinks table.
const BEV_ENERGY_KJ_STEPS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270];
const BEV_SUGAR_G_STEPS = [0, 1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5];

/** Points = number of thresholds strictly exceeded. */
const points = (value: number, steps: readonly number[]): number =>
  steps.filter((t) => value > t).length;

// ── Ingredient red flags ─────────────────────────────────────────────────────
// Each match subtracts SCORE penalty points and adds a negative line.
interface IngredientFlag {
  pattern: RegExp;
  label: string;
  /** Compact name used inside the one-line summary sentence. */
  short: string;
  penalty: number;
}

const INGREDIENT_FLAGS: readonly IngredientFlag[] = [
  {
    pattern: /\b(sugar|glucose|fructose|dextrose|maltodextrin|corn syrup|invert syrup|jaggery|honey)\b/i,
    label: 'Contains added sugars',
    short: 'added sugars',
    penalty: 3,
  },
  {
    pattern: /\bpalm(olein)?\s*(kernel)?\s*oil|\bpalmolein\b/i,
    label: 'Contains palm oil',
    short: 'palm oil',
    penalty: 2,
  },
  {
    pattern: /\b(aspartame|sucralose|acesulfame|saccharin|ins\s*95[015]|e\s*95[015])\b/i,
    label: 'Artificial sweeteners',
    short: 'artificial sweeteners',
    penalty: 3,
  },
  {
    pattern: /\b(monosodium glutamate|msg|ins\s*621|e\s*621)\b/i,
    label: 'Flavour enhancer (MSG)',
    short: 'MSG',
    penalty: 2,
  },
  {
    pattern: /\b(hydrogenated|partially hydrogenated|shortening)\b/i,
    label: 'Hydrogenated fats (trans-fat risk)',
    short: 'hydrogenated fats',
    penalty: 4,
  },
  {
    pattern: /\b(tartrazine|sunset yellow|ins\s*1(02|10|22|24|29)|e\s*1(02|10|22|24|29))\b/i,
    label: 'Artificial colours',
    short: 'artificial colours',
    penalty: 2,
  },
];

const MAX_FLAG_PENALTY = 10;

// ── Human-readable positives / negatives (UK FSA traffic-light thresholds) ──
function describe(n: LabelNutrition): { positives: string[]; negatives: string[] } {
  const positives: string[] = [];
  const negatives: string[] = [];

  if (n.sugar_g <= 5) positives.push('Low in sugar');
  else if (n.sugar_g > 22.5) negatives.push(`High sugar (${round1(n.sugar_g)}g per 100g)`);

  if (n.sat_fat_g <= 1.5) positives.push('Low in saturated fat');
  else if (n.sat_fat_g > 5) negatives.push(`High saturated fat (${round1(n.sat_fat_g)}g per 100g)`);

  if (n.sodium_mg <= 120) positives.push('Low in sodium');
  else if (n.sodium_mg > 600) negatives.push(`High sodium (${Math.round(n.sodium_mg)}mg per 100g)`);

  if (n.fiber_g >= 6) positives.push(`High in fibre (${round1(n.fiber_g)}g per 100g)`);
  else if (n.fiber_g >= 3) positives.push('Source of fibre');

  if (n.protein_g >= 10) positives.push(`High in protein (${round1(n.protein_g)}g per 100g)`);
  else if (n.protein_g >= 5) positives.push('Source of protein');

  if (n.energy_kcal > 400) negatives.push(`Calorie dense (${Math.round(n.energy_kcal)} kcal per 100g)`);

  return { positives, negatives };
}

const round1 = (v: number): number => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

// Piecewise map from Nutri-Score points onto a consumer-friendly 0–100 scale,
// anchored so each letter-grade band lands in an intuitive score range:
// A ≈ 86–100 · B ≈ 76–85 · C ≈ 56–75 · D ≈ 36–55 · E ≈ 0–35
const SCORE_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [-10, 100],
  [0, 85],
  [3, 75],
  [11, 55],
  [19, 35],
  [40, 0],
];

function mapNutriToScore(nutri: number): number {
  let prevX = -10;
  let prevY = 100;
  if (nutri <= prevX) return prevY;
  for (const [x, y] of SCORE_ANCHORS.slice(1)) {
    if (nutri <= x) return prevY + ((nutri - prevX) / (x - prevX)) * (y - prevY);
    prevX = x;
    prevY = y;
  }
  return 0;
}

/**
 * Compute the CalSnap Health Score for a product.
 * Pure function — no I/O, fully unit-testable.
 * `isBeverage` switches energy/sugar to the stricter drinks thresholds.
 */
export function computeHealthScore(
  per100g: LabelNutrition,
  ingredients: readonly string[],
  isBeverage = false,
): HealthScoreDetail {
  // 1. Nutri-Score points — kept per-component so the summary can name the
  //    biggest drivers of the final score.
  const energyKj = per100g.energy_kcal * 4.184;
  const energyPts = points(energyKj, isBeverage ? BEV_ENERGY_KJ_STEPS : ENERGY_KJ_STEPS);
  const sugarPts = points(per100g.sugar_g, isBeverage ? BEV_SUGAR_G_STEPS : SUGAR_G_STEPS);
  const satFatPts = points(per100g.sat_fat_g, SAT_FAT_G_STEPS);
  const sodiumPts = points(per100g.sodium_mg, SODIUM_MG_STEPS);
  const negativePts = energyPts + sugarPts + satFatPts + sodiumPts;

  const fiberPts = points(per100g.fiber_g, FIBER_G_STEPS);
  const proteinPts = points(per100g.protein_g, PROTEIN_G_STEPS);
  const positivePts = fiberPts + proteinPts;

  const nutriPoints = negativePts - positivePts; // range −10 … 40

  // 2. Letter grade from official Nutri-Score bands
  const grade: HealthScoreDetail['grade'] =
    nutriPoints <= -1 ? 'A' : nutriPoints <= 2 ? 'B' : nutriPoints <= 10 ? 'C' : nutriPoints <= 18 ? 'D' : 'E';

  // 3. Map points onto 0–100
  const baseScore = mapNutriToScore(nutriPoints);

  // 4. Ingredient flag penalties
  const ingredientText = ingredients.join(', ');
  const hitFlags = INGREDIENT_FLAGS.filter((f) => f.pattern.test(ingredientText));
  const flagPenalty = Math.min(
    hitFlags.reduce((sum, f) => sum + f.penalty, 0),
    MAX_FLAG_PENALTY,
  );

  const score = Math.round(clamp(baseScore - flagPenalty, 0, 100));

  // 5. Explanations
  const { positives, negatives } = describe(per100g);
  const allNegatives = [...negatives, ...hitFlags.map((f) => f.label)];

  const summary = buildSummary({
    score,
    energyPts,
    sugarPts,
    satFatPts,
    sodiumPts,
    fiberPts,
    proteinPts,
    flagShorts: hitFlags.map((f) => f.short),
  });

  return { score, grade, summary, positives, negatives: allNegatives };
}

// ── One-line reason ──────────────────────────────────────────────────────────

interface SummaryInput {
  score: number;
  energyPts: number;
  sugarPts: number;
  satFatPts: number;
  sodiumPts: number;
  fiberPts: number;
  proteinPts: number;
  flagShorts: readonly string[];
}

function joinList(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  const last = items[items.length - 1] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${last}`;
}

/**
 * Build a deterministic one-sentence explanation of the score, naming the
 * biggest point contributors first — so 45/100 never feels arbitrary.
 */
function buildSummary(s: SummaryInput): string {
  const negDrivers = [
    { name: 'high calorie density', pts: s.energyPts },
    { name: 'high sugar', pts: s.sugarPts },
    { name: 'high saturated fat', pts: s.satFatPts },
    { name: 'high sodium', pts: s.sodiumPts },
  ]
    .filter((d) => d.pts > 0)
    .sort((a, b) => b.pts - a.pts);

  const posDrivers = [
    { name: 'protein', pts: s.proteinPts },
    { name: 'fibre', pts: s.fiberPts },
  ]
    .filter((d) => d.pts > 0)
    .sort((a, b) => b.pts - a.pts);

  // Top two nutrient concerns + up to two flagged ingredients.
  const negNames = [...negDrivers.slice(0, 2).map((d) => d.name), ...s.flagShorts.slice(0, 2)];
  const posNames = posDrivers.map((d) => d.name);

  if (s.score >= 76 || negNames.length === 0) {
    if (posNames.length === 0) {
      return 'No significant nutritional strengths or concerns on this label.';
    }
    const tail = negNames.length > 0 ? ` Keep an eye on the ${joinList(negNames.map(stripHigh))}.` : '';
    return `Rated high for its ${joinList(posNames)} content.${tail}`;
  }

  if (s.score >= 56) {
    const support = posNames.length > 0 ? `, though ${joinList(posNames)} work in its favour` : '';
    return `Held back by ${joinList(negNames)}${support}.`;
  }

  const offset = posNames.length > 0 ? `, despite good ${joinList(posNames)}` : '';
  return `Rated low mainly due to ${joinList(negNames)}${offset}.`;
}

/** "high sugar" → "sugar" for softer phrasing in high-score sentences. */
function stripHigh(name: string): string {
  return name.replace(/^high /, '');
}
