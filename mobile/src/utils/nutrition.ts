/**
 * Mifflin-St Jeor BMR formula + activity multiplier + goal adjustment.
 * Returns { dailyCalorieGoal, dailyProteinGoal }.
 */

type Gender = 'male' | 'female' | 'other';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type BodyGoal = 'lose_weight' | 'maintain' | 'gain_muscle';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENTS: Record<BodyGoal, number> = {
  lose_weight: -500,
  maintain: 0,
  gain_muscle: 300,
};

export function calculateGoals(params: {
  weight_kg: number;
  height_cm: number;
  age: number;
  gender: Gender;
  activity_level: ActivityLevel;
  body_goal: BodyGoal;
}): { dailyCalorieGoal: number; dailyProteinGoal: number } {
  const { weight_kg, height_cm, age, gender, activity_level, body_goal } = params;

  // BMR
  let bmr: number;
  if (gender === 'male') {
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
  } else {
    // female and other use female formula
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
  }

  const tdee = bmr * ACTIVITY_MULTIPLIERS[activity_level];
  const dailyCalorieGoal = Math.round(tdee + GOAL_ADJUSTMENTS[body_goal]);

  // Protein: 1.6g per kg body weight
  const dailyProteinGoal = Math.round(1.6 * weight_kg);

  return { dailyCalorieGoal, dailyProteinGoal };
}

export function getMealTypeFromTime(): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const hour = new Date().getHours();
  if (hour >= 5  && hour < 11) return 'breakfast'; // 5 AM – 10:59 AM
  if (hour >= 11 && hour < 15) return 'lunch';     // 11 AM – 2:59 PM
  if (hour >= 18 && hour < 23) return 'dinner';    // 6 PM – 10:59 PM
  return 'snack';                                  // all other hours → snack
}

export function formatCalories(kcal: number): string {
  return kcal.toLocaleString('en-IN');
}

export function formatMacro(value: number, unit = 'g'): string {
  return `${Math.round(value)}${unit}`;
}

// ─── Macro calorie split ────────────────────────────────────────────────────────
// Converts grams to the share of *calories* each macro contributes (protein·4,
// carbs·4, fat·9). Percentages always sum to ~100 when there is any data.

export interface MacroSplit {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  /** Total calories accounted for by the three macros. */
  total: number;
}

export function macroCalorieSplit(protein: number, carbs: number, fat: number): MacroSplit {
  const p = Math.max(protein, 0) * 4;
  const c = Math.max(carbs, 0) * 4;
  const f = Math.max(fat, 0) * 9;
  const total = p + c + f;
  if (total <= 0) {
    return { proteinPct: 0, carbsPct: 0, fatPct: 0, total: 0 };
  }
  return {
    proteinPct: (p / total) * 100,
    carbsPct: (c / total) * 100,
    fatPct: (f / total) * 100,
    total,
  };
}

// ─── Insight (rule-based) ───────────────────────────────────────────────────────
// Instant, offline and free — derived from the user's real macros for the day.
// Returns one plain sentence for the Dashboard "Insight" card. Not an AI
// feature, so the UI must not call it one.

export interface NutriTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutriGoals {
  calorieGoal: number;
  proteinGoal: number;
}

export function buildNutriInsight(totals: NutriTotals, goals: NutriGoals): string {
  const { calories, protein } = totals;
  const { calorieGoal, proteinGoal } = goals;

  if (calories <= 0) {
    return 'Nothing logged yet today. Your macros will appear here after your first meal.';
  }

  const calPct = calorieGoal > 0 ? calories / calorieGoal : 0;
  const proteinPct = proteinGoal > 0 ? protein / proteinGoal : 0;
  const proteinGap = Math.round(proteinGoal - protein);
  const hour = new Date().getHours();

  // Big calorie overshoot
  if (calPct >= 1.15) {
    return `You're ${Math.round(calories - calorieGoal)} kcal over your ${calorieGoal} kcal target. Lighter, higher-protein choices for the rest of the day will help.`;
  }

  // Protein low while calories are already flowing — the most useful nudge
  if (proteinPct < 0.6 && calPct >= 0.4 && proteinGap > 0) {
    const idea =
      proteinGap >= 20
        ? 'grilled chicken or paneer'
        : proteinGap >= 10
          ? 'a boiled egg (about 6 g) or Greek yogurt (about 10 g)'
          : 'a handful of roasted chana';
    return `You're ${proteinGap} g short of your ${proteinGoal} g protein target. ${idea.charAt(0).toUpperCase() + idea.slice(1)} would close the gap.`;
  }

  // Under-fueling late in the day
  if (calPct < 0.5 && hour >= 18) {
    return `You're at ${Math.round(calPct * 100)}% of your ${calorieGoal} kcal target with the evening still to go.`;
  }

  // Dialed in
  if (proteinPct >= 0.9 && calPct >= 0.8 && calPct <= 1.1) {
    return `${Math.round(protein)} g protein and calories are both on target today.`;
  }

  // Protein handled, calories to spare
  if (proteinPct >= 0.9 && calPct < 0.8) {
    return `Protein is on target at ${Math.round(protein)} g. ${Math.round(calorieGoal - calories)} kcal left for the day.`;
  }

  // Default progress read-out
  return `You're at ${Math.round(calPct * 100)}% of calories and ${Math.round(proteinPct * 100)}% of protein for today.`;
}
