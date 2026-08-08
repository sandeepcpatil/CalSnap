import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { formatMl } from '../utils/water';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealReminder {
  mealType: MealType;
  hour: number;
  minute: number;
  enabled: boolean;
}

/**
 * How many days ahead each conditional reminder is pre-armed.
 *
 * Local notifications carry fixed content and can't be recomputed when they
 * fire, and a repeating DAILY trigger can't skip one occurrence — so anything
 * "smart" (skip once done) is a short runway of one-off DATE notifications,
 * re-armed whenever the app learns new state. Four days keeps a lapsed user
 * covered while staying well under iOS's 64 pending-notification cap
 * (4 meals×4 + 3 water slots×4 + 7 streak ≈ 35).
 */
const RUNWAY_DAYS = 4;

// Show alerts + play sound when a notification arrives while app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('meal-reminders', {
      name: 'Meal Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('water-reminders', {
      name: 'Water Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200],
      sound: 'default',
    });
  }
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  if (!canAskAgain) return false;
  const { status: newStatus } = await Notifications.requestPermissionsAsync();
  return newStatus === 'granted';
}

const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const MEAL_COPY: Record<MealType, { title: string; body: string }> = {
  breakfast: { title: '🌅 Breakfast Time',  body: "You haven't logged breakfast yet — a quick scan keeps your day on track." },
  lunch:     { title: '☀️ Lunch Reminder',  body: "Lunch isn't logged yet. Scan it in a couple of taps." },
  dinner:    { title: '🌙 Dinner Time',     body: "Haven't logged dinner? Log it now to close out your day." },
  snack:     { title: '⚡ Snack Break',     body: 'Had a snack? Log it so your totals stay accurate.' },
};

const mealId = (type: MealType, i: number) => `meal-${type}-${i}`;

/** Purge every meal notification — the new runway ids and the old DAILY ids. */
async function cancelMealReminders(): Promise<void> {
  const ids: string[] = [];
  for (const type of MEAL_TYPES) {
    ids.push(`reminder-${type}`); // legacy DAILY id from earlier versions
    for (let i = 0; i < RUNWAY_DAYS; i++) ids.push(mealId(type, i));
  }
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

/**
 * Smart meal reminders: fire at each enabled meal's time, but skip *today's*
 * nudge for a meal that's already been logged. Re-arm this whenever a meal is
 * logged (which removes the just-satisfied nudge) and on app foreground (which
 * rolls the runway forward and fixes the day boundary).
 */
/** Only the schedule fields matter here — `mealType` is the map key already. */
type MealTime = { hour: number; minute: number; enabled: boolean };

export async function scheduleSmartMealReminders(opts: {
  reminders: Record<MealType, MealTime>;
  loggedTypesToday: readonly MealType[];
}): Promise<void> {
  await cancelMealReminders();

  const now = new Date();
  const loggedToday = new Set(opts.loggedTypesToday);

  for (const type of MEAL_TYPES) {
    const cfg = opts.reminders[type];
    if (!cfg?.enabled) continue;

    const copy = MEAL_COPY[type];
    let scheduled = 0;
    for (let offset = 0; offset <= RUNWAY_DAYS && scheduled < RUNWAY_DAYS; offset++) {
      const when = new Date(now);
      when.setDate(now.getDate() + offset);
      when.setHours(cfg.hour, cfg.minute, 0, 0);

      if (when <= now) continue;                          // time already passed
      if (offset === 0 && loggedToday.has(type)) continue; // already logged today

      await Notifications.scheduleNotificationAsync({
        identifier: mealId(type, scheduled),
        content: { title: copy.title, body: copy.body, sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'meal-reminders' },
      }).catch(() => {});
      scheduled += 1;
    }
  }
}

// ─── Water reminders ─────────────────────────────────────────────────────────
/**
 * A few paced nudges through the day, each with a target fraction of the goal
 * that should be reached by then. Today's slot is skipped when the user is
 * already on pace (or done); future days get generic copy since tomorrow's
 * intake is unknowable in advance.
 */
const WATER_SLOTS: readonly { hour: number; frac: number }[] = [
  { hour: 12, frac: 0.30 },
  { hour: 16, frac: 0.60 },
  { hour: 20, frac: 0.90 },
];
const WATER_ID_COUNT = WATER_SLOTS.length * RUNWAY_DAYS;
const WATER_IDS = Array.from({ length: WATER_ID_COUNT }, (_, i) => `water-reminder-${i}`);

export async function cancelWaterReminders(): Promise<void> {
  await Promise.all(WATER_IDS.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

export async function scheduleWaterReminders(opts: {
  enabled: boolean;
  goalMl: number;
  consumedMl: number;
}): Promise<void> {
  await cancelWaterReminders();
  if (!opts.enabled || opts.goalMl <= 0) return;

  const now = new Date();
  let idx = 0;

  for (let offset = 0; offset < RUNWAY_DAYS && idx < WATER_ID_COUNT; offset++) {
    for (const slot of WATER_SLOTS) {
      if (idx >= WATER_ID_COUNT) break;
      const when = new Date(now);
      when.setDate(now.getDate() + offset);
      when.setHours(slot.hour, 0, 0, 0);
      if (when <= now) continue;

      let body: string;
      if (offset === 0) {
        // Don't nag someone who's done or on pace for the day.
        if (opts.consumedMl >= opts.goalMl) continue;
        if (opts.consumedMl >= opts.goalMl * slot.frac) continue;
        body = `About ${formatMl(opts.goalMl - opts.consumedMl)} to go today — a quick glass keeps you on track. 💧`;
      } else {
        body = `Stay hydrated 💧 Aim for ${formatMl(opts.goalMl)} of water today.`;
      }

      await Notifications.scheduleNotificationAsync({
        identifier: WATER_IDS[idx],
        content: { title: '💧 Water break', body, sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'water-reminders' },
      }).catch(() => {});
      idx += 1;
    }
  }
}

// ─── Weigh-in reminder ───────────────────────────────────────────────────────
/**
 * A gentle weekly nudge to weigh in, anchored to the last weigh-in so it never
 * fires the same week you already stepped on the scale. Re-armed on every
 * weigh-in (which pushes it out a week) and on app foreground.
 */
const WEIGHIN_IDS = ['weighin-0', 'weighin-1', 'weighin-2'];
const WEIGHIN_HOUR = 8;
const WEEK_MS = 7 * 86_400_000;

export async function cancelWeighInReminders(): Promise<void> {
  await Promise.all(WEIGHIN_IDS.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

export async function scheduleWeighInReminders(opts: {
  enabled: boolean;
  lastWeighInMs: number | null;
}): Promise<void> {
  await cancelWeighInReminders();
  if (!opts.enabled) return;

  const now = Date.now();
  // Start the clock at the later of "now" and the last weigh-in, so a recent
  // weigh-in delays the next reminder by a full week.
  const anchor = Math.max(now, opts.lastWeighInMs ?? 0);

  for (let i = 0; i < WEIGHIN_IDS.length; i++) {
    const when = new Date(anchor + (i + 1) * WEEK_MS);
    when.setHours(WEIGHIN_HOUR, 0, 0, 0);
    if (when.getTime() <= now) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: WEIGHIN_IDS[i],
      content: {
        title: '⚖️ Weekly weigh-in',
        body: 'Time for your weekly weigh-in — it takes five seconds and keeps your trend honest.',
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'meal-reminders' },
    }).catch(() => {});
  }
}

// ─── Streak reminder ─────────────────────────────────────────────────────────
/**
 * A single evening nudge that fires only on days with no log.
 *
 * A DAILY repeating trigger can't skip one occurrence, so instead we arm a
 * short run of one-off DATE notifications and re-arm them whenever we learn the
 * user has logged. Seven days of runway means the reminder keeps working even
 * if they don't open the app for a while.
 *
 * Copy is about the logging habit, never about eating — this must not read as
 * pressure around food.
 */
const STREAK_DAYS_AHEAD = 7;
const STREAK_IDS = Array.from({ length: STREAK_DAYS_AHEAD }, (_, i) => `streak-reminder-${i}`);

export const STREAK_REMINDER_HOUR = 20; // 8 PM
export const STREAK_REMINDER_MINUTE = 0;

export async function cancelStreakReminders(): Promise<void> {
  await Promise.all(
    STREAK_IDS.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})),
  );
}

/**
 * Re-arm the streak reminders.
 * `loggedToday` skips tonight's nudge — call this right after a meal is saved.
 */
export async function scheduleStreakReminders(opts: {
  enabled: boolean;
  loggedToday: boolean;
}): Promise<void> {
  await cancelStreakReminders();
  if (!opts.enabled) return;

  const now = new Date();
  let scheduled = 0;

  for (let offset = 0; offset < STREAK_DAYS_AHEAD + 1 && scheduled < STREAK_DAYS_AHEAD; offset++) {
    const when = new Date(now);
    when.setDate(now.getDate() + offset);
    when.setHours(STREAK_REMINDER_HOUR, STREAK_REMINDER_MINUTE, 0, 0);

    // Skip tonight if they've already logged, or if 8 PM has passed.
    if (when <= now) continue;
    if (offset === 0 && opts.loggedToday) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: STREAK_IDS[scheduled],
      content: {
        title: '🔥 Keep your streak alive',
        body: "You haven't logged a meal today — a quick scan keeps your streak going.",
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: 'meal-reminders',
      },
    }).catch(() => {});
    scheduled += 1;
  }
}
