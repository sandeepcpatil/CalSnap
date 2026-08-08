/**
 * Builds the compact, PRE-COMPUTED snapshot of a user's data that the coach is
 * allowed to talk about.
 *
 * This module is the anti-hallucination layer. The model never sees raw log
 * rows, because an LLM asked to sum 87 rows will get it wrong — and a coach
 * that misstates your calories is worse than no coach. Everything here is
 * arithmetic done in TypeScript; the model's only job is to talk about the
 * resulting numbers.
 *
 * Missing data is represented explicitly (null / 0-day counts) so the prompt can
 * instruct the model to say "I don't have that yet" instead of inventing it.
 */
import { supabase } from './supabase';
import { waterGoalMl, type ProfileForRecap } from './weekStats';

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

const r1 = (v: number): number => Math.round(v * 10) / 10;

/** How far back the "recent habits" window looks. */
const WINDOW_DAYS = 14;
/** How many distinct foods to name — enough to feel personal, small enough to stay cheap. */
const TOP_FOODS = 8;

export interface DayTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  sugar_g: number;
  sat_fat_g: number;
}

export interface ChatContext {
  profile: {
    first_name: string | null;
    body_goal: string | null;
    activity_level: string | null;
    weight_kg: number | null;
    target_weight_kg: number | null;
    calorie_goal: number;
    protein_goal: number;
    water_goal_ml: number;
  };
  today: {
    date: string;
    logged_items: number;
    meals_logged: string[];
    totals: DayTotals;
    water_ml: number;
    calories_remaining: number;
  };
  last_14_days: {
    days_logged: number;
    avg_calories: number;
    avg_protein_g: number;
    avg_sodium_mg: number;
    days_protein_below_goal: number;
    days_sodium_over_2000: number;
    days_water_goal_hit: number;
  };
  weight: {
    latest_kg: number | null;
    change_30d_kg: number | null;
    weigh_ins_30d: number;
  };
  /** Most-logged foods in the window, so the coach can reference real meals. */
  frequent_foods: { name: string; times: number }[];
}

/** `YYYY-MM-DD` for a timestamp, matching how the app buckets days. */
const dayKey = (iso: string): string => iso.slice(0, 10);

interface FoodRow {
  food_name: string;
  logged_at: string;
  meal_type: string | null;
  calories: unknown;
  protein_g: unknown;
  carbs_g: unknown;
  fat_g: unknown;
  fiber_g: unknown;
  sodium_mg: unknown;
  sugar_g: unknown;
  sat_fat_g: unknown;
}

export async function buildChatContext(userId: string): Promise<ChatContext> {
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [{ data: profileRow }, { data: foods }, { data: waters }, { data: weights }] = await Promise.all([
    supabase
      .from('profiles')
      .select('name, body_goal, activity_level, weight_kg, target_weight_kg, daily_calorie_goal, daily_protein_goal, daily_water_ml_goal')
      .eq('id', userId)
      .single(),
    supabase
      .from('food_logs')
      .select('food_name, logged_at, meal_type, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, sugar_g, sat_fat_g')
      .eq('user_id', userId)
      .gte('logged_at', since)
      .order('logged_at', { ascending: true }),
    supabase
      .from('water_logs')
      .select('logged_at, amount_ml')
      .eq('user_id', userId)
      .gte('logged_at', since),
    supabase
      .from('weight_logs')
      .select('logged_at, weight_kg')
      .eq('user_id', userId)
      .gte('logged_at', since30)
      .order('logged_at', { ascending: true }),
  ]);

  const p = (profileRow ?? {}) as Record<string, unknown>;
  const calorieGoal = num(p.daily_calorie_goal) || 2000;
  const proteinGoal = num(p.daily_protein_goal) || 80;
  const waterGoal = waterGoalMl({
    daily_water_ml_goal: p.daily_water_ml_goal == null ? null : num(p.daily_water_ml_goal),
    weight_kg: p.weight_kg == null ? null : num(p.weight_kg),
    activity_level: (p.activity_level as string) ?? null,
  } as ProfileForRecap);

  // ── Per-day aggregation ────────────────────────────────────────────────────
  const rows = (foods ?? []) as FoodRow[];
  const byDay = new Map<string, DayTotals>();
  const foodCounts = new Map<string, { name: string; times: number }>();
  const todayMeals = new Set<string>();
  let todayItems = 0;

  for (const row of rows) {
    const k = dayKey(row.logged_at);
    const t = byDay.get(k) ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0, sugar_g: 0, sat_fat_g: 0 };
    t.calories += num(row.calories);
    t.protein_g += num(row.protein_g);
    t.carbs_g += num(row.carbs_g);
    t.fat_g += num(row.fat_g);
    t.fiber_g += num(row.fiber_g);
    t.sodium_mg += num(row.sodium_mg);
    t.sugar_g += num(row.sugar_g);
    t.sat_fat_g += num(row.sat_fat_g);
    byDay.set(k, t);

    const name = (row.food_name ?? '').trim();
    if (name) {
      const key = name.toLowerCase();
      const prev = foodCounts.get(key);
      if (prev) prev.times += 1;
      else foodCounts.set(key, { name, times: 1 });
    }

    if (k === today) {
      todayItems += 1;
      if (row.meal_type) todayMeals.add(row.meal_type);
    }
  }

  const loggedDays = [...byDay.keys()];
  const emptyTotals: DayTotals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0, sugar_g: 0, sat_fat_g: 0 };
  const todayTotals = byDay.get(today) ?? emptyTotals;

  const avgOf = (f: (t: DayTotals) => number): number =>
    loggedDays.length ? Math.round(loggedDays.reduce((s, k) => s + f(byDay.get(k)!), 0) / loggedDays.length) : 0;

  // ── Water ──────────────────────────────────────────────────────────────────
  const waterByDay = new Map<string, number>();
  for (const w of (waters ?? []) as { logged_at: string; amount_ml: unknown }[]) {
    const k = dayKey(w.logged_at);
    waterByDay.set(k, (waterByDay.get(k) ?? 0) + num(w.amount_ml));
  }

  // ── Weight ─────────────────────────────────────────────────────────────────
  const wl = (weights ?? []) as { logged_at: string; weight_kg: unknown }[];
  const firstW = wl[0];
  const lastW = wl[wl.length - 1];
  const latestKg = lastW ? r1(num(lastW.weight_kg)) : p.weight_kg == null ? null : r1(num(p.weight_kg));
  const change30 = wl.length >= 2 && firstW && lastW ? r1(num(lastW.weight_kg) - num(firstW.weight_kg)) : null;

  return {
    profile: {
      first_name: ((p.name as string) ?? '').trim().split(' ')[0] || null,
      body_goal: (p.body_goal as string) ?? null,
      activity_level: (p.activity_level as string) ?? null,
      weight_kg: p.weight_kg == null ? null : r1(num(p.weight_kg)),
      target_weight_kg: p.target_weight_kg == null ? null : r1(num(p.target_weight_kg)),
      calorie_goal: calorieGoal,
      protein_goal: proteinGoal,
      water_goal_ml: waterGoal,
    },
    today: {
      date: today,
      logged_items: todayItems,
      meals_logged: [...todayMeals],
      totals: {
        calories: Math.round(todayTotals.calories),
        protein_g: r1(todayTotals.protein_g),
        carbs_g: r1(todayTotals.carbs_g),
        fat_g: r1(todayTotals.fat_g),
        fiber_g: r1(todayTotals.fiber_g),
        sodium_mg: Math.round(todayTotals.sodium_mg),
        sugar_g: r1(todayTotals.sugar_g),
        sat_fat_g: r1(todayTotals.sat_fat_g),
      },
      water_ml: Math.round(waterByDay.get(today) ?? 0),
      calories_remaining: Math.round(calorieGoal - todayTotals.calories),
    },
    last_14_days: {
      days_logged: loggedDays.length,
      avg_calories: avgOf((t) => t.calories),
      avg_protein_g: avgOf((t) => t.protein_g),
      avg_sodium_mg: avgOf((t) => t.sodium_mg),
      days_protein_below_goal: loggedDays.filter((k) => byDay.get(k)!.protein_g < proteinGoal).length,
      days_sodium_over_2000: loggedDays.filter((k) => byDay.get(k)!.sodium_mg > 2000).length,
      days_water_goal_hit: [...waterByDay.values()].filter((v) => v >= waterGoal).length,
    },
    weight: {
      latest_kg: latestKg,
      change_30d_kg: change30,
      weigh_ins_30d: wl.length,
    },
    frequent_foods: [...foodCounts.values()]
      .sort((a, b) => b.times - a.times)
      .slice(0, TOP_FOODS),
  };
}
