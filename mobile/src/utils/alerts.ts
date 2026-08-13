import type { Ionicons } from '@expo/vector-icons';

export type AlertTone = 'success' | 'warning' | 'info';

export interface SmartAlert {
  id: string;
  tone: AlertTone;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

export interface AlertInputs {
  totals: { calories: number; protein: number; carbs: number; fat: number };
  goals: { calorieGoal: number; proteinGoal: number };
  /** Meal types already logged today. */
  mealsLogged: ReadonlySet<string>;
  itemsLoggedToday: number;
  isOnTrial: boolean;
  trialDaysLeft: number | null;
  /** 0–23 local hour, injected so the logic stays pure/testable. */
  hour: number;
}

/**
 * Derive a short, prioritised list of alerts from the day's data. Pure function —
 * no side effects — so it can be unit-tested and re-run cheaply on every render.
 */
export function buildSmartAlerts(input: AlertInputs): SmartAlert[] {
  const { totals, goals, mealsLogged, itemsLoggedToday, isOnTrial, trialDaysLeft, hour } = input;
  const alerts: SmartAlert[] = [];

  // 1. Trial ending — highest priority so it's never missed.
  if (isOnTrial && trialDaysLeft !== null && trialDaysLeft <= 3) {
    alerts.push({
      id: 'trial',
      tone: 'warning',
      icon: 'time-outline',
      title: trialDaysLeft <= 1 ? 'Trial ends today' : `Trial ends in ${trialDaysLeft} days`,
      body: 'Subscribe to keep unlimited scans, macro insights and export.',
    });
  }

  // 2. Nothing logged yet, later in the day.
  if (itemsLoggedToday === 0) {
    if (hour >= 11) {
      alerts.push({
        id: 'empty-day',
        tone: 'info',
        icon: 'restaurant-outline',
        title: 'No meals logged yet',
        body: 'Snap your first meal to start tracking today.',
      });
    }
    return alerts; // nothing else meaningful to say with no data
  }

  // 3. Calorie status vs goal.
  const { calorieGoal } = goals;
  if (calorieGoal > 0) {
    const remaining = calorieGoal - totals.calories;
    if (totals.calories > calorieGoal * 1.05) {
      alerts.push({
        id: 'cal-over',
        tone: 'warning',
        icon: 'flame-outline',
        title: `${Math.round(totals.calories - calorieGoal).toLocaleString()} kcal over goal`,
        body: `You've had ${Math.round(totals.calories).toLocaleString()} of your ${calorieGoal.toLocaleString()} kcal target.`,
      });
    } else if (totals.calories >= calorieGoal * 0.9) {
      alerts.push({
        id: 'cal-ontrack',
        tone: 'success',
        icon: 'checkmark-circle-outline',
        title: 'On target for calories',
        body: `Nicely balanced — ${Math.round(totals.calories).toLocaleString()} of ${calorieGoal.toLocaleString()} kcal.`,
      });
    } else if (hour >= 18 && remaining > 0) {
      alerts.push({
        id: 'cal-under',
        tone: 'info',
        icon: 'trending-down-outline',
        title: `${Math.round(remaining).toLocaleString()} kcal remaining`,
        body: "You're under your goal — a balanced dinner can close the gap.",
      });
    }
  }

  // 4. Protein gap, flagged in the evening when the day is mostly done.
  const { proteinGoal } = goals;
  if (proteinGoal > 0 && hour >= 17 && totals.protein < proteinGoal * 0.6) {
    alerts.push({
      id: 'protein-low',
      tone: 'info',
      icon: 'barbell-outline',
      title: 'Protein is running low',
      body: `${Math.round(totals.protein)}g of ${proteinGoal}g so far — add a protein-rich snack.`,
    });
  }

  // 5. Missing core meals by time of day.
  const missing: string[] = [];
  if (hour >= 10 && !mealsLogged.has('breakfast')) missing.push('breakfast');
  if (hour >= 15 && !mealsLogged.has('lunch')) missing.push('lunch');
  if (hour >= 21 && !mealsLogged.has('dinner')) missing.push('dinner');
  if (missing.length > 0) {
    alerts.push({
      id: 'missing-meals',
      tone: 'info',
      icon: 'alert-circle-outline',
      title: `No ${missing.join(' or ')} logged`,
      body: 'Log it while it’s fresh so your daily totals stay accurate.',
    });
  }

  // 6. Positive reinforcement when the plate looks good and nothing else fired.
  if (alerts.length === 0 && itemsLoggedToday > 0) {
    alerts.push({
      id: 'all-good',
      tone: 'success',
      icon: 'sparkles-outline',
      title: "You're on track",
      body: `${itemsLoggedToday} item${itemsLoggedToday !== 1 ? 's' : ''} logged today. Keep the streak going!`,
    });
  }

  return alerts;
}

/**
 * A stable signature for a set of alerts on a given day. The bell's unread dot
 * compares the current signature against the one last seen: it clears when the
 * user opens the sheet, and re-appears only when a *new or different* alert
 * shows up (or a new day brings its own alerts) — not on every re-render.
 *
 * The date is part of the signature so yesterday's "no breakfast logged" and
 * today's are treated as distinct notifications worth surfacing again.
 */
export function alertsSignature(alerts: readonly SmartAlert[], dayKey: string): string {
  if (alerts.length === 0) return '';
  const ids = alerts.map((a) => a.id).sort();
  return `${dayKey}|${ids.join(',')}`;
}
