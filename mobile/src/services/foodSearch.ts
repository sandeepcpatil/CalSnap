import { supabase } from './supabase';
import type { FoodItem } from './api';
import { num, itemFromFood } from '../utils/foodItems';

/**
 * A per-100g row from the `foods` table (IFCT + USDA SR Legacy), as returned by
 * the ranked `search_foods` Postgres function.
 */
export interface FoodDbRow {
  id: string;
  name: string;
  category: string | null;
  source: string;
  default_unit: string;
  energy_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

/** Below two characters the ranked search is noise, so we don't call it. */
export const MIN_FOOD_QUERY = 2;

/**
 * Ranked search over the shared food database.
 *
 * Ranking lives in Postgres (`search_foods`) rather than here because it needs
 * the trigram index and token scoring — a client-side filter over 7,800 rows
 * would be both slower and worse. Returns [] on any error so a flaky lookup
 * degrades to "no database matches" instead of breaking the add-food sheet.
 */
export async function searchFoods(query: string, limit = 20): Promise<FoodDbRow[]> {
  const q = query.trim();
  if (q.length < MIN_FOOD_QUERY) return [];

  const { data, error } = await supabase.rpc('search_foods', { search: q, max_results: limit });
  if (error || !data) return [];

  // Postgres `numeric` arrives as strings — coerce every macro at the boundary.
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    category: r.category ? String(r.category) : null,
    source: String(r.source ?? ''),
    default_unit: String(r.default_unit || 'g'),
    energy_kcal: num(r.energy_kcal),
    protein_g: num(r.protein_g),
    carbs_g: num(r.carbs_g),
    fat_g: num(r.fat_g),
    fiber_g: num(r.fiber_g),
  }));
}

/**
 * Turn a per-100g database row into a loggable FoodItem at a sensible starting
 * portion — a 100 g serving for gram-based foods, one of whatever household
 * unit the food defaults to otherwise. The user re-portions from there.
 */
export function itemFromDbFood(row: FoodDbRow): FoodItem {
  const unit = row.default_unit || 'g';
  const quantity = unit === 'g' ? 100 : 1;
  return itemFromFood(
    {
      name: row.name,
      unit,
      kcal: row.energy_kcal,
      p: row.protein_g,
      c: row.carbs_g,
      f: row.fat_g,
      fib: row.fiber_g,
    },
    quantity,
    unit,
  );
}

/** Short, human label for where a food came from — shown as a row badge. */
export function sourceLabel(source: string): string {
  if (source.startsWith('IFCT')) return 'IFCT';
  if (source.startsWith('USDA')) return 'USDA';
  return source;
}
