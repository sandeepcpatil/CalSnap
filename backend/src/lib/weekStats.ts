/**
 * Weekly recap statistics — computed from raw logs, never by the AI.
 *
 * The recap's numbers are the source of truth: Gemini only writes prose around
 * them. Everything here is pure so it can be unit-tested and so the same figures
 * feed both the AI prompt and the deterministic fallback.
 */

export interface ProfileForRecap {
  daily_calorie_goal: number | null;
  daily_protein_goal: number | null;
  daily_water_ml_goal: number | null;
  weight_kg: number | null;
  activity_level: string | null;
}

export interface FoodRow {
  logged_at: string;
  calories: number | string;
  protein_g: number | string;
  sodium_mg?: number | string;
}
export interface WaterRow {
  logged_at: string;
  amount_ml: number | string;
}
export interface WeightRow {
  logged_at: string;
  weight_kg: number | string;
}

export interface WeekStats {
  week_start: string;
  week_end: string;
  week_label: string;
  days_logged: number;
  avg_calories: number;
  calorie_goal: number;
  avg_protein: number;
  protein_goal: number;
  days_protein_low: number;
  water_goal_ml: number;
  days_water_goal_hit: number;
  days_with_water: number;
  weight_change_kg: number | null;
  best_protein_day_kg: number | null;
  avg_sodium_mg: number;
  /** Days over the WHO 2,000 mg/day sodium guideline. */
  days_high_sodium: number;
}

/** WHO recommends staying under this much sodium per day. */
const HIGH_SODIUM_MG = 2000;

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A UTC day key (`YYYY-MM-DD`) for a timestamp — matches how the app buckets. */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

const ACTIVITY_MULT: Record<string, number> = {
  sedentary: 1.0, light: 1.1, moderate: 1.2, active: 1.3, very_active: 1.4,
};

/** Mirror of the app's water-goal derivation (weight × 32 ml × activity). */
export function waterGoalMl(p: ProfileForRecap): number {
  if (p.daily_water_ml_goal && p.daily_water_ml_goal > 0) return p.daily_water_ml_goal;
  if (p.weight_kg && p.weight_kg > 0) {
    const mult = (p.activity_level && ACTIVITY_MULT[p.activity_level]) || 1.0;
    return Math.min(5000, Math.max(1500, Math.round((p.weight_kg * 32 * mult) / 250) * 250));
  }
  return 3000;
}

/** "21–27 Jul" (or "28 Jul – 3 Aug" across a month boundary). */
export function weekLabel(startISO: string, endISO: string): string {
  const [ys, ms, ds] = startISO.split('-').map(Number);
  const [ye, me, de] = endISO.split('-').map(Number);
  if (ms === me) return `${ds}–${de} ${MONTHS[(ms ?? 1) - 1]}`;
  return `${ds} ${MONTHS[(ms ?? 1) - 1]} – ${de} ${MONTHS[(me ?? 1) - 1]}`;
}

/**
 * The most recently completed Mon–Sun week, in UTC. Returns date keys plus the
 * timestamp bounds to query against (`[startTs, endTs)`).
 */
export function lastCompletedWeek(now = new Date()): {
  week_start: string;
  week_end: string;
  startTs: string;
  endTs: string;
} {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Days since Monday (0 = Mon … 6 = Sun).
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  const thisMonday = new Date(d);
  thisMonday.setUTCDate(d.getUTCDate() - sinceMonday);
  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setUTCDate(thisMonday.getUTCDate() - 1);

  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return {
    week_start: iso(lastMonday),
    week_end: iso(lastSunday),
    startTs: `${iso(lastMonday)}T00:00:00.000Z`,
    endTs: `${iso(thisMonday)}T00:00:00.000Z`,
  };
}

export function computeWeekStats(
  bounds: { week_start: string; week_end: string },
  food: readonly FoodRow[],
  water: readonly WaterRow[],
  weight: readonly WeightRow[],
  profile: ProfileForRecap,
): WeekStats {
  // Food per day.
  const calByDay = new Map<string, number>();
  const protByDay = new Map<string, number>();
  const sodByDay = new Map<string, number>();
  for (const r of food) {
    const k = dayKey(r.logged_at);
    calByDay.set(k, (calByDay.get(k) ?? 0) + num(r.calories));
    protByDay.set(k, (protByDay.get(k) ?? 0) + num(r.protein_g));
    sodByDay.set(k, (sodByDay.get(k) ?? 0) + num(r.sodium_mg));
  }
  const loggedDays = [...calByDay.keys()];
  const daysLogged = loggedDays.length;
  const avg = (m: Map<string, number>) =>
    loggedDays.length ? Math.round([...m.values()].reduce((s, v) => s + v, 0) / loggedDays.length) : 0;

  const proteinGoal = profile.daily_protein_goal ?? 80;
  const daysProteinLow = loggedDays.filter((k) => (protByDay.get(k) ?? 0) < proteinGoal).length;
  const bestProtein = loggedDays.length ? Math.round(Math.max(...loggedDays.map((k) => protByDay.get(k) ?? 0))) : null;

  // Water per day.
  const goal = waterGoalMl(profile);
  const waterByDay = new Map<string, number>();
  for (const r of water) {
    const k = dayKey(r.logged_at);
    waterByDay.set(k, (waterByDay.get(k) ?? 0) + num(r.amount_ml));
  }
  const daysWithWater = waterByDay.size;
  const daysWaterHit = [...waterByDay.values()].filter((v) => v >= goal).length;

  // Weight change across the week.
  const w = [...weight].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  const first = w[0];
  const last = w[w.length - 1];
  const weightChange =
    w.length >= 2 && first && last ? Math.round((num(last.weight_kg) - num(first.weight_kg)) * 10) / 10 : null;

  return {
    week_start: bounds.week_start,
    week_end: bounds.week_end,
    week_label: weekLabel(bounds.week_start, bounds.week_end),
    days_logged: daysLogged,
    avg_calories: avg(calByDay),
    calorie_goal: profile.daily_calorie_goal ?? 2000,
    avg_protein: avg(protByDay),
    protein_goal: proteinGoal,
    days_protein_low: daysProteinLow,
    water_goal_ml: goal,
    days_water_goal_hit: daysWaterHit,
    days_with_water: daysWithWater,
    weight_change_kg: weightChange,
    best_protein_day_kg: bestProtein,
    avg_sodium_mg: avg(sodByDay),
    days_high_sodium: loggedDays.filter((k) => (sodByDay.get(k) ?? 0) > HIGH_SODIUM_MG).length,
  };
}
