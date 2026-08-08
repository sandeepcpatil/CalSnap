import type { FoodItem } from '../types/shared';
import { supabase } from './supabase';

/**
 * Tier 3 — authoritative nutrition lookup.
 *
 * Gemini is good at *recognising* a dish and estimating its weight; it is not a
 * reliable nutrition database. So we keep the identification and throw away the
 * recalled macros: each item's name is matched against the `foods` table, and
 * the numbers are recomputed from that food's per-100 g values × the estimated
 * grams.
 *
 * Result: the same dish always yields the same macros, every value traces to a
 * source row that can be corrected once for all users, and accuracy no longer
 * depends on the model's memory.
 *
 * Items with no confident match keep the model's own estimate, flagged
 * `source: 'ai'` so hit rate is measurable.
 */

/**
 * Minimum trigram/alias score to trust a match. Real dish names score 1.0 via
 * exact or alias hits; unrelated foods land near 0.2 (verified against the
 * seeded table), so 0.5 separates them with margin.
 */
const MATCH_THRESHOLD = 0.5;

interface MatchRow {
  query: string;
  name: string;
  energy_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sat_fat_g: number;
  sodium_mg: number;
  score: number;
}

export interface EnrichedItem extends FoodItem {
  /** Where this item's nutrition came from — for measuring database coverage. */
  source: 'database' | 'ai';
  /** Canonical food name when matched, so users see what we matched against. */
  matched_name?: string;
}

/**
 * Replace AI-estimated macros with database values wherever we have a
 * confident match. Never throws — a lookup failure degrades to the AI estimate
 * rather than failing the scan.
 */
export async function enrichItems(items: FoodItem[]): Promise<EnrichedItem[]> {
  if (items.length === 0) return [];

  let matches = new Map<string, MatchRow>();
  try {
    const { data, error } = await supabase.rpc('match_foods', {
      queries: items.map((i) => i.name),
    });
    if (!error && Array.isArray(data)) {
      for (const row of data as MatchRow[]) {
        // Keep the best match per query string.
        const prev = matches.get(row.query);
        if (!prev || row.score > prev.score) matches.set(row.query, row);
      }
    }
  } catch {
    // Lookup unavailable — fall through and keep the AI's numbers.
    matches = new Map();
  }

  return items.map((item): EnrichedItem => {
    const m = matches.get(item.name);
    if (!m || m.score < MATCH_THRESHOLD || item.grams <= 0) {
      return { ...item, source: 'ai' };
    }

    // Database values are per 100 g; scale to the estimated portion.
    const k = item.grams / 100;
    const r1 = (v: number) => Math.round((v ?? 0) * k * 10) / 10;
    return {
      ...item,
      calories: Math.round((m.energy_kcal ?? 0) * k),
      protein_g: r1(m.protein_g),
      carbs_g: r1(m.carbs_g),
      fat_g: r1(m.fat_g),
      fiber_g: r1(m.fiber_g),
      // Real sodium/sugar/sat-fat from the foods table — far better than the
      // AI's guess, especially for salt, which is invisible in a photo.
      sugar_g: r1(m.sugar_g),
      sat_fat_g: r1(m.sat_fat_g),
      sodium_mg: Math.round((m.sodium_mg ?? 0) * k),
      source: 'database',
      matched_name: m.name,
    };
  });
}

/** Recompute plate totals after enrichment. */
export function totalsOf(items: readonly EnrichedItem[]) {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    calories: Math.round(items.reduce((s, i) => s + i.calories, 0)),
    protein_g: r1(items.reduce((s, i) => s + i.protein_g, 0)),
    carbs_g: r1(items.reduce((s, i) => s + i.carbs_g, 0)),
    fat_g: r1(items.reduce((s, i) => s + i.fat_g, 0)),
    fiber_g: r1(items.reduce((s, i) => s + i.fiber_g, 0)),
    sugar_g: r1(items.reduce((s, i) => s + i.sugar_g, 0)),
    sat_fat_g: r1(items.reduce((s, i) => s + i.sat_fat_g, 0)),
    sodium_mg: Math.round(items.reduce((s, i) => s + i.sodium_mg, 0)),
  };
}
