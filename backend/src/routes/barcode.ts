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

// Open Food Facts asks every caller to send an identifying User-Agent.
const OFF_UA = 'CalSnap/1.0 (nutrition app; contact: support@calsnap.app)';
const OFF_TIMEOUT_MS = 6000;

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
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS);
      let off: Record<string, unknown> | null = null;
      let status = 0;
      try {
        const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, {
          headers: { 'User-Agent': OFF_UA },
          signal: controller.signal,
        });
        const json = (await r.json()) as { status?: number; product?: Record<string, unknown> };
        status = json.status ?? 0;
        off = json.product ?? null;
      } catch {
        res.status(504).json({ error: 'lookup_failed', message: 'Couldn’t reach the product database. Try again.' });
        return;
      } finally {
        clearTimeout(timer);
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

export default router;
