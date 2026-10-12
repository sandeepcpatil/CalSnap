import { supabase } from './supabase';
import { uuidv4 } from '../utils/uuid';
import type { FoodItem } from './api';
import { normalizeLog, type FoodLog } from '../store/foodLogStore';
import { num, gramsFor } from '../utils/foodItems';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface LogFoodOptions {
  userId: string;
  items: readonly FoodItem[];
  mealType: MealType;
  /** Signed storage URL of the meal photo, when there was one. */
  imageUrl?: string | null;
  /**
   * Extra context stored on every row's `raw_ai_response` — the original scan
   * payload, or a marker for how the entry was created. A function gives each
   * item its own payload (used when re-logging rows that each carried one).
   */
  source?: Record<string, unknown> | ((item: FoodItem, index: number) => Record<string, unknown>);
}

/** A `food_logs` row with the AI payload column the store type leaves out. */
export type FoodLogRow = FoodLog & { raw_ai_response?: unknown };

/** The DB uses UTC day boundaries for a YYYY-MM-DD key (see `fetchLogsForDate`). */
function dayBounds(dayKey: string) {
  return { start: `${dayKey}T00:00:00.000Z`, end: `${dayKey}T23:59:59.999Z` };
}

/**
 * Every row the user logged on `dayKey`, in time order, including the raw AI
 * payload so the rows can be re-logged faithfully. Resolves to [] on error —
 * callers use this for optional affordances, never for the day's totals.
 */
export async function getLogsForDay(userId: string, dayKey: string): Promise<FoodLogRow[]> {
  const { start, end } = dayBounds(dayKey);
  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', start)
    .lte('logged_at', end)
    .order('logged_at', { ascending: true });

  if (error || !data) return [];
  // `normalizeLog` spreads the row, so `raw_ai_response` survives the coercion.
  return (data as FoodLogRow[]).map((row) => normalizeLog(row) as FoodLogRow);
}

/** Pull the stored FoodItem out of a log row's AI payload, when present. */
function loggedItemOf(raw: unknown): Partial<FoodItem> | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = (raw as { logged_item?: unknown }).logged_item;
  if (!item || typeof item !== 'object') return null;
  return item as Partial<FoodItem>;
}

/**
 * Rebuild the editable item a row was logged from. Rows written through
 * `logFoodItems` carry it verbatim; legacy rows fall back to the row's own
 * totals with a neutral portion.
 */
function itemFromLog(log: FoodLogRow): FoodItem {
  const stored = loggedItemOf(log.raw_ai_response);
  const quantity = num(stored?.quantity) || 1;
  const unit = typeof stored?.unit === 'string' && stored.unit ? stored.unit : 'katori';
  return {
    name: (log.food_name ?? '').trim() || 'Food item',
    quantity,
    unit,
    grams: num(stored?.grams) || gramsFor(quantity, unit),
    // The row's totals are what was actually logged; `num` because DECIMAL
    // columns arrive as strings.
    calories: Math.round(num(log.calories)),
    protein_g: num(log.protein_g),
    carbs_g: num(log.carbs_g),
    fat_g: num(log.fat_g),
    fiber_g: num(log.fiber_g),
    sodium_mg: num(log.sodium_mg),
    sugar_g: num(log.sugar_g),
    sat_fat_g: num(log.sat_fat_g),
    ...(stored?.source === 'database' || stored?.source === 'ai' ? { source: stored.source } : {}),
    ...(typeof stored?.matched_name === 'string' ? { matched_name: stored.matched_name } : {}),
  };
}

/**
 * Re-log copies of `logs` for today under `mealType`: same nutrition and AI
 * payload, fresh ids and `logged_at`. Goes through `logFoodItems` so History,
 * export and portion memory see rows of exactly the usual shape. Returns the
 * new rows so the caller can offer undo via `deleteLogWithUndo`.
 */
export async function repeatLogs(
  userId: string,
  logs: readonly FoodLogRow[],
  mealType: MealType,
): Promise<FoodLog[]> {
  if (logs.length === 0) throw new Error('Nothing to repeat.');

  const items = logs.map(itemFromLog);
  // Keep the photo only when every row came from the same one; a meal stitched
  // from several scans would otherwise show one scan's photo over all of it.
  const images = new Set(logs.map((l) => l.image_url).filter((u): u is string => !!u));
  const imageUrl = images.size === 1 ? [...images][0] : null;

  return logFoodItems({
    userId,
    items,
    mealType,
    imageUrl,
    source: (_item, i) => {
      const raw = logs[i].raw_ai_response;
      const original = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      // `logged_item` is re-attached by `logFoodItems` from the rebuilt item.
      const { logged_item: _dropped, ...rest } = original;
      return { ...rest, repeated_from: logs[i].id, repeated_from_date: logs[i].logged_at.slice(0, 10) };
    },
  });
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
      items.map((it, i) => ({
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
        raw_ai_response: {
          ...(typeof source === 'function' ? source(it, i) : source ?? {}),
          logged_item: it,
        },
        logged_at: loggedAt,
      })),
    )
    .select();

  if (error) throw new Error(error.message);
  return (data ?? []) as FoodLog[];
}
