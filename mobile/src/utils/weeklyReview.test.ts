/**
 * Standalone tests for the weekly review builder (no test runner in this repo yet).
 * Run from mobile/ with:
 *   ../backend/node_modules/.bin/ts-node --transpile-only -O '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"jsx":"react-native"}' src/utils/weeklyReview.test.ts
 */
import assert from 'assert';
import type { WeeklyRecap } from '../services/api';
import {
  buildWeeklyReviewData,
  buildWeeklyReviewText,
  daysLoggedLine,
  formatWeekLabel,
  proteinLine,
  type ReviewLog,
} from './weeklyReview';

const log = (date: string, calories: number, protein_g: number): ReviewLog => ({
  logged_at: `${date}T12:00:00.000Z`,
  calories,
  protein_g,
});

// ── formatWeekLabel ─────────────────────────────────────────────────────────
assert.strictEqual(formatWeekLabel('2026-10-06', '2026-10-12'), '6 to 12 Oct');
// A week across a month boundary names both months.
assert.strictEqual(formatWeekLabel('2026-09-29', '2026-10-05'), '29 Sep to 5 Oct');

// ── Empty week ──────────────────────────────────────────────────────────────
const empty = buildWeeklyReviewData({ logs: [], calorieGoal: 2000, proteinGoal: 120, today: '2026-10-12' });
assert.strictEqual(empty.source, 'logs');
assert.strictEqual(empty.weekLabel, '6 to 12 Oct');
assert.strictEqual(empty.daysLogged, 0);
assert.strictEqual(empty.avgCalories, 0);
assert.strictEqual(empty.proteinDaysHit, 0);
assert.strictEqual(empty.nextWeek, null);
// Nothing to share for an empty week — the button is disabled on null.
assert.strictEqual(buildWeeklyReviewText(empty), null);
assert.strictEqual(daysLoggedLine(empty), '0 days logged');

// ── From logs ───────────────────────────────────────────────────────────────
// Five logged days; Wednesday (7 Oct 2026) is the lowest-protein day. Two rows on the
// same day must be summed, not counted twice. A row older than seven days and
// one dated after today are ignored.
const logs: ReviewLog[] = [
  log('2026-10-06', 1800, 130), // Tue — hit
  log('2026-10-07', 1000, 20),  // Wed
  log('2026-10-07', 900, 30),   // Wed (same day) → 1900 kcal, 50 g
  log('2026-10-09', 2100, 125), // Fri — hit
  log('2026-10-11', 1700, 90),  // Sun
  log('2026-10-12', 1800, 140), // Mon (today) — hit
  log('2026-10-04', 5000, 300), // too old
  log('2026-10-13', 5000, 300), // tomorrow
];
const fromLogs = buildWeeklyReviewData({ logs, calorieGoal: 2000, proteinGoal: 120, today: '2026-10-12' });
assert.strictEqual(fromLogs.daysLogged, 5);
// (1800 + 1900 + 2100 + 1700 + 1800) / 5 = 1860 — empty days do not drag it down.
assert.strictEqual(fromLogs.avgCalories, 1860);
assert.strictEqual(fromLogs.calorieGoal, 2000);
assert.strictEqual(fromLogs.proteinGoal, 120);
assert.strictEqual(fromLogs.proteinDaysHit, 3);
assert.strictEqual(proteinLine(fromLogs), 'Protein target hit 3 of 5 days');
assert.strictEqual(fromLogs.nextWeek, 'add a protein source on Wednesday, your lowest day at 50 g');
assert.strictEqual(
  buildWeeklyReviewText(fromLogs),
  'My week on CalVue, 6 to 12 Oct: 1,860 kcal a day on average (target 2,000), protein target hit 3 of 5 days, 5 days logged. Next week: add a protein source on Wednesday, your lowest day at 50 g.',
);

// No targets set: protein line is honest, calorie target is omitted, and the
// advice falls through to logging more days.
const noGoals = buildWeeklyReviewData({ logs, today: '2026-10-12' });
assert.strictEqual(noGoals.calorieGoal, null);
assert.strictEqual(noGoals.proteinDaysHit, null);
assert.strictEqual(proteinLine(noGoals), 'No protein target set');
assert.strictEqual(noGoals.nextWeek, 'log every day for a fuller picture');
assert.strictEqual(
  buildWeeklyReviewText(noGoals),
  'My week on CalVue, 6 to 12 Oct: 1,860 kcal a day on average, no protein target set, 5 days logged. Next week: log every day for a fuller picture.',
);

// Protein fine every day but calories well over: the calorie line is chosen.
const over = buildWeeklyReviewData({
  logs: [log('2026-10-10', 2600, 150), log('2026-10-11', 2500, 150), log('2026-10-12', 2700, 150)],
  calorieGoal: 2000,
  proteinGoal: 120,
  today: '2026-10-12',
});
assert.strictEqual(over.proteinDaysHit, 3);
assert.strictEqual(over.nextWeek, 'bring the daily average closer to 2,000 kcal');

// A full week on target has nothing to fix.
const full: ReviewLog[] = Array.from({ length: 7 }, (_, i) => log(`2026-10-${String(6 + i).padStart(2, '0')}`, 2000, 130));
const steady = buildWeeklyReviewData({ logs: full, calorieGoal: 2000, proteinGoal: 120, today: '2026-10-12' });
assert.strictEqual(steady.daysLogged, 7);
assert.strictEqual(steady.proteinDaysHit, 7);
assert.strictEqual(steady.nextWeek, 'keep the same pattern going');
assert.strictEqual(daysLoggedLine(steady), '7 days logged');

// A single logged day uses the singular.
const one = buildWeeklyReviewData({ logs: [log('2026-10-12', 1500, 50)], proteinGoal: 120, today: '2026-10-12' });
assert.strictEqual(daysLoggedLine(one), '1 day logged');
assert.strictEqual(proteinLine(one), 'Protein target hit 0 of 1 day');

// ── From the server recap ───────────────────────────────────────────────────
const recap: WeeklyRecap = {
  week_start: '2026-09-29',
  stats: {
    week_start: '2026-09-29',
    week_end: '2026-10-05',
    week_label: '29 Sep – 5 Oct',
    days_logged: 7,
    avg_calories: 1860,
    calorie_goal: 2000,
    avg_protein: 110,
    protein_goal: 120,
    days_protein_low: 2,
    water_goal_ml: 3000,
    days_water_goal_hit: 4,
    days_with_water: 6,
    weight_change_kg: null,
    best_protein_day_kg: null,
    avg_sodium_mg: 1800,
    days_high_sodium: 1,
  },
  content: {
    headline: 'A steady week',
    summary: 'Calories sat a little under target.',
    insights: ['Protein dipped midweek.'],
    tip: 'Add a protein source at breakfast!',
    ai: true,
  },
};
// Logs are ignored when a recap is present — the recap is the source of truth.
const fromRecap = buildWeeklyReviewData({ recap, logs, calorieGoal: 1500, today: '2026-10-12' });
assert.strictEqual(fromRecap.source, 'recap');
assert.strictEqual(fromRecap.weekLabel, '29 Sep to 5 Oct');
assert.strictEqual(fromRecap.daysLogged, 7);
assert.strictEqual(fromRecap.avgCalories, 1860);
assert.strictEqual(fromRecap.calorieGoal, 2000);
assert.strictEqual(fromRecap.proteinDaysHit, 5);
assert.strictEqual(proteinLine(fromRecap), 'Protein target hit 5 of 7 days');
// The tip is lower-cased after "Next week:" and loses its exclamation mark.
assert.strictEqual(fromRecap.nextWeek, 'add a protein source at breakfast');
const text = buildWeeklyReviewText(fromRecap);
assert.strictEqual(
  text,
  'My week on CalVue, 29 Sep to 5 Oct: 1,860 kcal a day on average (target 2,000), protein target hit 5 of 7 days, 7 days logged. Next week: add a protein source at breakfast.',
);
assert.ok(!text!.includes('!'));

// A recap with no targets never produces a negative hit count or a bogus target.
const bare = buildWeeklyReviewData({
  recap: { ...recap, stats: { ...recap.stats, protein_goal: 0, calorie_goal: 0, days_protein_low: 9 }, content: { ...recap.content, tip: '' } },
});
assert.strictEqual(bare.proteinDaysHit, null);
assert.strictEqual(bare.calorieGoal, null);
assert.strictEqual(bare.nextWeek, null);

// eslint-disable-next-line no-console
console.log('✓ weeklyReview utils — all assertions passed');
