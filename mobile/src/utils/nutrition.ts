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
