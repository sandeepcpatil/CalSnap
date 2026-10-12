/**
 * The numbers behind the shareable weekly review card.
 *
 * One plain object (`WeeklyReviewData`) feeds both the card and the text
 * version that gets shared. It can be built from the server recap (Pro, the
 * last completed Monday-to-Sunday week) or from the last seven days of logs on
 * the device (free), so the card renders for everyone.
 *
 * Pure and dependency-free apart from the History stats helper, so it can be
 * tested with ts-node like the other utils.
 */
import type { WeeklyRecap } from '../services/api';
import type { FoodLog } from '../store/foodLogStore';
import { averageOverLoggedDays, type DayPoint } from './historyStats';

export interface WeeklyReviewData {
  /** "6 to 12 Oct" — or "29 Sep to 5 Oct" when the week spans two months. */
  weekLabel: string;
  /** Days with at least one food log, 0..7. */
  daysLogged: number;
  /** Mean kcal over the logged days; 0 when nothing was logged. */
  avgCalories: number;
  /** Daily calorie target, or null when none is set. */
  calorieGoal: number | null;
  /** Daily protein target in grams, or null when none is set. */
  proteinGoal: number | null;
  /** Logged days on which protein met the target. Null when there is no target. */
  proteinDaysHit: number | null;
  /** The one "Next week: …" line, without the prefix. Null when there is nothing to say. */
  nextWeek: string | null;
  /** Where the numbers came from. */
  source: 'recap' | 'logs';
}

/** The subset of a food log the builder actually reads. */
export type ReviewLog = Pick<FoodLog, 'logged_at' | 'calories' | 'protein_g'>;

export interface BuildWeeklyReviewInput {
  /** The server recap, when the user is Pro and one exists. */
  recap?: WeeklyRecap | null;
  /** Logs from (at least) the last seven days. Older rows are ignored. */
  logs?: readonly ReviewLog[];
  calorieGoal?: number | null;
  proteinGoal?: number | null;
  /** Today's `YYYY-MM-DD` key. Defaults to the device date (UTC, matching History). */
  today?: string;
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Parse a `YYYY-MM-DD` key as a *local* date (no timezone shift). */
function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "6 to 12 Oct", or "29 Sep to 5 Oct" across a month boundary. */
export function formatWeekLabel(startKey: string, endKey: string): string {
  const s = parseDay(startKey);
  const e = parseDay(endKey);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const start = sameMonth ? `${s.getDate()}` : `${s.getDate()} ${MONTH[s.getMonth()]}`;
  return `${start} to ${e.getDate()} ${MONTH[e.getMonth()]}`;
}

/** Thousands separators, "1,860". */
export function formatKcal(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

/**
 * Copy from the server may end in an exclamation mark; the card does not.
 * Also collapses whitespace and strips a trailing full stop so the caller can
 * punctuate consistently.
 */
function tidySentence(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/!+/g, '.')
    .replace(/\.+$/, '')
    .trim();
}

function fromRecap(recap: WeeklyRecap): WeeklyReviewData {
  const { stats, content } = recap;
  const daysLogged = Math.max(0, Math.min(7, stats.days_logged));
  const proteinGoal = stats.protein_goal > 0 ? stats.protein_goal : null;
  const proteinDaysHit = proteinGoal == null ? null : Math.max(0, daysLogged - stats.days_protein_low);
  // The tip follows "Next week:" so it reads as a clause, not a new sentence.
  // Only a plain capital is lowered; "HIIT …" style acronyms are left alone.
  let tip = content.tip ? tidySentence(content.tip) : '';
  if (/^[A-Z][a-z]/.test(tip)) tip = tip[0].toLowerCase() + tip.slice(1);

  return {
    weekLabel: formatWeekLabel(stats.week_start, stats.week_end),
    daysLogged,
    avgCalories: daysLogged > 0 ? Math.round(stats.avg_calories) : 0,
    calorieGoal: stats.calorie_goal > 0 ? stats.calorie_goal : null,
    proteinGoal,
    proteinDaysHit,
    nextWeek: tip || null,
    source: 'recap',
  };
}

interface DayTotals extends DayPoint {
  protein: number;
}

/** Seven day keys ending on `today`, oldest first. */
function lastSevenKeys(today: string): string[] {
  const end = parseDay(today);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (6 - i));
    // Local date → key without a UTC shift: rebuild from the local parts.
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

/**
 * The one line for next week, picked in priority order: a protein gap on a
 * specific day, calories a long way from target, then incomplete logging.
 */
function deriveNextWeek(
  days: readonly DayTotals[],
  avgCalories: number,
  calorieGoal: number | null,
  proteinGoal: number | null,
): string | null {
  const logged = days.filter((d) => d.calories > 0);
  if (logged.length === 0) return null;

  if (proteinGoal != null) {
    const under = logged.filter((d) => d.protein < proteinGoal);
    if (under.length > 0) {
      const lowest = under.reduce((a, b) => (b.protein < a.protein ? b : a));
      const dow = DOW[parseDay(lowest.date).getDay()];
      return `add a protein source on ${dow}, your lowest day at ${Math.round(lowest.protein)} g`;
    }
  }

  if (calorieGoal != null && calorieGoal > 0) {
    const ratio = avgCalories / calorieGoal;
    if (ratio > 1.1) return `bring the daily average closer to ${formatKcal(calorieGoal)} kcal`;
    if (ratio < 0.8) return `aim nearer ${formatKcal(calorieGoal)} kcal a day; most days came in well under`;
  }

  if (logged.length < 7) return 'log every day for a fuller picture';
  return 'keep the same pattern going';
}

function fromLogs(input: BuildWeeklyReviewInput): WeeklyReviewData {
  const today = input.today ?? dayKey(new Date());
  const keys = lastSevenKeys(today);
  const totals = new Map<string, DayTotals>(keys.map((k) => [k, { date: k, calories: 0, protein: 0 }]));

  for (const log of input.logs ?? []) {
    const key = log.logged_at.slice(0, 10);
    const day = totals.get(key);
    if (!day) continue;
    day.calories += log.calories || 0;
    day.protein += log.protein_g || 0;
  }

  const days = keys.map((k) => totals.get(k)!);
  const logged = days.filter((d) => d.calories > 0);
  const avgCalories = averageOverLoggedDays(days);
  const calorieGoal = input.calorieGoal && input.calorieGoal > 0 ? input.calorieGoal : null;
  const proteinGoal = input.proteinGoal && input.proteinGoal > 0 ? input.proteinGoal : null;
  const proteinDaysHit = proteinGoal == null ? null : logged.filter((d) => d.protein >= proteinGoal).length;

  return {
    weekLabel: formatWeekLabel(keys[0], keys[6]),
    daysLogged: logged.length,
    avgCalories,
    calorieGoal,
    proteinGoal,
    proteinDaysHit,
    nextWeek: deriveNextWeek(days, avgCalories, calorieGoal, proteinGoal),
    source: 'logs',
  };
}

/**
 * Build the card's data. The recap wins when present; otherwise the last seven
 * days of logs are summarised the same way the History screen does it.
 */
export function buildWeeklyReviewData(input: BuildWeeklyReviewInput): WeeklyReviewData {
  if (input.recap) return fromRecap(input.recap);
  return fromLogs(input);
}

/** "Protein target hit 5 of 7 days", or an honest line when there is no target. */
export function proteinLine(data: WeeklyReviewData): string {
  if (data.proteinGoal == null || data.proteinDaysHit == null) return 'No protein target set';
  return `Protein target hit ${data.proteinDaysHit} of ${data.daysLogged} day${data.daysLogged === 1 ? '' : 's'}`;
}

/** "7 days logged" */
export function daysLoggedLine(data: WeeklyReviewData): string {
  return `${data.daysLogged} day${data.daysLogged === 1 ? '' : 's'} logged`;
}

/**
 * The plain-text version of the card, used by Share. Returns null for an
 * empty week so the caller can disable the button rather than share nothing.
 */
export function buildWeeklyReviewText(data: WeeklyReviewData): string | null {
  if (data.daysLogged === 0) return null;

  const target = data.calorieGoal != null ? ` (target ${formatKcal(data.calorieGoal)})` : '';
  const parts = [
    `${formatKcal(data.avgCalories)} kcal a day on average${target}`,
    proteinLine(data).replace(/^Protein/, 'protein').replace(/^No/, 'no'),
    daysLoggedLine(data),
  ];
  let text = `My week on CalVue, ${data.weekLabel}: ${parts.join(', ')}.`;
  if (data.nextWeek) text += ` Next week: ${data.nextWeek}.`;
  return text;
}
