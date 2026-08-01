/**
 * Logging streaks.
 *
 * The streak counts **days on which the user logged at least one meal** — never
 * days they hit a calorie target. Streaking on a goal would reward eating less
 * and punish a normal day, which is the wrong incentive for a nutrition app.
 * Logging is a neutral habit, so it's safe to gamify.
 *
 * All functions are pure and take the "today" date explicitly, so they can be
 * tested without mocking the clock.
 */

/** Local YYYY-MM-DD — must be local, not UTC, or days shift near midnight. */
export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export interface StreakResult {
  /** Consecutive logged days ending today (or yesterday, if today isn't logged yet). */
  current: number;
  /** Best run found within the supplied window. */
  longest: number;
  /** True when today has at least one log. */
  loggedToday: boolean;
}

/**
 * `loggedDays` is the set of local day keys that have ≥1 log.
 *
 * Today counts as "not broken yet": if today has no log but yesterday does, the
 * streak still stands — it only breaks once the day passes unlogged. Otherwise
 * every user would see their streak read 0 each morning.
 */
export function computeStreak(loggedDays: ReadonlySet<string>, today: Date): StreakResult {
  const loggedToday = loggedDays.has(localDayKey(today));

  let current = 0;
  // Start from today when logged, else yesterday (today is still salvageable).
  let cursor = loggedToday ? today : addDays(today, -1);
  while (loggedDays.has(localDayKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  // Longest run anywhere in the window.
  const sorted = Array.from(loggedDays).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of sorted) {
    if (prev && localDayKey(addDays(new Date(`${prev}T00:00:00`), 1)) === key) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = key;
  }

  return { current, longest: Math.max(longest, current), loggedToday };
}

export type DayState = 'logged' | 'missed' | 'today-pending' | 'future';

export interface GridDay {
  key: string;
  date: Date;
  state: DayState;
}

/**
 * A rolling grid of whole weeks ending with the week containing today.
 *
 * Rolling rather than a calendar month on purpose: on the 1st a calendar month
 * is nearly empty, which is demotivating exactly when it matters. A rolling
 * window always looks full. Rows are weeks, columns are weekdays, so patterns
 * ("I always miss weekends") stay readable.
 */
export function buildStreakGrid(
  loggedDays: ReadonlySet<string>,
  today: Date,
  weeks = 5,
  /** 1 = week starts Monday, 0 = Sunday. */
  weekStartsOn: 0 | 1 = 1,
): GridDay[][] {
  // Walk back to the start of this week.
  const dow = today.getDay(); // 0 = Sun
  const offsetToWeekStart = weekStartsOn === 1 ? (dow === 0 ? 6 : dow - 1) : dow;
  const thisWeekStart = addDays(today, -offsetToWeekStart);
  const gridStart = addDays(thisWeekStart, -(weeks - 1) * 7);

  const todayKey = localDayKey(today);
  const rows: GridDay[][] = [];

  for (let w = 0; w < weeks; w++) {
    const row: GridDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(gridStart, w * 7 + d);
      const key = localDayKey(date);
      let state: DayState;
      if (key > todayKey) state = 'future';
      else if (loggedDays.has(key)) state = 'logged';
      else if (key === todayKey) state = 'today-pending';
      else state = 'missed';
      row.push({ key, date, state });
    }
    rows.push(row);
  }
  return rows;
}

/** Encouraging, non-shaming copy. Never implies anything about what they ate. */
export function streakMessage(s: StreakResult): string {
  if (s.current === 0) return 'Log a meal to start your streak.';
  if (!s.loggedToday) return `${s.current}-day streak — log today to keep it going.`;
  if (s.current === 1) return 'Streak started. See you tomorrow!';
  if (s.current >= s.longest && s.current > 2) return `${s.current} days — your best run yet!`;
  return `${s.current} days in a row. Nice consistency.`;
}
