/**
 * Hydration domain rules — vessels, goals and formatting.
 *
 * Kept separate from the store so the numbers are unit-testable and so the
 * Home card, the hub sheet and the Water screen can never disagree about what
 * "a glass" holds.
 */

export interface Vessel {
  key: string;
  label: string;
  ml: number;
  /** Ionicons name. */
  icon: string;
}

/**
 * Indian household vessels. A "glass" is 250 ml here rather than the 200 ml
 * steel tumbler — 250 is what bottled water and most reusable glasses hold,
 * and it keeps the arithmetic honest against a litre-based goal.
 */
export const VESSELS: readonly Vessel[] = [
  { key: 'glass',  label: 'Glass',  ml: 250,  icon: 'cafe-outline' },
  { key: 'bottle', label: 'Bottle', ml: 500,  icon: 'water-outline' },
  { key: 'large',  label: 'Large',  ml: 1000, icon: 'flask-outline' },
];

/** The three amounts offered inline in the log hub — two taps and done. */
export const QUICK_ADD_ML: readonly number[] = [250, 500, 1000];

/** Anything outside this range is a typo, not a drink. Mirrors the DB CHECK. */
export const MIN_CUSTOM_ML = 10;
export const MAX_CUSTOM_ML = 5000;

const FALLBACK_GOAL_ML = 3000;
/**
 * Base ml of water per kg of body weight. Sits at the lower end of the common
 * 30–40 ml/kg guidance on purpose: ~20% of daily water comes from food (dal,
 * curd, fruit, tea), and this target only counts what you *drink*.
 */
const BASE_ML_PER_KG = 32;
const MIN_GOAL_ML = 1500;
const MAX_GOAL_ML = 5000;

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

/**
 * How much more a body loses to sweat as activity rises. Anchored at 1.0 for a
 * sedentary day; the top of the range adds ~40%, roughly the extra 0.5–1 L that
 * a hard daily workout calls for.
 */
const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.0,
  light: 1.1,
  moderate: 1.2,
  active: 1.3,
  very_active: 1.4,
};

/** Round to the nearest 250 ml and clamp to a sane band. */
function tidyGoal(ml: number): number {
  return Math.min(MAX_GOAL_ML, Math.max(MIN_GOAL_ML, Math.round(ml / 250) * 250));
}

/**
 * The recommended daily *drinking* goal from body weight and activity — the
 * value used when the user hasn't set their own. `waterGoalMl` prefers an
 * explicit goal over this.
 *
 * A 50 kg desk worker and a 95 kg athlete should not see the same number, and
 * before this the activity half was ignored entirely.
 */
export function recommendedWaterMl(
  weightKg: number | null | undefined,
  activity: ActivityLevel | null | undefined,
): number {
  if (!weightKg || weightKg <= 0) return FALLBACK_GOAL_ML;
  const mult = (activity && ACTIVITY_MULTIPLIER[activity]) || ACTIVITY_MULTIPLIER.sedentary;
  return tidyGoal(weightKg * BASE_ML_PER_KG * mult);
}

/**
 * The goal to show, in order of preference: what the user set, then the
 * weight + activity recommendation, then 3 L.
 */
export function waterGoalMl(
  explicitGoal: number | null | undefined,
  weightKg: number | null | undefined,
  activity?: ActivityLevel | null,
): number {
  if (explicitGoal && explicitGoal > 0) return explicitGoal;
  return recommendedWaterMl(weightKg, activity);
}

/** "1.2 L" above a litre, "750 ml" below — never "0.75 L". */
export function formatMl(ml: number): string {
  if (ml >= 1000) {
    const litres = ml / 1000;
    // Drop a trailing ".0" so a round 2 L doesn't read as "2.0 L".
    return `${litres % 1 === 0 ? litres : litres.toFixed(1)} L`;
  }
  return `${Math.round(ml)} ml`;
}

/** Approximate glasses, for the "5 glasses logged" line. */
export function glassesOf(ml: number): number {
  return Math.round(ml / VESSELS[0].ml);
}

/**
 * Progress 0–1, clamped. Over-drinking shouldn't overflow the ring — the
 * "+300 ml over" copy carries that instead.
 */
export function waterProgress(consumedMl: number, goalMl: number): number {
  if (goalMl <= 0) return 0;
  return Math.min(1, Math.max(0, consumedMl / goalMl));
}

/** Clamp a typed custom amount to something the database will accept. */
export function clampCustomMl(ml: number): number {
  return Math.min(MAX_CUSTOM_ML, Math.max(MIN_CUSTOM_ML, Math.round(ml)));
}

/** "1:40 PM" — matches the time format used in the meal log rows. */
export function formatLogTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
