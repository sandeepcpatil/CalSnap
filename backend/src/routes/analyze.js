const express = require('express');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const authMiddleware = require('../middleware/auth');
const { supabase } = require('../lib/supabase');

const router = express.Router();

// Use Gemini 1.5 Flash — ~20x cheaper than GPT-4o Vision for same food recognition quality
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });

const FREE_DAILY_SCAN_LIMIT = 3;

const SYSTEM_PROMPT = `You are a professional nutritionist AI. Analyze the food in this image and return ONLY a valid JSON object with no markdown, no explanation:
{
  "food_name": "string (descriptive name of the food)",
  "calories": number (total estimated kcal),
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fiber_g": number,
  "confidence": "high" | "medium" | "low",
  "notes": "string (brief note about portion size assumptions)"
}
If you cannot identify the food, return: { "error": "Could not identify food" }`;

/**
 * Fetch image bytes from Supabase storage and return as base64.
 * This avoids sending a signed URL to Gemini (which would be an SSRF vector).
 */
async function fetchImageAsBase64(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const buffer = await response.arrayBuffer();
  return {
    base64: Buffer.from(buffer).toString('base64'),
    mimeType: response.headers.get('content-type') ?? 'image/jpeg',
  };
}

/**
 * Generate a SHA-256 hash of the image URL to use as cache key.
 */
function hashImageUrl(url) {
  return crypto.createHash('sha256').update(url).digest('hex');
}

/**
 * POST /api/analyze-food
 * Body: { imageUrl: string }
 *
 * Security: scan count gate enforced server-side — never trust client.
 */
router.post('/analyze-food', authMiddleware, async (req, res, next) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    // Validate URL scheme to prevent SSRF — only allow Supabase storage URLs
    const supabaseHost = new URL(process.env.SUPABASE_URL).hostname;
    const parsedUrl = new URL(imageUrl);
    if (!parsedUrl.hostname.endsWith(supabaseHost)) {
      return res.status(400).json({ error: 'Invalid image URL origin' });
    }

    // --- SERVER-SIDE SCAN GATE ---
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('scan_count, daily_scan_count, daily_scan_reset_at, is_subscribed, subscription_end_date')
      .eq('id', req.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const isSubscribed = profile.is_subscribed &&
      (!profile.subscription_end_date || new Date(profile.subscription_end_date) > new Date());

    if (!isSubscribed) {
      // Reset daily count if it's a new day
      const resetDate = new Date(profile.daily_scan_reset_at);
      const today = new Date();
      const isNewDay = resetDate.toDateString() !== today.toDateString();
      const effectiveDailyCount = isNewDay ? 0 : profile.daily_scan_count;

      if (effectiveDailyCount >= FREE_DAILY_SCAN_LIMIT) {
        return res.status(402).json({
          error: 'scan_limit_reached',
          message: `Free plan allows ${FREE_DAILY_SCAN_LIMIT} scans/day. Upgrade to Pro for unlimited scans.`,
          scans_used: effectiveDailyCount,
          scans_limit: FREE_DAILY_SCAN_LIMIT,
          resets_at: new Date(today.setHours(24, 0, 0, 0)).toISOString(),
        });
      }
    }

    // --- CACHE CHECK (by image URL hash) ---
    const imageHash = hashImageUrl(imageUrl);
    const { data: cached } = await supabase
      .from('scan_cache')
      .select('food_name, calories, protein_g, carbs_g, fat_g, fiber_g, ai_response')
      .eq('image_hash', imageHash)
      .single();

    if (cached) {
      // Cache hit — increment scan count without calling AI
      await supabase.rpc('increment_scan_count', { user_id: req.user.id });
      // Update cache hit stats
      await supabase
        .from('scan_cache')
        .update({ hit_count: supabase.raw('hit_count + 1'), last_hit_at: new Date().toISOString() })
        .eq('image_hash', imageHash);
      return res.json({ result: cached.ai_response, cached: true });
    }

    // --- GEMINI VISION CALL ---
    const { base64, mimeType } = await fetchImageAsBase64(imageUrl);

    const geminiResult = await model.generateContent([
      SYSTEM_PROMPT,
      { inlineData: { data: base64, mimeType } },
    ]);

    const rawContent = geminiResult.response.text();
    console.log(`[Gemini] hash: ${imageHash}, user: ${req.user.id}`);

    let result;
    try {
      const cleaned = rawContent.replace(/```json?\n?|```/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      return res.status(422).json({ error: 'Failed to parse AI response', raw: rawContent });
    }

    if (result.error) {
      return res.status(422).json({ error: result.error });
    }

    // --- STORE IN CACHE ---
    await supabase.from('scan_cache').upsert({
      image_hash: imageHash,
      food_name: result.food_name,
      calories: result.calories,
      protein_g: result.protein_g,
      carbs_g: result.carbs_g,
      fat_g: result.fat_g,
      fiber_g: result.fiber_g,
      ai_response: result,
    }, { onConflict: 'image_hash' });

    // --- INCREMENT SCAN COUNT ---
    await supabase.rpc('increment_scan_count', { user_id: req.user.id });

    res.json({ result, cached: false });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
