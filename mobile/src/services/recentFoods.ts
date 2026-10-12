import { supabase } from './supabase';
import type { FoodItem } from './api';
import { gramsFor, num } from '../utils/foodItems';

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
  sodium_mg: number;
  sugar_g: number;
  sat_fat_g: number;
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
    .select('food_name, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, sugar_g, sat_fat_g, raw_ai_response, logged_at')
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
      grams: num(stored?.grams) || gramsFor(quantity, unit),
      // Always use the row's own totals — they reflect what was actually logged.
      // `num` because the DECIMAL columns arrive as strings.
      calories: Math.round(num(row.calories)),
      protein_g: num(row.protein_g),
      carbs_g: num(row.carbs_g),
      fat_g: num(row.fat_g),
      fiber_g: num(row.fiber_g),
      sodium_mg: num(row.sodium_mg),
      sugar_g: num(row.sugar_g),
      sat_fat_g: num(row.sat_fat_g),
    });

    if (out.length >= limit) break;
  }

  return out;
}

/** A past food, ready to re-log, with the stats that justify its ranking. */
export interface LoggableFood {
  item: FoodItem;
  /** Times logged inside the frequency window. */
  count: number;
  /** ISO timestamp of the most recent log. */
  lastLoggedAt: string;
}

export interface LoggableFoods {
  /** Logged 3+ times in the window, most-logged first. */
  frequent: LoggableFood[];
  /** Everything, most recent first. */
  recent: LoggableFood[];
}

/** How far back "you log this often" looks. */
const FREQUENCY_WINDOW_DAYS = 30;
/** Below this, "often" is a lie — two logs is a coincidence. */
const FREQUENT_MIN_COUNT = 3;

/**
 * The user's own foods, ranked two ways for the re-log screen.
 *
 * Frequency is ranked above recency on purpose: for someone eating dal and
 * rice most nights, "what you eat a lot" predicts the next log far better than
 * "what you ate last". Recency stays as the second list for everything else.
 */
export async function fetchLoggableFoods(userId: string): Promise<LoggableFoods> {
  const since = new Date(Date.now() - FREQUENCY_WINDOW_DAYS * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from('food_logs')
    .select('food_name, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, sugar_g, sat_fat_g, raw_ai_response, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', since)
    .order('logged_at', { ascending: false })
    .limit(400);

  if (error || !data) return { frequent: [], recent: [] };

  // Group by name. The first row seen for a name is the most recent one, so it
  // defines the portion we offer — people's portions drift, and the latest is
  // the best guess at what they'll log next.
  const byName = new Map<string, LoggableFood>();

  for (const row of data as LogRow[]) {
    const name = (row.food_name ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();

    const existing = byName.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    const stored = loggedItemOf(row.raw_ai_response);
    const quantity = stored?.quantity ?? 1;
    const unit = stored?.unit ?? 'katori';

    byName.set(key, {
      count: 1,
      lastLoggedAt: row.logged_at,
      item: {
        name,
        quantity,
        unit,
        grams: num(stored?.grams) || gramsFor(quantity, unit),
        // Always the row's own totals — they reflect what was actually logged.
        // `num` because the DECIMAL columns arrive as strings.
        calories: Math.round(num(row.calories)),
        protein_g: num(row.protein_g),
        carbs_g: num(row.carbs_g),
        fat_g: num(row.fat_g),
        fiber_g: num(row.fiber_g),
        sodium_mg: num(row.sodium_mg),
        sugar_g: num(row.sugar_g),
        sat_fat_g: num(row.sat_fat_g),
      },
    });
  }

  const recent = [...byName.values()].sort(
    (a, b) => Date.parse(b.lastLoggedAt) - Date.parse(a.lastLoggedAt),
  );
  const frequent = recent
    .filter((f) => f.count >= FREQUENT_MIN_COUNT)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { frequent, recent };
}

/** The portion a user most often logs for a food, with how often they logged it. */
export interface UsualPortion {
  quantity: number;
  unit: string;
  grams: number;
  count: number;
}

/** How far back "your usual" looks. */
const USUAL_WINDOW_DAYS = 90;

/** Case-, space- and whitespace-insensitive key for a food name. */
export function normaliseFoodName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

interface UsualRow {
  food_name: string;
  logged_item: unknown;
}

/**
 * The most frequently logged (quantity, unit, grams) for each of `names`, from
 * the user's own logs over the last 90 days. Keys are the normalised names.
 *
 * One query, scoped to the user and the window; the name match happens here
 * rather than in the filter because food names are free text from the AI and
 * PostgREST filter syntax has no safe case-insensitive `IN`. Only the stored
 * `logged_item` is selected, not the whole AI payload, to keep the response
 * small.
 */
export async function getUsualPortions(
  userId: string,
  names: string[],
): Promise<Record<string, UsualPortion>> {
  const wanted = new Set(names.map(normaliseFoodName).filter(Boolean));
  if (wanted.size === 0) return {};

  const since = new Date(Date.now() - USUAL_WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('food_logs')
    .select('food_name, logged_item:raw_ai_response->logged_item')
    .eq('user_id', userId)
    .gte('logged_at', since)
    .order('logged_at', { ascending: false })
    .limit(1000);

  if (error || !data) return {};

  // name → portion key → tally. Rows arrive most recent first, so on a tie the
  // more recent portion wins (it is inserted first and never overtaken).
  const tallies = new Map<string, Map<string, UsualPortion>>();

  for (const row of data as unknown as UsualRow[]) {
    const stored = row.logged_item && typeof row.logged_item === 'object'
      ? (row.logged_item as Partial<FoodItem>)
      : null;
    const key = normaliseFoodName(String(stored?.name ?? row.food_name ?? ''));
    if (!key || !wanted.has(key)) continue;

    const quantity = num(stored?.quantity);
    const unit = typeof stored?.unit === 'string' && stored.unit ? stored.unit : '';
    const grams = num(stored?.grams);
    if (quantity <= 0 || !unit || grams <= 0) continue;

    const portionKey = `${quantity}|${unit}|${grams}`;
    let perName = tallies.get(key);
    if (!perName) {
      perName = new Map();
      tallies.set(key, perName);
    }
    const existing = perName.get(portionKey);
    if (existing) existing.count += 1;
    else perName.set(portionKey, { quantity, unit, grams, count: 1 });
  }

  const out: Record<string, UsualPortion> = {};
  for (const [key, perName] of tallies) {
    let best: UsualPortion | null = null;
    for (const p of perName.values()) {
      if (!best || p.count > best.count) best = p;
    }
    if (best) out[key] = best;
  }
  return out;
}
