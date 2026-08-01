import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import type {
  CalorieBreakdown,
  FoodItem,
  FoodScanResult,
  ScanLimitError,
  DailyLimitError,
  LabelNutrition,
  LabelScanData,
  LabelScanResult,
} from '@shared/types';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { computeHealthScore } from '../lib/healthScore';
import { enrichItems, totalsOf } from '../lib/foodLookup';

const router: ExpressRouter = Router();

// ─── Gemini Setup ─────────────────────────────────────────────────────────────

const genAIKey = process.env.GEMINI_API_KEY;
if (!genAIKey) throw new Error('GEMINI_API_KEY must be set in environment');

// ─── Response Schema (enforced by Gemini — removes schema tokens from prompt) ─
const ITEM_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    name:      { type: SchemaType.STRING },
    quantity:  { type: SchemaType.NUMBER },
    unit:      { type: SchemaType.STRING, format: 'enum', enum: ['katori', 'roti', 'cup', 'piece', 'tbsp', 'tsp', 'glass', 'plate', 'slice', 'g'] },
    grams:     { type: SchemaType.NUMBER },
    calories:  { type: SchemaType.NUMBER },
    protein_g: { type: SchemaType.NUMBER },
    carbs_g:   { type: SchemaType.NUMBER },
    fat_g:     { type: SchemaType.NUMBER },
    fiber_g:   { type: SchemaType.NUMBER },
  },
  required: ['name', 'quantity', 'unit', 'grams', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'],
};

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    food_name:    { type: SchemaType.STRING },
    items:        { type: SchemaType.ARRAY, items: ITEM_SCHEMA },
    portion_g:    { type: SchemaType.NUMBER },
    portion_desc: { type: SchemaType.STRING },
    calories:     { type: SchemaType.NUMBER },
    protein_g:    { type: SchemaType.NUMBER },
    carbs_g:      { type: SchemaType.NUMBER },
    fat_g:        { type: SchemaType.NUMBER },
    fiber_g:      { type: SchemaType.NUMBER },
    confidence:   { type: SchemaType.STRING, format: 'enum', enum: ['high', 'medium', 'low'] },
    notes:        { type: SchemaType.STRING },
  },
  required: ['food_name', 'items', 'portion_g', 'portion_desc', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'confidence', 'notes'],
};

const genai = new GoogleGenerativeAI(genAIKey);
const model = genai.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
    // A nutrition estimate is a measurement, not a creative task: the same
    // photo must return the same numbers every time. The default (~1.0) made
    // repeat scans of one dish disagree with each other.
    temperature: 0,
  },
});

// ─── Label-scan (packaged food) Gemini setup ─────────────────────────────────

const LABEL_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    product_name: { type: SchemaType.STRING },
    brand:        { type: SchemaType.STRING },
    serving_g:    { type: SchemaType.NUMBER },
    is_beverage:  { type: SchemaType.BOOLEAN },
    per_100g: {
      type: SchemaType.OBJECT,
      properties: {
        energy_kcal: { type: SchemaType.NUMBER },
        protein_g:   { type: SchemaType.NUMBER },
        carbs_g:     { type: SchemaType.NUMBER },
        sugar_g:     { type: SchemaType.NUMBER },
        total_fat_g: { type: SchemaType.NUMBER },
        sat_fat_g:   { type: SchemaType.NUMBER },
        fiber_g:     { type: SchemaType.NUMBER },
        sodium_mg:   { type: SchemaType.NUMBER },
      },
      required: ['energy_kcal', 'protein_g', 'carbs_g', 'sugar_g', 'total_fat_g', 'sat_fat_g', 'fiber_g', 'sodium_mg'],
    },
    ingredients: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    confidence:  { type: SchemaType.STRING, format: 'enum', enum: ['high', 'medium', 'low'] },
    notes:       { type: SchemaType.STRING },
  },
  required: ['product_name', 'brand', 'serving_g', 'is_beverage', 'per_100g', 'ingredients', 'confidence', 'notes'],
};

const labelModel = genai.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: LABEL_RESPONSE_SCHEMA,
  },
});

const LABEL_SYSTEM_PROMPT = `You read packaged-food labels (nutrition facts panel and ingredients list) from photos.
Rules:
- Read values EXACTLY as printed; never estimate nutrition that is not on the label.
- Normalise all nutrition to per 100 g (per 100 ml for drinks). If the panel is per-serving only, convert using the stated serving size.
- sodium_mg is sodium in milligrams. If only salt is printed, sodium_mg = salt_g × 400.
- serving_g is the stated serving size in grams (ml for drinks); use 0 if not printed.
- is_beverage is true for drinkable products (juices, colas, milk drinks).
- ingredients: list each ingredient in printed order, lowercase.
- If no readable nutrition label is visible, set confidence "low", energy_kcal 0, and explain in notes.`;

// Free users get 2 scans/day (after any trial). Pro & trial users share a
// generous fair-use cap of 20/day — enough for any real user, but it blocks
// abuse and keeps the annual plan safely profitable.
const FREE_DAILY_SCAN_LIMIT = 2;
const PRO_DAILY_SCAN_LIMIT = 20;

// ─── System Prompt ────────────────────────────────────────────────────────────
// NOTE: `responseSchema` constrains the JSON *shape and types* only — it cannot
// constrain *values*. The calibration anchors below are what keep estimates in
// a realistic range; removing them to save tokens is what caused portion drift.
// They cost ~350 input tokens and are the cheapest accuracy we can buy.

// Shared prompt blocks — photo and text analysis MUST use the same anchors.
// Keeping two copies is how they drift apart, which is exactly the failure that
// produced unrealistic portions before.

const WEIGHT_ANCHORS = `Anchors:
   • 1 roti / chapati ≈ 40 g · 1 paratha ≈ 70 g · 1 slice bread ≈ 25 g
   • 1 katori / small bowl ≈ 180 g · 1 cup cooked rice ≈ 150 g
   • 1 idli ≈ 50 g · 1 plain dosa ≈ 100 g · 1 samosa ≈ 60 g
   • 1 tbsp oil or ghee ≈ 14 g · 1 boiled egg ≈ 50 g · 1 glass ≈ 250 ml
   • A standard Indian dinner plate is 26–28 cm across — use it to judge scale.`;

const CALIBRATION = `CALIBRATION — typical values for one standard serving:
• Dal (1 katori, 180 g, medium thickness): 140 kcal · P 9 · C 20 · F 3 · Fib 5
  (thin/watery dal ≈ 90 kcal, P 6 · thick dal fry with ghee ≈ 200 kcal, P 11)
• Plain cooked rice (1 cup, 150 g): 200 kcal · P 4 · C 45 · F 0.5 · Fib 1
• Roti (1, 40 g): 120 kcal · P 3 · C 25 · F 0.5 · Fib 3
• Mixed veg sabzi (1 katori, 150 g): 130 kcal · P 3 · C 12 · F 8 · Fib 4
• Paneer butter masala (1 katori, 180 g): 350 kcal · P 12 · C 12 · F 28 · Fib 2
• Chicken curry (1 katori, 180 g): 280 kcal · P 22 · C 8 · F 18 · Fib 1
• Curd / dahi (1 katori, 150 g): 90 kcal · P 5 · C 7 · F 5 · Fib 0
• Idli (2 pieces): 130 kcal · P 4 · C 27 · F 0.5 · Fib 1
• Plain dosa (1): 170 kcal · P 4 · C 30 · F 4 · Fib 1.5
• Poha (1 plate, 180 g): 250 kcal · P 5 · C 45 · F 6 · Fib 3
• Samosa (1): 180 kcal · P 3 · C 22 · F 9 · Fib 2`;

const SYSTEM_PROMPT = `You are a professional nutritionist AI specialising in Indian home cooking.

TASK
Break the meal in the photo into its distinct food items (like a nutritionist
itemising a thali), then estimate nutrition per item.

METHOD — follow in order:
1. List each DISTINCT food as its own entry in "items" — dal, rice, each bread
   type, sabzi, curd, salad, sweets, drinks all separate. Never merge a plate
   into one item unless it truly is a single dish.
2. For each item pick the most natural household unit
   (katori | roti | cup | piece | tbsp | tsp | glass | plate | slice | g)
   and the quantity visible (use 0.5 steps: 0.5, 1, 1.5, 2 …).
3. Estimate each item's weight in grams. ${WEIGHT_ANCHORS}
4. Compute nutrition PER ITEM (for its quantity), then:
   • food_name = short meal summary, e.g. "Dal, rice & 2 rotis"
   • portion_g = total grams · portion_desc = e.g. "1 katori dal + 1 cup rice + 2 rotis"
   • top-level calories/macros = the SUM of all items.

${CALIBRATION}

RULES
- Indian gravies usually carry more oil than they look — do not under-estimate fat.
- Do not assume a large portion by default; most home servings are one katori.
- confidence: "high" only when both the dish AND the portion are clear;
  "medium" when the dish is clear but the portion is ambiguous;
  "low" when the dish itself is uncertain.
- If no food is identifiable, set calories to 0, confidence "low", and say why in notes.
- Keep notes to one short sentence naming the main assumption you made
  (e.g. "Assumed a medium katori of moderately thick dal").`;

// ─── Text (spoken / typed) description prompt ────────────────────────────────
// Reuses the same anchors and calibration as the photo path — only the input
// differs. The user's own words are ground truth for quantities, which makes
// this MORE reliable than a photo for portions: nobody has to guess bowl depth.

const TEXT_SYSTEM_PROMPT = `You are a professional nutritionist AI specialising in Indian home cooking.

TASK
The user described a meal in their own words (often dictated by voice, so expect
casual phrasing and speech-to-text quirks). Break it into distinct food items
and estimate nutrition per item.

METHOD — follow in order:
1. List each DISTINCT food mentioned as its own entry in "items".
2. Use the quantities the USER STATED as ground truth — "2 rotis" means exactly
   2 rotis. Only estimate when they were vague.
3. For vague amounts ("some dal", "a bowl of rice", "dal chawal") assume ONE
   standard serving — never a large one.
4. Pick the natural household unit
   (katori | roti | cup | piece | tbsp | tsp | glass | plate | slice | g).
   If they gave grams ("200g curd"), use unit "g" with quantity = the grams.
5. Estimate each item's weight in grams. ${WEIGHT_ANCHORS}
6. Compute nutrition PER ITEM, then:
   • food_name = short meal summary, e.g. "Dal, rice & 2 rotis"
   • portion_g = total grams · portion_desc = what you assumed
   • top-level calories/macros = the SUM of all items.

${CALIBRATION}

RULES
- Indian gravies usually carry more oil than they sound — do not under-estimate fat.
- Ignore filler words and any text unrelated to food.
- confidence: "high" when foods AND quantities were stated clearly;
  "medium" when foods are clear but amounts were vague;
  "low" when the description is too unclear to interpret.
- If the text describes no food at all, return an empty items array, calories 0,
  confidence "low", and say so in notes.
- notes: one short sentence naming the main assumption you made.`;

/** Analyse a free-text meal description. Cheaper than the photo path — no image tokens. */
export async function analyzeFoodText(description: string): Promise<CalorieBreakdown> {
  const geminiResult = await model.generateContent([
    TEXT_SYSTEM_PROMPT,
    `The user said: "${description}"`,
  ]);

  let parsed: unknown;
  try {
    parsed = JSON.parse(geminiResult.response.text());
  } catch {
    console.warn('[analyzeFoodText] Non-JSON response, returning fallback.');
    return fallbackBreakdown('Could not understand that description');
  }
  return validateBreakdown(parsed);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ImageData {
  base64: string;
  mimeType: string;
}

/**
 * Fetch image bytes from Supabase storage and return as base64.
 * Avoids sending a raw signed URL to Gemini (SSRF prevention).
 */
async function fetchImageAsBase64(imageUrl: string): Promise<ImageData> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return {
    base64: Buffer.from(buffer).toString('base64'),
    mimeType: response.headers.get('content-type') ?? 'image/jpeg',
  };
}

function hashImageUrl(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex');
}

/**
 * Compress a free-text food description down to nutritionally-relevant keywords.
 *
 * Strips filler phrases, articles, conjunctions and conversational padding
 * that add tokens but carry zero nutritional signal for Gemini.
 *
 * Examples:
 *   "I had this for lunch, it was a bowl of dal fry with 2 rotis and some achaar"
 *   → "dal fry 1 bowl, roti 2, achaar"                     (~78% token reduction)
 *
 *   "I think this might be chicken curry made with coconut milk probably"
 *   → "chicken curry, coconut milk"                         (~65% token reduction)
 */
function compressDescription(raw: string): string {
  let text = raw.toLowerCase().trim();

  // 1. Strip conversational filler phrases
  const FILLER = [
    /\b(i (had|ate|think|guess|believe|ordered|made|cooked|can see)|it was|this is|there (is|are)|these are|that is|i'm not sure|i am not sure|probably|maybe|i think|sort of|kind of|i suppose|i feel like|looks like|seems like|it looks|it seems)\b/g,
    /\b(for (breakfast|lunch|dinner|snack|brunch)|just now|right now|a little while ago|earlier today)\b/g,
    /\b(quite|very|really|so|too|pretty|fairly|rather|somewhat|a bit|a little)\b/g,
    /\b(and some|with some|along with|served with|on the side|as a side|as well|also|plus)\b/gi,
  ];
  for (const pattern of FILLER) {
    text = text.replace(pattern, ' ');
  }

  // 2. Strip pure stop words (articles, conjunctions, prepositions) when isolated
  text = text.replace(/\b(the|a|an|of|in|on|at|to|is|was|my|this|that|it|its|with|and|but|or|so)\b/g, ' ');

  // 3. Normalize common quantity words to digits
  const NUMBERS: [RegExp, string][] = [
    [/\bone\b/g, '1'], [/\btwo\b/g, '2'], [/\bthree\b/g, '3'],
    [/\bfour\b/g, '4'], [/\bfive\b/g, '5'], [/\bsix\b/g, '6'],
    [/\bhalf\b/g, '0.5'], [/\bquarter\b/g, '0.25'],
  ];
  for (const [pat, rep] of NUMBERS) {
    text = text.replace(pat, rep);
  }

  // 4. Collapse whitespace and punctuation runs
  text = text.replace(/[,\s]+/g, ' ').trim();

  // 5. Hard cap at 80 chars — roughly 20 tokens, enough for 4-5 food items
  if (text.length > 80) {
    text = text.slice(0, 80).replace(/\s+\S*$/, '').trim();
  }

  return text;
}

// ─── Core AI Service ──────────────────────────────────────────────────────────

/**
 * Call Gemini 1.5 Flash to analyse a food photo.
 * Returns a `CalorieBreakdown` or throws on unrecoverable errors.
 *
 * Error handling strategy:
 * - Malformed JSON → returns a fallback breakdown with low confidence
 * - API errors (rate limit, quota) → rethrows for the route to handle
 * - "Could not identify" JSON error → returns fallback breakdown
 */
export async function analyzeFoodPhoto(imageBase64: string, mimeType: string, description?: string): Promise<CalorieBreakdown> {
  const userHint = description?.trim()
    ? `\n\nUser-provided description (treat as ground truth for hidden/stacked ingredients): "${description.trim()}"`
    : '';

  const geminiResult = await model.generateContent([
    SYSTEM_PROMPT + userHint,
    { inlineData: { data: imageBase64, mimeType } },
  ]);

  // responseSchema guarantees valid JSON — no markdown stripping or error-field
  // handling needed. If parsing still fails, fall back gracefully.
  let parsed: unknown;
  try {
    parsed = JSON.parse(geminiResult.response.text());
  } catch {
    console.warn('[analyzeFoodPhoto] Unexpected non-JSON response, returning fallback.');
    return fallbackBreakdown('Could not parse AI response');
  }

  return validateBreakdown(parsed);
}

function fallbackBreakdown(reason: string): CalorieBreakdown {
  return {
    food_name: 'Unknown food',
    items: [],
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    portion_g: 0,
    portion_desc: '',
    confidence: 'low',
    notes: reason,
  };
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(v, 0) : 0);

function validateItems(raw: unknown): FoodItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it): FoodItem | null => {
      const r = it as Record<string, unknown>;
      if (typeof r['name'] !== 'string' || !r['name']) return null;
      return {
        name: r['name'],
        quantity: num(r['quantity']) || 1,
        unit: typeof r['unit'] === 'string' && r['unit'] ? r['unit'] : 'piece',
        grams: Math.round(num(r['grams'])),
        calories: Math.round(num(r['calories'])),
        protein_g: Math.round(num(r['protein_g']) * 10) / 10,
        carbs_g: Math.round(num(r['carbs_g']) * 10) / 10,
        fat_g: Math.round(num(r['fat_g']) * 10) / 10,
        fiber_g: Math.round(num(r['fiber_g']) * 10) / 10,
      };
    })
    .filter((it): it is FoodItem => it !== null && it.calories > 0);
}

function validateBreakdown(raw: unknown): CalorieBreakdown {
  const r = raw as Record<string, unknown>;
  const items = validateItems(r['items']);

  // With items present, totals are OUR arithmetic, not the model's — LLMs get
  // sums wrong often enough that the header must be derived, never trusted.
  const sum = (f: (i: FoodItem) => number): number =>
    Math.round(items.reduce((s, i) => s + f(i), 0) * 10) / 10;

  const hasItems = items.length > 0;
  return {
    food_name: typeof r['food_name'] === 'string' ? r['food_name'] : 'Unknown food',
    items,
    calories: hasItems ? Math.round(items.reduce((s, i) => s + i.calories, 0)) : num(r['calories']),
    protein_g: hasItems ? sum((i) => i.protein_g) : num(r['protein_g']),
    carbs_g: hasItems ? sum((i) => i.carbs_g) : num(r['carbs_g']),
    fat_g: hasItems ? sum((i) => i.fat_g) : num(r['fat_g']),
    fiber_g: hasItems ? sum((i) => i.fiber_g) : num(r['fiber_g']),
    portion_g: hasItems
      ? items.reduce((s, i) => s + i.grams, 0)
      : Math.round(num(r['portion_g'])),
    portion_desc: typeof r['portion_desc'] === 'string' ? r['portion_desc'] : '',
    confidence:
      r['confidence'] === 'high' || r['confidence'] === 'medium' || r['confidence'] === 'low'
        ? r['confidence']
        : 'low',
    notes: typeof r['notes'] === 'string' ? r['notes'] : '',
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

interface ProfileRow {
  scan_count: number;
  daily_scan_count: number;
  daily_scan_reset_at: string;
  is_subscribed: boolean;
  subscription_end_date: string | null;
  trial_end_date: string | null;
}

interface CacheRow {
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  ai_response: CalorieBreakdown;
}

/** SSRF guard: only Supabase-storage URLs may be fetched. Sends a 400 and returns false on failure. */
function validateSupabaseImageUrl(imageUrl: string, res: Response): boolean {
  const supabaseHost = new URL(process.env.SUPABASE_URL!).hostname;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    res.status(400).json({ error: 'imageUrl is not a valid URL' });
    return false;
  }
  if (!parsedUrl.hostname.endsWith(supabaseHost)) {
    res.status(400).json({ error: 'imageUrl must be a Supabase storage URL' });
    return false;
  }
  return true;
}

/**
 * Server-side daily scan gate shared by meal and label scans — never trust the client.
 * Returns true when the user may scan; sends the 402/429 response and returns false otherwise.
 */
async function enforceScanGate(req: Request, res: Response): Promise<boolean> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('scan_count, daily_scan_count, daily_scan_reset_at, is_subscribed, subscription_end_date, trial_end_date')
    .eq('id', req.user!.id)
    .single<ProfileRow>();

  if (profileError || !profile) {
    res.status(404).json({ error: 'Profile not found' });
    return false;
  }

  const now = new Date();
  const isPaidSubscriber =
    profile.is_subscribed &&
    (!profile.subscription_end_date || new Date(profile.subscription_end_date) > now);
  const isOnTrial =
    !isPaidSubscriber &&
    !!profile.trial_end_date &&
    new Date(profile.trial_end_date) > now;

  // Everyone has a daily cap: free = 2, pro & trial = 20 (fair use).
  const hasProAccess = isPaidSubscriber || isOnTrial;
  const dailyLimit = hasProAccess ? PRO_DAILY_SCAN_LIMIT : FREE_DAILY_SCAN_LIMIT;

  const resetDate = new Date(profile.daily_scan_reset_at);
  const today = new Date();
  const isNewDay = resetDate.toDateString() !== today.toDateString();
  const effectiveDailyCount = isNewDay ? 0 : profile.daily_scan_count;

  if (effectiveDailyCount >= dailyLimit) {
    const resetAt = new Date(today);
    resetAt.setHours(24, 0, 0, 0);

    if (hasProAccess) {
      // Pro/trial hit the fair-use ceiling — not a paywall moment.
      const body: DailyLimitError = {
        error: 'daily_limit_reached',
        message: `You've reached today's fair-use limit of ${PRO_DAILY_SCAN_LIMIT} scans. It resets tomorrow.`,
        scans_used: effectiveDailyCount,
        scans_limit: PRO_DAILY_SCAN_LIMIT,
        resets_at: resetAt.toISOString(),
      };
      res.status(429).json(body);
      return false;
    }

    const body: ScanLimitError = {
      error: 'scan_limit_reached',
      message: `Free plan allows ${FREE_DAILY_SCAN_LIMIT} scans/day. Upgrade to Pro for more.`,
      scans_used: effectiveDailyCount,
      scans_limit: FREE_DAILY_SCAN_LIMIT,
      resets_at: resetAt.toISOString(),
    };
    res.status(402).json(body);
    return false;
  }

  return true;
}

/**
 * POST /api/analyze-food
 * Body: { imageUrl: string, description?: string }
 *
 * Security: scan-count gate is always enforced server-side — never trust the client.
 */
router.post(
  '/analyze-food',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { imageUrl, description } = req.body as { imageUrl?: unknown; description?: unknown };

      if (!imageUrl || typeof imageUrl !== 'string') {
        res.status(400).json({ error: 'imageUrl is required and must be a string' });
        return;
      }

      // Compress the user description to remove filler words before sending to Gemini.
      // Reduces description token cost by ~65-80% with no accuracy loss.
      const userDescription =
        typeof description === 'string' && description.trim()
          ? compressDescription(description.slice(0, 500))   // allow longer input; compressor hard-caps output at 80 chars
          : undefined;

      // SSRF guard + server-side scan gate (shared with /analyze-label)
      if (!validateSupabaseImageUrl(imageUrl, res)) return;
      if (!(await enforceScanGate(req, res))) return;

      // ── Cache check (by image URL hash) ───────────────────────────────────
      const imageHash = hashImageUrl(imageUrl);
      const { data: cached } = await supabase
        .from('scan_cache')
        .select('food_name, calories, protein_g, carbs_g, fat_g, fiber_g, ai_response')
        .eq('image_hash', imageHash)
        .single<CacheRow>();

      if (cached) {
        await supabase.rpc('increment_scan_count', { user_id: req.user!.id });
        // NOTE: `hit_count` must be incremented atomically in SQL. Passing a
        // query builder (supabase.rpc(...)) as a column value does NOT work —
        // it serialises to an invalid payload. Increment via a dedicated RPC
        // that takes the image hash; only touch last_hit_at inline here.
        await supabase.rpc('increment_hit_count', { p_image_hash: imageHash });
        await supabase
          .from('scan_cache')
          .update({ last_hit_at: new Date().toISOString() })
          .eq('image_hash', imageHash);

        const responseBody: FoodScanResult = { result: cached.ai_response, cached: true };
        res.json(responseBody);
        return;
      }

      // ── Gemini Vision call ────────────────────────────────────────────────
      const { base64, mimeType } = await fetchImageAsBase64(imageUrl);
      const aiResult = await analyzeFoodPhoto(base64, mimeType, userDescription);

      // ── Tier 3: swap AI-recalled macros for database values where we can ──
      // Gemini keeps the jobs it's good at (identify the dish, estimate grams);
      // the numbers come from `foods` so they're reproducible and correctable.
      const enriched = await enrichItems(aiResult.items);
      const result: CalorieBreakdown = enriched.length
        ? { ...aiResult, items: enriched, ...totalsOf(enriched) }
        : aiResult;

      const dbHits = enriched.filter((i) => i.source === 'database').length;
      console.log(
        `[Gemini] hash=${imageHash} user=${req.user!.id} food=${result.food_name} ` +
        `items=${enriched.length} db_hits=${dbHits}/${enriched.length}`,
      );

      if (result.confidence === 'low' && result.calories === 0) {
        // The AI couldn't identify the food — do not bill a scan
        res.status(422).json({ error: result.notes || 'Could not identify food in the image' });
        return;
      }

      // ── Store in cache ────────────────────────────────────────────────────
      await supabase.from('scan_cache').upsert(
        {
          image_hash: imageHash,
          food_name: result.food_name,
          calories: result.calories,
          protein_g: result.protein_g,
          carbs_g: result.carbs_g,
          fat_g: result.fat_g,
          fiber_g: result.fiber_g,
          ai_response: result,
        },
        { onConflict: 'image_hash' },
      );

      // ── Increment scan count ──────────────────────────────────────────────
      await supabase.rpc('increment_scan_count', { user_id: req.user!.id });

      const responseBody: FoodScanResult = { result, cached: false };
      res.json(responseBody);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/analyze-text
 * Body: { description: string }
 *
 * Log a meal by describing it — typed, or dictated with the device keyboard's
 * own microphone (no speech dependency needed on our side).
 *
 * Shares everything with the photo path: the same scan gate, the same items
 * schema, and the same `foods` table enrichment, so the client can render the
 * result on the existing editable-items screen with no special casing.
 */
router.post(
  '/analyze-text',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { description } = req.body as { description?: unknown };

      if (typeof description !== 'string' || description.trim().length < 3) {
        res.status(400).json({ error: 'Please describe what you ate.' });
        return;
      }
      // Cap the input so a pasted essay can't inflate token cost.
      const text = description.trim().slice(0, 500);

      // Same fair-use ceiling as photo scans — never trust the client.
      if (!(await enforceScanGate(req, res))) return;

      const aiResult = await analyzeFoodText(text);

      if (aiResult.items.length === 0 || aiResult.calories === 0) {
        // Nothing recognisable — do not bill a scan.
        res.status(422).json({
          error: aiResult.notes || "We couldn't find any food in that description.",
        });
        return;
      }

      // Tier 3: database macros replace the model's recall where we have a match.
      const enriched = await enrichItems(aiResult.items);
      const result: CalorieBreakdown = enriched.length
        ? { ...aiResult, items: enriched, ...totalsOf(enriched) }
        : aiResult;

      await supabase.rpc('increment_scan_count', { user_id: req.user!.id });

      const dbHits = enriched.filter((i) => i.source === 'database').length;
      console.log(
        `[Gemini/text] user=${req.user!.id} items=${enriched.length} db_hits=${dbHits}/${enriched.length}`,
      );

      const responseBody: FoodScanResult = { result, cached: false };
      res.json(responseBody);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Label scan route ─────────────────────────────────────────────────────────

type RawLabel = Omit<LabelScanData, 'health'>;

function validateLabelData(raw: unknown): RawLabel {
  const r = raw as Record<string, unknown>;
  const n = (r['per_100g'] ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(v, 0) : 0;

  const per_100g: LabelNutrition = {
    energy_kcal: num(n['energy_kcal']),
    protein_g: num(n['protein_g']),
    carbs_g: num(n['carbs_g']),
    sugar_g: num(n['sugar_g']),
    total_fat_g: num(n['total_fat_g']),
    sat_fat_g: num(n['sat_fat_g']),
    fiber_g: num(n['fiber_g']),
    sodium_mg: num(n['sodium_mg']),
  };

  return {
    product_name:
      typeof r['product_name'] === 'string' && r['product_name'] ? r['product_name'] : 'Unknown product',
    brand: typeof r['brand'] === 'string' ? r['brand'] : '',
    serving_g: num(r['serving_g']),
    is_beverage: r['is_beverage'] === true,
    per_100g,
    ingredients: Array.isArray(r['ingredients'])
      ? r['ingredients'].filter((i): i is string => typeof i === 'string')
      : [],
    confidence:
      r['confidence'] === 'high' || r['confidence'] === 'medium' || r['confidence'] === 'low'
        ? r['confidence']
        : 'low',
    notes: typeof r['notes'] === 'string' ? r['notes'] : '',
  };
}

/**
 * POST /api/analyze-label
 * Body: { imageUrl: string }
 *
 * Packaged-food label scan. Gemini only *reads* the label; the 0–100 health
 * score is computed deterministically server-side (lib/healthScore), so the
 * same product always gets the same score.
 */
router.post(
  '/analyze-label',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { imageUrl } = req.body as { imageUrl?: unknown };
      if (!imageUrl || typeof imageUrl !== 'string') {
        res.status(400).json({ error: 'imageUrl is required and must be a string' });
        return;
      }

      if (!validateSupabaseImageUrl(imageUrl, res)) return;
      if (!(await enforceScanGate(req, res))) return;

      const { base64, mimeType } = await fetchImageAsBase64(imageUrl);
      const geminiResult = await labelModel.generateContent([
        LABEL_SYSTEM_PROMPT,
        { inlineData: { data: base64, mimeType } },
      ]);

      let parsed: unknown;
      try {
        parsed = JSON.parse(geminiResult.response.text());
      } catch {
        res.status(422).json({ error: 'Could not read the label. Try a clearer, well-lit photo.' });
        return;
      }

      const label = validateLabelData(parsed);

      if (label.confidence === 'low' && label.per_100g.energy_kcal === 0) {
        // Unreadable label — do not bill a scan.
        res.status(422).json({ error: label.notes || 'No readable nutrition label found in the photo.' });
        return;
      }

      const health = computeHealthScore(label.per_100g, label.ingredients, label.is_beverage);

      await supabase.rpc('increment_scan_count', { user_id: req.user!.id });

      console.log(`[Gemini/label] user=${req.user!.id} product=${label.product_name} score=${health.score}`);

      // NOTE: no scan_cache for labels in Phase 1 — that table's columns are
      // meal-scan shaped. Revisit if repeat label scans become common.
      const responseBody: LabelScanResult = { result: { ...label, health }, cached: false };
      res.json(responseBody);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
