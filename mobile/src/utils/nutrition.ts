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

// ─── Nutri-Insight (rule-based) ─────────────────────────────────────────────────
// Personalized, instant, offline, and free — derived from the user's real macros
// for the day. Returns a single sentence for the Dashboard insight card.

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
    return 'No meals logged yet today — snap your first meal to start tracking your macros.';
  }

  const calPct = calorieGoal > 0 ? calories / calorieGoal : 0;
  const proteinPct = proteinGoal > 0 ? protein / proteinGoal : 0;
  const proteinGap = Math.round(proteinGoal - protein);
  const hour = new Date().getHours();

  // Big calorie overshoot
  if (calPct >= 1.15) {
    return `You're ${Math.round(calories - calorieGoal)} kcal over your ${calorieGoal} goal — lighter, protein-forward choices will balance the rest of the day.`;
  }

  // Protein low while calories are already flowing — the most useful nudge
  if (proteinPct < 0.6 && calPct >= 0.4 && proteinGap > 0) {
    const idea =
      proteinGap >= 20
        ? 'grilled chicken or paneer'
        : proteinGap >= 10
          ? 'a boiled egg (~6g) or Greek yogurt (~10g)'
          : 'a handful of roasted chana';
    return `You're ${proteinGap}g short of your ${proteinGoal}g protein goal — ${idea} would close the gap.`;
  }

  // Under-fueling late in the day
  if (calPct < 0.5 && hour >= 18) {
    return `You've hit only ${Math.round(calPct * 100)}% of your ${calorieGoal} kcal goal — don't skip dinner, your body needs the fuel to recover.`;
  }

  // Dialed in
  if (proteinPct >= 0.9 && calPct >= 0.8 && calPct <= 1.1) {
    return `Dialed in — ${Math.round(protein)}g protein and right on your calorie target. This is what consistency looks like.`;
  }

  // Protein handled, calories to spare
  if (proteinPct >= 0.9 && calPct < 0.8) {
    return `Great protein at ${Math.round(protein)}g. You have ${Math.round(calorieGoal - calories)} kcal left — room for some healthy carbs or fats.`;
  }

  // Default progress read-out
  return `You're at ${Math.round(calPct * 100)}% of calories and ${Math.round(proteinPct * 100)}% of protein today. Steady progress — keep logging.`;
}
