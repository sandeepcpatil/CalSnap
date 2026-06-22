import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CalorieBreakdown, FoodScanResult, ScanLimitError } from '@shared/types';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router: ExpressRouter = Router();

// ─── Gemini Setup ─────────────────────────────────────────────────────────────

const genAIKey = process.env.GEMINI_API_KEY;
if (!genAIKey) throw new Error('GEMINI_API_KEY must be set in environment');

const genai = new GoogleGenerativeAI(genAIKey);
const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });

const FREE_DAILY_SCAN_LIMIT = 3;

// ─── System Prompt ────────────────────────────────────────────────────────────
// Tailored for Indian food — the most common use case for CalSnap users.

const SYSTEM_PROMPT = `You are a professional nutritionist AI specialising in Indian cuisine.
Analyse the food in this image and return ONLY a valid JSON object — no markdown fences, no explanation.

JSON schema:
{
  "food_name": "string — descriptive name including cooking style (e.g. 'Masala Dosa with Sambar')",
  "calories": number  (total estimated kcal for the entire visible portion),
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fiber_g": number,
  "confidence": "high" | "medium" | "low",
  "notes": "string — brief note on portion size assumptions (e.g. '2 medium rotis ~60g each')"
}

Indian food examples for calibration:
- Masala Dosa (1 large): ~200 kcal, 4g protein, 30g carbs, 8g fat
- Idli (2 pcs): ~130 kcal, 4g protein, 26g carbs, 0.5g fat
- Chicken Biryani (1 plate ~350g): ~520 kcal, 28g protein, 60g carbs, 16g fat
- Dal Tadka (1 bowl): ~180 kcal, 9g protein, 25g carbs, 5g fat
- Butter Roti (1 medium): ~120 kcal, 3g protein, 18g carbs, 4g fat
- Paneer Butter Masala (200g): ~350 kcal, 14g protein, 18g carbs, 25g fat

If you cannot identify the food, return exactly: { "error": "Could not identify food" }`;

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
export async function analyzeFoodPhoto(imageBase64: string, mimeType: string): Promise<CalorieBreakdown> {
  const geminiResult = await model.generateContent([
    SYSTEM_PROMPT,
    { inlineData: { data: imageBase64, mimeType } },
  ]);

  const rawText = geminiResult.response.text();

  // Strip any accidental markdown fences
  const cleaned = rawText.replace(/```json?\n?|```/g, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.warn('[analyzeFoodPhoto] Failed to parse JSON, returning fallback. Raw:', rawText.slice(0, 200));
    return fallbackBreakdown('Could not parse AI response');
  }

  // Handle explicit "error" response from the model
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'error' in parsed &&
    typeof (parsed as Record<string, unknown>).error === 'string'
  ) {
    return fallbackBreakdown((parsed as { error: string }).error);
  }

  return validateBreakdown(parsed);
}

function fallbackBreakdown(reason: string): CalorieBreakdown {
  return {
    food_name: 'Unknown food',
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    confidence: 'low',
    notes: reason,
  };
}

function validateBreakdown(raw: unknown): CalorieBreakdown {
  const r = raw as Record<string, unknown>;
  return {
    food_name: typeof r['food_name'] === 'string' ? r['food_name'] : 'Unknown food',
    calories: typeof r['calories'] === 'number' ? r['calories'] : 0,
    protein_g: typeof r['protein_g'] === 'number' ? r['protein_g'] : 0,
    carbs_g: typeof r['carbs_g'] === 'number' ? r['carbs_g'] : 0,
    fat_g: typeof r['fat_g'] === 'number' ? r['fat_g'] : 0,
    fiber_g: typeof r['fiber_g'] === 'number' ? r['fiber_g'] : 0,
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

/**
 * POST /api/analyze-food
 * Body: { imageUrl: string }
 *
 * Security: scan-count gate is always enforced server-side — never trust the client.
 */
router.post(
  '/analyze-food',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { imageUrl } = req.body as { imageUrl?: unknown };

      if (!imageUrl || typeof imageUrl !== 'string') {
        res.status(400).json({ error: 'imageUrl is required and must be a string' });
        return;
      }

      // Validate URL scheme — only allow Supabase storage URLs (SSRF prevention)
      const supabaseHost = new URL(process.env.SUPABASE_URL!).hostname;
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(imageUrl);
      } catch {
        res.status(400).json({ error: 'imageUrl is not a valid URL' });
        return;
      }
      if (!parsedUrl.hostname.endsWith(supabaseHost)) {
        res.status(400).json({ error: 'imageUrl must be a Supabase storage URL' });
        return;
      }

      // ── Server-side scan gate ──────────────────────────────────────────────
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('scan_count, daily_scan_count, daily_scan_reset_at, is_subscribed, subscription_end_date')
        .eq('id', req.user!.id)
        .single<ProfileRow>();

      if (profileError || !profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      const isSubscribed =
        profile.is_subscribed &&
        (!profile.subscription_end_date || new Date(profile.subscription_end_date) > new Date());

      if (!isSubscribed) {
        const resetDate = new Date(profile.daily_scan_reset_at);
        const today = new Date();
        const isNewDay = resetDate.toDateString() !== today.toDateString();
        const effectiveDailyCount = isNewDay ? 0 : profile.daily_scan_count;

        if (effectiveDailyCount >= FREE_DAILY_SCAN_LIMIT) {
          const resetAt = new Date(today);
          resetAt.setHours(24, 0, 0, 0);

          const body: ScanLimitError = {
            error: 'scan_limit_reached',
            message: `Free plan allows ${FREE_DAILY_SCAN_LIMIT} scans/day. Upgrade to Pro for unlimited scans.`,
            scans_used: effectiveDailyCount,
            scans_limit: FREE_DAILY_SCAN_LIMIT,
            resets_at: resetAt.toISOString(),
          };
          res.status(402).json(body);
          return;
        }
      }

      // ── Cache check (by image URL hash) ───────────────────────────────────
      const imageHash = hashImageUrl(imageUrl);
      const { data: cached } = await supabase
        .from('scan_cache')
        .select('food_name, calories, protein_g, carbs_g, fat_g, fiber_g, ai_response')
        .eq('image_hash', imageHash)
        .single<CacheRow>();

      if (cached) {
        await supabase.rpc('increment_scan_count', { user_id: req.user!.id });
        await supabase
          .from('scan_cache')
          .update({ hit_count: supabase.rpc('increment_hit_count'), last_hit_at: new Date().toISOString() })
          .eq('image_hash', imageHash);

        const responseBody: FoodScanResult = { result: cached.ai_response, cached: true };
        res.json(responseBody);
        return;
      }

      // ── Gemini Vision call ────────────────────────────────────────────────
      const { base64, mimeType } = await fetchImageAsBase64(imageUrl);
      const result = await analyzeFoodPhoto(base64, mimeType);

      console.log(`[Gemini] hash=${imageHash} user=${req.user!.id} food=${result.food_name}`);

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

export default router;
