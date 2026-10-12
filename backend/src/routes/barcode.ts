import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import type { LabelScanData, LabelNutrition } from '../types/shared';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { computeHealthScore } from '../lib/healthScore';

const router: ExpressRouter = Router();

/** The product as cached — a LabelScanData minus the derived health score. */
type CachedProduct = Omit<LabelScanData, 'health'>;

interface BarcodeResponse {
  result: LabelScanData;
  image_url: string | null;
  cached: boolean;
}

interface BarcodeAlternative {
  barcode: string;
  result: LabelScanData;
  image_url: string | null;
}

interface AlternativesResponse {
  alternatives: BarcodeAlternative[];
}

// Open Food Facts asks every caller to send an identifying User-Agent.
const OFF_UA = 'CalVue/1.0 (nutrition app; contact: calsnap.support@gmail.com)';
// Open Food Facts is often slow from outside Europe; one retry after a timeout
// or a 5xx turns most "sometimes it fails" lookups into a hit.
const OFF_TIMEOUT_MS = 10_000;
const OFF_ATTEMPTS = 2;

/** How many of the most specific OFF category tags to keep on a cached product. */
const MAX_CATEGORIES = 6;
/** A swap has to be clearly better, not a rounding error. */
const MIN_SWAP_GAIN = 8;
const MAX_ALTERNATIVES = 3;
/** Widen from the most specific tag to broader ones, but never past this many. */
const MAX_CATEGORY_TRIES = 3;
/** Candidate rows fetched per category before scoring. */
const CANDIDATE_LIMIT = 60;

type OffLookup = { status: number; product: Record<string, unknown> | null };

/** Fetch a product from Open Food Facts with a timeout and one retry. */
async function fetchOffProduct(code: string): Promise<OffLookup> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= OFF_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS);
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, {
        headers: { 'User-Agent': OFF_UA, Accept: 'application/json' },
        signal: controller.signal,
      });
      // OFF answers 404 for an unknown code; that is a definitive "not found",
      // not a reason to retry.
      if (r.status === 404) return { status: 0, product: null };
      if (r.status >= 500) throw new Error(`OFF ${r.status}`);
      const json = (await r.json()) as { status?: number; product?: Record<string, unknown> };
      return { status: json.status ?? 0, product: json.product ?? null };
    } catch (err) {
      lastErr = err;
      if (attempt < OFF_ATTEMPTS) await new Promise((res) => setTimeout(res, 400));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

/** EAN-8/13, UPC-A/E — 8 to 14 digits. */
function isValidBarcode(code: string): boolean {
  return /^\d{8,14}$/.test(code);
}

function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Map an Open Food Facts product to our per-100g LabelScanData shape.
 *  Exported for tests. */
export function mapOffProduct(off: Record<string, unknown>): { product: CachedProduct; imageUrl: string | null } | null {
  const n = (off.nutriments ?? {}) as Record<string, unknown>;

  // Energy: prefer kcal; fall back to kJ → kcal.
  let energy = toNum(n['energy-kcal_100g']);
  if (energy === 0 && n['energy_100g'] != null) energy = toNum(n['energy_100g']) / 4.184;

  const per_100g: LabelNutrition = {
    energy_kcal: Math.round(energy),
    protein_g: toNum(n['proteins_100g']),
    carbs_g: toNum(n['carbohydrates_100g']),
    sugar_g: toNum(n['sugars_100g']),
    total_fat_g: toNum(n['fat_100g']),
    sat_fat_g: toNum(n['saturated-fat_100g']),
    fiber_g: toNum(n['fiber_100g']),
    // OFF sodium is in grams; salt is a fallback (salt ÷ 2.5 = sodium).
    sodium_mg:
      n['sodium_100g'] != null ? Math.round(toNum(n['sodium_100g']) * 1000)
      : n['salt_100g'] != null ? Math.round((toNum(n['salt_100g']) / 2.5) * 1000)
      : 0,
  };

  // A product with no macros at all can't be logged meaningfully.
  const hasData =
    per_100g.energy_kcal > 0 || per_100g.protein_g > 0 || per_100g.carbs_g > 0 || per_100g.total_fat_g > 0;
  if (!hasData) return null;

  const name =
    (off.product_name as string) ||
    (off.product_name_en as string) ||
    (off.generic_name as string) ||
    'Packaged food';
  const brand = (((off.brands as string) ?? '').split(',')[0] ?? '').trim();

  // Beverage detection must be precise: the umbrella tag
  // "en:plant-based-foods-and-beverages" is on chips and nut butters too, so a
  // substring match wrongly flags solids as drinks (and applies the stricter
  // beverage score thresholds). Match OFF's specific drink tags, or a volume
  // quantity (ml / l), instead.
  const tags = (off.categories_tags as string[]) ?? [];
  const isBeverage =
    tags.some((t) => /^en:(beverages|waters|sodas|juices|soft-drinks|energy-drinks|teas|coffees|drinks)$/.test(t)) ||
    /\d\s*(ml|cl|l|litre|liter)\b/i.test(String(off.quantity ?? ''));

  const servingG = toNum(off.serving_quantity); // grams, when OFF has parsed it

  const ingredientsText = (off.ingredients_text as string) || '';

  // OFF lists categories broadest first, so the tail is the most specific.
  // Keep the last few: that is what "same aisle" means for a better swap.
  const categories = tags.filter((t): t is string => typeof t === 'string' && t.length > 0).slice(-MAX_CATEGORIES);

  return {
    product: {
      product_name: name.trim(),
      brand,
      serving_g: servingG > 0 ? Math.round(servingG) : 0,
      is_beverage: isBeverage,
      per_100g,
      ingredients: ingredientsText ? [ingredientsText] : [],
      confidence: 'high',
      notes: '',
      categories,
    },
    imageUrl: (off.image_front_url as string) || (off.image_url as string) || null,
  };
}

/** Attach a freshly-computed health score to a cached product. Exported for tests. */
export function withHealth(product: CachedProduct): LabelScanData {
  const health = computeHealthScore(product.per_100g, product.ingredients, product.is_beverage);
  return { ...product, health };
}

router.get(
  '/barcode/:code',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const code = String(req.params.code || '').trim();
      if (!isValidBarcode(code)) {
        res.status(400).json({ error: 'invalid_barcode', message: 'That barcode doesn’t look right.' });
        return;
      }

      // 1. Cache hit — serve instantly, recompute the score.
      const { data: cached } = await supabase
        .from('barcode_cache')
        .select('product, image_url')
        .eq('barcode', code)
        .maybeSingle();

      if (cached?.product) {
        const body: BarcodeResponse = {
          result: withHealth(cached.product as CachedProduct),
          image_url: (cached.image_url as string) ?? null,
          cached: true,
        };
        res.json(body);
        return;
      }

      // 2. Miss — ask Open Food Facts.
      let off: Record<string, unknown> | null = null;
      let status = 0;
      try {
        ({ status, product: off } = await fetchOffProduct(code));
      } catch (err) {
        console.warn('[barcode] OFF lookup failed', { code }, err instanceof Error ? err.message : err);
        res.status(504).json({ error: 'lookup_failed', message: 'Couldn’t reach the product database. Try again.' });
        return;
      }

      if (status !== 1 || !off) {
        res.status(404).json({ error: 'not_found', message: 'This product isn’t in the database yet.' });
        return;
      }

      const mapped = mapOffProduct(off);
      if (!mapped) {
        res.status(404).json({ error: 'no_nutrition', message: 'No nutrition info is available for this product.' });
        return;
      }

      // 3. Write through so the next scan is instant. Non-fatal on failure.
      await supabase
        .from('barcode_cache')
        .upsert({ barcode: code, product: mapped.product, image_url: mapped.imageUrl }, { onConflict: 'barcode' })
        .then(undefined, () => {});

      console.log(`[barcode] user=${req.user!.id} code=${code} product=${mapped.product.product_name}`);

      const body: BarcodeResponse = {
        result: withHealth(mapped.product),
        image_url: mapped.imageUrl,
        cached: false,
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

/** A cached row has the fields the scorer needs; reject anything else. */
function isCachedProduct(v: unknown): v is CachedProduct {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.product_name === 'string' &&
    typeof p.is_beverage === 'boolean' &&
    !!p.per_100g && typeof p.per_100g === 'object' &&
    Array.isArray(p.ingredients)
  );
}

/**
 * Better swap: higher-scoring products from the same category.
 *
 * Alternatives only ever come from `barcode_cache`, which is to say from
 * products someone using this app has already scanned. There is no bulk
 * import from Open Food Facts, so a brand-new install may see no swap for a
 * while; the list grows with use. Categories are the OFF tags stored on the
 * cached product, most specific last; the search starts from the most
 * specific tag and widens only when that aisle is too thin.
 */
router.get(
  '/barcode/:code/alternatives',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const code = String(req.params.code || '').trim();
    try {
      if (!isValidBarcode(code)) {
        res.status(400).json({ error: 'invalid_barcode', message: 'That barcode doesn’t look right.' });
        return;
      }

      const { data: cached, error: readErr } = await supabase
        .from('barcode_cache')
        .select('product')
        .eq('barcode', code)
        .maybeSingle();
      if (readErr) throw readErr;

      if (!cached?.product || !isCachedProduct(cached.product)) {
        res.status(404).json({ error: 'not_found', message: 'This product isn’t in the database yet.' });
        return;
      }

      const scanned = cached.product;
      const scannedScore = computeHealthScore(scanned.per_100g, scanned.ingredients, scanned.is_beverage).score;

      // Most specific first. No categories (a pre-categories row) means no swap.
      const tags = [...(scanned.categories ?? [])].reverse().slice(0, MAX_CATEGORY_TRIES);

      const seen = new Map<string, BarcodeAlternative>();
      const qualifying = (): BarcodeAlternative[] =>
        [...seen.values()]
          .filter((a) => a.result.health.score >= scannedScore + MIN_SWAP_GAIN)
          .sort((a, b) => b.result.health.score - a.result.health.score);

      for (const tag of tags) {
        // JSONB containment on the `product` column: the row's categories
        // must include this tag, and drinks only ever compare with drinks.
        const { data: rows, error: queryErr } = await supabase
          .from('barcode_cache')
          .select('barcode, product, image_url')
          .contains('product', { categories: [tag], is_beverage: scanned.is_beverage })
          .neq('barcode', code)
          .limit(CANDIDATE_LIMIT);
        if (queryErr) throw queryErr;

        for (const row of rows ?? []) {
          const barcode = String(row.barcode ?? '');
          if (!barcode || barcode === code || seen.has(barcode)) continue;
          if (!isCachedProduct(row.product)) continue;
          seen.set(barcode, {
            barcode,
            result: withHealth(row.product),
            image_url: typeof row.image_url === 'string' ? row.image_url : null,
          });
        }

        if (qualifying().length >= MAX_ALTERNATIVES) break;
      }

      const body: AlternativesResponse = { alternatives: qualifying().slice(0, MAX_ALTERNATIVES) };
      res.json(body);
    } catch (err) {
      console.warn('[barcode] alternatives failed', { code }, err instanceof Error ? err.message : err);
      res.status(500).json({ error: 'alternatives_failed', message: 'Couldn’t look for a better swap right now.' });
    }
  },
);

export default router;
