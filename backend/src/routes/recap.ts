import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import {
  lastCompletedWeek,
  computeWeekStats,
  type WeekStats,
  type ProfileForRecap,
} from '../lib/weekStats';

const router: ExpressRouter = Router();

const genAIKey = process.env.GEMINI_API_KEY;
const genai = genAIKey ? new GoogleGenerativeAI(genAIKey) : null;

const RECAP_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    headline: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    insights: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    tip: { type: SchemaType.STRING },
  },
  required: ['headline', 'summary', 'insights', 'tip'],
};

const recapModel = genai
  ? genai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json', responseSchema: RECAP_SCHEMA, temperature: 0.7 },
    })
  : null;

export interface RecapContent {
  headline: string;
  summary: string;
  insights: string[];
  tip: string;
  /** True when Gemini wrote it; false for the deterministic fallback. */
  ai: boolean;
}

/** Enough logging to be worth a real review. Below this we send encouragement. */
const MIN_DAYS_FOR_REVIEW = 2;

function buildPrompt(s: WeekStats): string {
  return [
    'You are a warm, encouraging nutrition coach writing a short weekly review for a',
    'calorie-tracking app user in India. You are given the user\'s ALREADY-COMPUTED stats',
    'for the week — treat every number as fact. NEVER invent or recompute numbers, and',
    'NEVER give medical advice (no diagnoses, supplements, or treatment). Keep it personal,',
    'specific and non-judgmental; Indian foods (dal, roti, curd) are welcome as examples.',
    '',
    'Return JSON with: headline (<=8 words, upbeat, no emoji), summary (2-3 sentences that',
    'reference their real numbers), insights (2-3 short specific observations), tip (one',
    'concrete, kind focus for next week).',
    '',
    'If days_high_sodium > 0, include one gentle insight about sodium — it matters for',
    'blood pressure, and eating out / packaged food is usually the cause. Frame it as',
    'awareness, never alarm, and never as medical advice.',
    '',
    `Stats: ${JSON.stringify(s)}`,
  ].join('\n');
}

/** A never-fails recap built straight from the numbers. */
function deterministicRecap(s: WeekStats): RecapContent {
  const insights: string[] = [];
  insights.push(`You logged ${s.days_logged} of 7 days.`);
  if (s.avg_calories > 0) insights.push(`You averaged ${s.avg_calories.toLocaleString('en-IN')} kcal/day (goal ${s.calorie_goal.toLocaleString('en-IN')}).`);
  if (s.avg_protein > 0) {
    insights.push(
      s.days_protein_low > 0
        ? `Protein averaged ${s.avg_protein}g — below your ${s.protein_goal}g goal on ${s.days_protein_low} day${s.days_protein_low === 1 ? '' : 's'}.`
        : `Protein held strong at ${s.avg_protein}g/day.`,
    );
  }
  if (s.days_with_water > 0) insights.push(`You hit your water goal on ${s.days_water_goal_hit} of ${s.days_with_water} tracked day${s.days_with_water === 1 ? '' : 's'}.`);
  if (s.avg_sodium_mg > 0 && s.days_high_sodium > 0) insights.push(`Sodium ran high (over 2,000 mg) on ${s.days_high_sodium} day${s.days_high_sodium === 1 ? '' : 's'} — often the days you ate out or had packaged food.`);
  if (s.weight_change_kg != null) {
    const c = s.weight_change_kg;
    insights.push(c === 0 ? 'Weight held steady this week.' : `Weight ${c < 0 ? 'down' : 'up'} ${Math.abs(c)} kg.`);
  }

  const tip =
    s.days_protein_low >= 3 ? 'Aim to add one protein source — dal, curd, eggs or paneer — to a meal each day next week.'
    : s.days_logged < 5 ? 'Try to log a little more consistently next week — even a quick scan keeps the picture accurate.'
    : 'Keep doing what you\'re doing — consistency like this is exactly what pays off.';

  return {
    headline: `Your week: ${s.days_logged}/7 days logged`,
    summary: `Here\'s how ${s.week_label} went. You logged ${s.days_logged} of 7 days${s.avg_calories > 0 ? `, averaging ${s.avg_calories.toLocaleString('en-IN')} kcal a day` : ''}. Small, steady habits add up — nice work showing up for yourself.`,
    insights,
    tip,
    ai: false,
  };
}

/** Encouraging placeholder when there wasn't enough logged to review. */
function sparseRecap(s: WeekStats): RecapContent {
  return {
    headline: 'A fresh week ahead',
    summary: `There wasn\'t much logged during ${s.week_label}, so there\'s no full review this time — but that just means a clean slate. Log your meals this week and your next review will be full of insights.`,
    insights: [`${s.days_logged} of 7 days logged last week.`],
    tip: 'Start with one meal a day — the habit matters more than being perfect.',
    ai: false,
  };
}

export async function generateContent(s: WeekStats): Promise<RecapContent> {
  if (s.days_logged < MIN_DAYS_FOR_REVIEW) return sparseRecap(s);
  if (!recapModel) return deterministicRecap(s);

  try {
    const result = await recapModel.generateContent(buildPrompt(s));
    const parsed = JSON.parse(result.response.text()) as Partial<RecapContent>;
    const insights = Array.isArray(parsed.insights) ? parsed.insights.filter((x) => typeof x === 'string').slice(0, 4) : [];
    if (!parsed.headline || !parsed.summary || !parsed.tip || insights.length === 0) {
      return deterministicRecap(s);
    }
    return {
      headline: String(parsed.headline).slice(0, 80),
      summary: String(parsed.summary).slice(0, 600),
      insights: insights.map((x) => String(x).slice(0, 200)),
      tip: String(parsed.tip).slice(0, 300),
      ai: true,
    };
  } catch {
    return deterministicRecap(s);
  }
}

// ─── GET /api/recap ──────────────────────────────────────────────────────────
// The most-recently-completed week's review. Pro-only; generated once per week
// per user, then cached. Free users get a locked teaser.
router.get(
  '/recap',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('is_subscribed, subscription_tier, trial_end_date, daily_calorie_goal, daily_protein_goal, daily_water_ml_goal, weight_kg, activity_level')
        .eq('id', userId)
        .single();

      const onTrial = profileRow?.trial_end_date ? new Date(profileRow.trial_end_date).getTime() > Date.now() : false;
      const isPro = Boolean(profileRow?.is_subscribed) || onTrial;
      if (!isPro) {
        res.json({ locked: true, recap: null });
        return;
      }

      const week = lastCompletedWeek();

      // Cache hit — return immediately.
      const { data: cached } = await supabase
        .from('recaps')
        .select('week_start, stats, content')
        .eq('user_id', userId)
        .eq('week_start', week.week_start)
        .maybeSingle();

      if (cached) {
        res.json({ locked: false, recap: cached });
        return;
      }

      // Miss — gather the week's data and compute.
      const [{ data: food }, { data: water }, { data: weight }] = await Promise.all([
        supabase.from('food_logs').select('logged_at, calories, protein_g, sodium_mg').eq('user_id', userId).gte('logged_at', week.startTs).lt('logged_at', week.endTs),
        supabase.from('water_logs').select('logged_at, amount_ml').eq('user_id', userId).gte('logged_at', week.startTs).lt('logged_at', week.endTs),
        supabase.from('weight_logs').select('logged_at, weight_kg').eq('user_id', userId).gte('logged_at', week.startTs).lt('logged_at', week.endTs),
      ]);

      const profile: ProfileForRecap = {
        daily_calorie_goal: profileRow?.daily_calorie_goal ?? null,
        daily_protein_goal: profileRow?.daily_protein_goal ?? null,
        daily_water_ml_goal: profileRow?.daily_water_ml_goal ?? null,
        weight_kg: profileRow?.weight_kg ?? null,
        activity_level: profileRow?.activity_level ?? null,
      };

      const stats = computeWeekStats(week, food ?? [], water ?? [], weight ?? [], profile);
      const content = await generateContent(stats);

      // Write through so re-opening is instant. Non-fatal on failure.
      await supabase
        .from('recaps')
        .upsert({ user_id: userId, week_start: week.week_start, stats, content }, { onConflict: 'user_id,week_start' })
        .then(undefined, () => {});

      console.log(`[recap] user=${userId} week=${week.week_start} days=${stats.days_logged} ai=${content.ai}`);
      res.json({ locked: false, recap: { week_start: week.week_start, stats, content } });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
