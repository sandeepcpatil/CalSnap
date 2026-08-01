import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealReminder {
  mealType: MealType;
  hour: number;
  minute: number;
  enabled: boolean;
}

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
  }
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  if (!canAskAgain) return false;
  const { status: newStatus } = await Notifications.requestPermissionsAsync();
  return newStatus === 'granted';
}

const MEAL_COPY: Record<MealType, { title: string; body: string }> = {
  breakfast: { title: '🌅 Breakfast Time',  body: "Start your day right — log your breakfast on CalSnap!" },
  lunch:     { title: '☀️ Lunch Reminder',  body: "It's lunchtime! Don't forget to scan your meal." },
  dinner:    { title: '🌙 Dinner Time',     body: 'Evening meal reminder — log your dinner to stay on track.' },
  snack:     { title: '⚡ Snack Break',     body: 'Time for a healthy snack! Log it on CalSnap.' },
};

// Stable identifier so we can cancel by ID without tracking extra state
const NOTIFICATION_ID: Record<MealType, string> = {
  breakfast: 'reminder-breakfast',
  lunch:     'reminder-lunch',
  dinner:    'reminder-dinner',
  snack:     'reminder-snack',
};

export async function scheduleMealReminder(reminder: MealReminder): Promise<void> {
  // Always cancel the old one first (idempotent)
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID[reminder.mealType]).catch(() => {});

  if (!reminder.enabled) return;

  const copy = MEAL_COPY[reminder.mealType];
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID[reminder.mealType],
    content: {
      title: copy.title,
      body: copy.body,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: reminder.hour,
      minute: reminder.minute,
      channelId: 'meal-reminders',
    },
  });
}

export async function cancelMealReminder(mealType: MealType): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID[mealType]).catch(() => {});
}

export async function scheduleAllReminders(reminders: MealReminder[]): Promise<void> {
  await Promise.all(reminders.map(scheduleMealReminder));
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
