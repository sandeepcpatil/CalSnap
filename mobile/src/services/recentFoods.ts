import { supabase } from './supabase';
import type { FoodItem } from './api';
import { gramsFor } from '../utils/foodItems';

/**
 * The user's own recently logged foods, most recent first and de-duplicated by
 * name.
 *
 * This is the highest-value source for the "add an item" flow: people eat the
 * same 20–30 things on repeat, so their own history out-performs any generic
 * database — and it costs no new infrastructure, since `food_logs` already
 * exists.
 *
 * Portion memory: when a row was logged through the item editor we stored the
 * exact `FoodItem` in `raw_ai_response.logged_item`, so we can offer the same
 * quantity and unit they picked last time instead of resetting to 1 serving.
 */

interface LogRow {
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  raw_ai_response: unknown;
  logged_at: string;
}

/** Pull the stored FoodItem out of a log row's AI payload, when present. */
function loggedItemOf(raw: unknown): Partial<FoodItem> | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = (raw as { logged_item?: unknown }).logged_item;
  if (!item || typeof item !== 'object') return null;
  return item as Partial<FoodItem>;
}

export async function fetchRecentFoods(userId: string, limit = 25): Promise<FoodItem[]> {
  // Scan a window of recent logs, then de-dupe — a user logging the same meal
  // daily would otherwise fill the list with one food.
  const { data, error } = await supabase
    .from('food_logs')
    .select('food_name, calories, protein_g, carbs_g, fat_g, fiber_g, raw_ai_response, logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(150);

  if (error || !data) return [];

  const seen = new Set<string>();
  const out: FoodItem[] = [];

  for (const row of data as LogRow[]) {
    const name = (row.food_name ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const stored = loggedItemOf(row.raw_ai_response);
    const quantity = stored?.quantity ?? 1;
    const unit = stored?.unit ?? 'katori';

    out.push({
      name,
      quantity,
      unit,
      grams: stored?.grams ?? gramsFor(quantity, unit),
      // Always use the row's own totals — they reflect what was actually logged.
      calories: Math.round(row.calories ?? 0),
      protein_g: row.protein_g ?? 0,
      carbs_g: row.carbs_g ?? 0,
      fat_g: row.fat_g ?? 0,
      fiber_g: row.fiber_g ?? 0,
    });

    if (out.length >= limit) break;
  }

  return out;
}
