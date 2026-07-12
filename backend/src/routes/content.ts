import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router: ExpressRouter = Router();

// ─── Gemini (reuses GEMINI_API_KEY) ─────────────────────────────────────────────
const genAIKey = process.env.GEMINI_API_KEY;
const genai = genAIKey ? new GoogleGenerativeAI(genAIKey) : null;

// Curated fallback — used if Gemini is unavailable, so the app always has a quote.
const FALLBACK_QUOTES: readonly string[] = [
  'Small choices, repeated daily, become the body you live in.',
  'Consistency beats intensity — show up for yourself today.',
  'You don’t need to be perfect, just one step better than yesterday.',
  'Fuel your body like it’s carrying you toward something great — because it is.',
  'Progress is quiet. Keep going even when no one is watching.',
  'Every healthy meal is a promise you keep to your future self.',
  'Discipline is choosing what you want most over what you want now.',
  'Your habits are voting for the person you’re becoming.',
  'Strong isn’t a destination, it’s a daily decision.',
  'Nourish the body, and the mind follows.',
  'One good day is a win. String them together and it’s a life.',
  'The goal isn’t less food, it’s more life in your food.',
  'Rest, refuel, repeat — growth lives in the basics.',
  'Track it, and you can change it.',
  'Be patient with your body; it’s doing its best for you.',
];

/** Date key in Asia/Kolkata so "today" matches the user's day. */
function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function fallbackFor(dateKey: string): string {
  const day = Number(dateKey.slice(-2)) || 1;
  return FALLBACK_QUOTES[day % FALLBACK_QUOTES.length] ?? 'Consistency beats intensity — show up for yourself today.';
}

async function generateQuote(): Promise<string> {
  if (!genai) throw new Error('GEMINI_API_KEY not set');
  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt =
    'Write ONE short, original motivational line (max 20 words) about health, nutrition, ' +
    'consistency, or self-improvement for a calorie-tracking app. ' +
    'No author, no surrounding quotation marks, no hashtags, no emojis. Return only the sentence.';
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim().replace(/^["'\s]+|["'\s]+$/g, '');
  if (!text || text.length > 200) throw new Error('unexpected quote output');
  return text;
}

// ─── GET /api/daily-quote ────────────────────────────────────────────────────
// One quote per day, shared by all users. First request of the day generates &
// caches it (~1 Gemini call/day total); everyone else is served from Supabase.

router.get(
  '/daily-quote',
  authMiddleware,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    const date = todayKey();
    try {
      const { data: cached } = await supabase
        .from('daily_content')
        .select('text')
        .eq('content_date', date)
        .eq('kind', 'quote')
        .single<{ text: string }>();

      if (cached?.text) {
        res.json({ quote: cached.text, date, source: 'cache' });
        return;
      }

      try {
        const quote = await generateQuote();
        await supabase
          .from('daily_content')
          .upsert({ content_date: date, kind: 'quote', text: quote }, { onConflict: 'content_date,kind' });
        res.json({ quote, date, source: 'generated' });
      } catch {
        // Don't cache the fallback, so a later request can still generate the real one.
        res.json({ quote: fallbackFor(date), date, source: 'fallback' });
      }
    } catch (err) {
      next(err);
    }
  },
);

export default router;
