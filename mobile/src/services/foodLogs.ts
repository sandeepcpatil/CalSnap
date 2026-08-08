import { supabase } from './supabase';
import { uuidv4 } from '../utils/uuid';
import type { FoodItem } from './api';
import type { FoodLog } from '../store/foodLogStore';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface LogFoodOptions {
  userId: string;
  items: readonly FoodItem[];
  mealType: MealType;
  /** Signed storage URL of the meal photo, when there was one. */
  imageUrl?: string | null;
  /**
   * Extra context stored on every row's `raw_ai_response` — the original scan
   * payload, or a marker for how the entry was created.
   */
  source?: Record<string, unknown>;
}

/**
 * Write a meal as one `food_logs` row per item.
 *
 * Per-item rows are what give History, the macro charts and the CSV export
 * their granularity. A shared `meal_id` lets History regroup them into one
 * card ("Dinner · 5 items"); a single item stays ungrouped so it reads as the
 * standalone entry it is.
 *
 * Every logging path in the app funnels through here so the row shape — and
 * in particular the `logged_item` payload that portion memory depends on —
 * can only be defined in one place.
 */
export async function logFoodItems({
  userId,
  items,
  mealType,
  imageUrl,
  source,
}: LogFoodOptions): Promise<FoodLog[]> {
  if (items.length === 0) throw new Error('Nothing to log.');

  const loggedAt = new Date().toISOString();
  // Must be a real UUID — `meal_id` is a uuid column. Generated in pure JS so
  // no native module (and therefore no rebuild) is required.
  const mealId = items.length > 1 ? uuidv4() : null;

  const { data, error } = await supabase
    .from('food_logs')
    .insert(
      items.map((it) => ({
        user_id: userId,
        image_url: imageUrl || null,
        meal_id: mealId,
        // food_name is NOT NULL and the name field is user-editable, so a
        // cleared field must not write an empty row.
        food_name: it.name.trim() || 'Food item',
        calories: it.calories,
        protein_g: it.protein_g,
        carbs_g: it.carbs_g,
        fat_g: it.fat_g,
        fiber_g: it.fiber_g,
        sodium_mg: it.sodium_mg ?? 0,
        sugar_g: it.sugar_g ?? 0,
        sat_fat_g: it.sat_fat_g ?? 0,
        meal_type: mealType,
        raw_ai_response: { ...(source ?? {}), logged_item: it },
        logged_at: loggedAt,
      })),
    )
    .select();

  if (error) throw new Error(error.message);
  return (data ?? []) as FoodLog[];
}
