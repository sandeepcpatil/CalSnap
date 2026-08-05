import { supabase } from './supabase';
import type { FoodItem } from './api';

export interface SavedMeal {
  id: string;
  name: string;
  items: FoodItem[];
  last_used_at: string | null;
  created_at: string;
}

/** Postgres unique-violation — the only DB error worth a bespoke message here. */
const UNIQUE_VIOLATION = '23505';

/** Matches the `length(name) <= 80` check on the table. */
export const MAX_MEAL_NAME_LENGTH = 80;

/**
 * Named combos the user builds once and re-logs — "my usual breakfast".
 *
 * Distinct from the automatic recent/frequent list: that one is derived from
 * `food_logs` and needs no storage, this one is deliberate. Both answer "I know
 * what I ate, don't make me photograph it", which is why they live behind one
 * entry point in the UI.
 */
export async function fetchSavedMeals(userId: string): Promise<SavedMeal[]> {
  const { data, error } = await supabase
    .from('saved_meals')
    .select('id, name, items, last_used_at, created_at')
    .eq('user_id', userId)
    // Most-used first; never-used meals fall to the bottom in creation order.
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as SavedMeal[]).filter((m) => Array.isArray(m.items) && m.items.length > 0);
}

export async function createSavedMeal(
  userId: string,
  name: string,
  items: readonly FoodItem[],
): Promise<SavedMeal> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Give the meal a name first.');
  if (items.length === 0) throw new Error('Add at least one food to the meal.');

  const { data, error } = await supabase
    .from('saved_meals')
    .insert({ user_id: userId, name: trimmed.slice(0, MAX_MEAL_NAME_LENGTH), items })
    .select('id, name, items, last_used_at, created_at')
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(`You already have a meal called “${trimmed}”. Pick another name.`);
    }
    throw new Error(error.message);
  }
  return data as SavedMeal;
}

export async function updateSavedMeal(
  mealId: string,
  name: string,
  items: readonly FoodItem[],
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Give the meal a name first.');
  if (items.length === 0) throw new Error('Add at least one food to the meal.');

  const { error } = await supabase
    .from('saved_meals')
    .update({ name: trimmed.slice(0, MAX_MEAL_NAME_LENGTH), items })
    .eq('id', mealId);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(`You already have a meal called “${trimmed}”. Pick another name.`);
    }
    throw new Error(error.message);
  }
}

export async function deleteSavedMeal(mealId: string): Promise<void> {
  const { error } = await supabase.from('saved_meals').delete().eq('id', mealId);
  if (error) throw new Error(error.message);
}

/**
 * Records that a meal was just logged, so the list ranks by real use.
 *
 * Deliberately not awaited by callers and never throws: failing to update a
 * sort key must not turn a successful log into an error message.
 */
export function touchSavedMeal(mealId: string): void {
  void supabase
    .from('saved_meals')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', mealId)
    .then(undefined, () => {});
}
