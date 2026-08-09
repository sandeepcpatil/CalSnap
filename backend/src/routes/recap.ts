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
    '',
    'THE SCREEN ALREADY SHOWS A STAT STRIP with days logged, average calories, average',
    'protein and weight change. Your job is to INTERPRET those numbers, not read them back.',
    'Restating the strip is the single worst thing you can do here.',
    '',
    'Each field has a DIFFERENT job. Never repeat a fact or a number between them:',
    '• headline — <=8 words, no emoji. Name the ONE thing that actually mattered this week.',
    '• summary  — exactly 2 sentences on the story of the week: what stood out and why it',
    '             matters. Quote AT MOST one number, and only if it is the point.',
    '• insights — 2 or 3 items. EACH MUST COVER A DIFFERENT TOPIC (pick from: calorie gap,',
    '             protein, hydration, sodium, weight, consistency). One sentence each, under',
    '             160 characters. Say something the number alone does not — a pattern, a',
    '             likely cause, what it means. Never repeat a topic already in the summary.',
    '• tip      — one concrete, doable focus for next week. Not a summary of the above.',
    '',
    'PRIORITISE HONESTLY. Lead with what most affects their goal, not with whatever is',
    'most flattering. A large avg_calorie_gap or avg_protein_gap matters far more than a',
    'logging streak — if the gap is big, that is the story and the headline.',
    'Be warm but truthful: encouraging-but-useless is worse than kind-and-honest.',
    '',
    'If avg_calorie_gap is more negative than about -700, treat under-LOGGING as the most',
    'likely explanation (missed snacks, drinks, oil) before assuming they truly ate that',
    'little — say so plainly and invite them to check.',
    '',
    'If days_high_sodium > 0, you may use ONE insight on sodium — eating out or packaged',
    'food is the usual cause. Awareness, never alarm, never medical advice.',
    '',
    'Address the reader as "you". Never write about them in the third person.',
    'Never end mid-sentence.',
    '',
    `Stats: ${JSON.stringify(s)}`,
  ].join('\n');
}

/**
 * Trim to a length without slicing a word in half.
 *
 * A blunt `slice()` produced insights that ended mid-word ("…can help her"),
 * which reads like the app broke. Prefer a sentence boundary; fall back to a
 * word boundary with an ellipsis.
 */
export function trimClean(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentenceEnd > max * 0.5) return cut.slice(0, sentenceEnd + 1).trim();
  const wordEnd = cut.lastIndexOf(' ');
  return `${(wordEnd > 0 ? cut.slice(0, wordEnd) : cut).replace(/[,;:—–-]+$/, '').trim()}…`;
}

/**
 * A never-fails recap built straight from the numbers.
 *
 * Deliberately keeps each part on a DIFFERENT topic — the stat strip above it
 * already shows days/calories/protein, so restating them here (as an earlier
 * version did, in both the summary and the first two insights) just reads as
 * the same sentence three times.
 */
function deterministicRecap(s: WeekStats): RecapContent {
  const bigDeficit = s.avg_calorie_gap < -700;

  // The headline names whatever most affects their goal — not the streak.
  const headline =
    bigDeficit ? 'Your intake looks under-recorded'
    : s.days_protein_low >= 3 ? 'Protein was the week’s weak spot'
    : s.days_logged >= 6 ? 'A genuinely consistent week'
    : 'A partial picture this week';

  const summary =
    bigDeficit
      ? `Across ${s.week_label} your logged intake averaged ${Math.abs(s.avg_calorie_gap).toLocaleString('en-IN')} kcal below your goal — a gap that big usually means meals, drinks or cooking oil went unlogged rather than genuinely eaten. Worth a quick check so the rest of your numbers can be trusted.`
      : s.days_protein_low >= 3
        ? `${s.week_label} held together well on the whole, but protein was the one place you kept falling short. That's the lever worth pulling next week — everything else is broadly on track.`
        : `${s.week_label} went well, and the consistency is the part worth noticing. Habits built on ordinary weeks like this one are the ones that actually last.`;

  // Each insight covers a topic the summary did NOT.
  const insights: string[] = [];
  if (!bigDeficit && s.avg_calorie_gap !== 0) {
    insights.push(
      s.avg_calorie_gap < 0
        ? `You ran about ${Math.abs(s.avg_calorie_gap).toLocaleString('en-IN')} kcal/day under goal — small but steady.`
        : `You ran about ${s.avg_calorie_gap.toLocaleString('en-IN')} kcal/day over goal.`,
    );
  }
  if (s.avg_protein > 0 && s.days_protein_low < 3) {
    insights.push(`Protein held up on ${s.days_logged - s.days_protein_low} of ${s.days_logged} logged days.`);
  } else if (s.avg_protein > 0 && !(s.days_protein_low >= 3)) {
    insights.push(`Protein averaged ${s.avg_protein}g against your ${s.protein_goal}g target.`);
  }
  if (s.days_with_water === 0) {
    insights.push('No water was logged this week — even a glass or two a day makes the picture more complete.');
  } else {
    insights.push(`Hydration landed on ${s.days_water_goal_hit} of ${s.days_with_water} tracked day${s.days_with_water === 1 ? '' : 's'}.`);
  }
  if (s.days_high_sodium > 0) {
    insights.push(`Sodium went over 2,000 mg on ${s.days_high_sodium} day${s.days_high_sodium === 1 ? '' : 's'} — usually eating out or packaged food.`);
  }
  if (s.weight_change_kg != null && s.weight_change_kg !== 0) {
    insights.push(`Weight moved ${s.weight_change_kg < 0 ? 'down' : 'up'} ${Math.abs(s.weight_change_kg)} kg over the week.`);
  }

  const tip =
    bigDeficit ? 'Next week, try logging the in-between things — chai, oil, a handful of nuts. They close most of the gap.'
    : s.days_protein_low >= 3 ? 'Add one protein source — dal, curd, eggs or paneer — to a single meal each day.'
    : s.days_logged < 5 ? 'Aim for one more logged day than last week. Even a quick scan keeps the picture honest.'
    : 'Keep the routine exactly as it is — consistency like this is what compounds.';

  return { headline, summary, insights: insights.slice(0, 3), tip, ai: false };
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
      headline: trimClean(String(parsed.headline), 80),
      summary: trimClean(String(parsed.summary), 600),
      insights: insights.map((x) => trimClean(String(x), 220)),
      tip: trimClean(String(parsed.tip), 300),
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

      // NB: do NOT select columns that may not exist in the live DB (e.g.
      // subscription_tier). A failed select returns null here, which would make
      // isPro false and wrongly lock the recap for a paying subscriber.
      const { data: profileRow, error: profileErr } = await supabase
        .from('profiles')
        .select('is_subscribed, trial_end_date, daily_calorie_goal, daily_protein_goal, daily_water_ml_goal, weight_kg, activity_level')
        .eq('id', userId)
        .single();

      if (profileErr || !profileRow) {
        // Surface the real problem instead of silently showing the Pro teaser.
        next(new Error(`recap: profile load failed — ${profileErr?.message ?? 'no row'}`));
        return;
      }

      const onTrial = profileRow.trial_end_date ? new Date(profileRow.trial_end_date).getTime() > Date.now() : false;
      const isPro = Boolean(profileRow.is_subscribed) || onTrial;
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
