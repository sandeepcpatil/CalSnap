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
    },
  });
}

export async function cancelMealReminder(mealType: MealType): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID[mealType]).catch(() => {});
}

export async function scheduleAllReminders(reminders: MealReminder[]): Promise<void> {
  await Promise.all(reminders.map(scheduleMealReminder));
}
