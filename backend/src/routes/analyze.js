const express = require('express');
const crypto = require('crypto');
const OpenAI = require('openai');
const authMiddleware = require('../middleware/auth');
const { supabase } = require('../lib/supabase');

const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
 * Generate a deterministic hash for an image URL to use as a cache key.
 * This prevents redundant OpenAI calls for the same image.
 */
function hashImageUrl(url) {
  return crypto.createHash('sha256').update(url).digest('hex');
}

/**
 * POST /api/analyze-food
 * Body: { imageUrl: string, imageHash?: string }
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
      .select('scan_count, is_subscribed')
      .eq('id', req.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (profile.scan_count >= 5 && !profile.is_subscribed) {
      return res.status(402).json({ error: 'scan_limit_reached', message: 'Upgrade to Pro for unlimited scans' });
    }

    // --- CACHE CHECK (by image URL hash) ---
    const imageHash = hashImageUrl(imageUrl);
    const { data: cached } = await supabase
      .from('food_logs')
      .select('food_name, calories, protein_g, carbs_g, fat_g, fiber_g, raw_ai_response')
      .eq('user_id', req.user.id)
      .eq('image_url', imageUrl)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (cached?.raw_ai_response) {
      return res.json({ result: cached.raw_ai_response, cached: true });
    }

    // --- OPENAI VISION CALL ---
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: SYSTEM_PROMPT },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
          ],
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content ?? '';
    console.log(`[OpenAI] tokens used: ${completion.usage?.total_tokens}, hash: ${imageHash}`);

    let result;
    try {
      // Strip any accidental markdown fences before parsing
      const cleaned = rawContent.replace(/```json?\n?|```/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      return res.status(422).json({ error: 'Failed to parse AI response', raw: rawContent });
    }

    if (result.error) {
      return res.status(422).json({ error: result.error });
    }

    res.json({ result, cached: false });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
