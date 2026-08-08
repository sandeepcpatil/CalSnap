import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import {
  requestNotificationPermission,
  scheduleSmartMealReminders,
  scheduleStreakReminders,
  cancelStreakReminders,
  scheduleWaterReminders,
  cancelWaterReminders,
  scheduleWeighInReminders,
  cancelWeighInReminders,
  type MealType,
} from '../services/notifications';
import { useFoodLogStore } from './foodLogStore';
import { useWaterStore, totalMl } from './waterStore';
import { useWeightStore, latestLog } from './weightStore';
import { useAuthStore } from './authStore';
import { waterGoalMl } from '../utils/water';

interface ReminderConfig {
  hour: number;
  minute: number;
  enabled: boolean;
}

/** Result of a toggle so the UI can explain a failure instead of silently reverting. */
export interface ToggleResult {
  ok: boolean;
  reason?: 'permission_denied' | 'schedule_failed';
}

interface NotificationState {
  permissionGranted: boolean;
  reminders: Record<MealType, ReminderConfig>;
  /**
   * Streak nudge. Defaults ON so it works without configuration, but a toggle
   * exists deliberately: without one, an annoyed user's only option is to
   * disable ALL notifications at the OS level — which would silently kill the
   * meal reminders too.
   */
  streakReminderEnabled: boolean;
  /** Paced hydration nudges that stop once the day's goal is met. */
  waterReminderEnabled: boolean;
  /** Weekly weigh-in nudge, anchored to the last weigh-in. */
  weighInReminderEnabled: boolean;
  /** Whether we've already shown the one-time "turn on reminders?" pre-prompt. */
  hasPromptedPermission: boolean;

  requestPermission: () => Promise<boolean>;
  toggleReminder: (mealType: MealType) => Promise<ToggleResult>;
  setReminderTime: (mealType: MealType, hour: number, minute: number) => Promise<void>;
  toggleStreakReminder: () => Promise<ToggleResult>;
  toggleWaterReminder: () => Promise<ToggleResult>;
  toggleWeighInReminder: () => Promise<ToggleResult>;
  /**
   * Re-arm every reminder from current state — which meals are logged today,
   * how much water so far. Cheap and idempotent; call on app foreground and
   * after any food or water log.
   */
  syncReminders: () => Promise<void>;
  /** Back-compat alias — existing log paths call this after saving. */
  refreshStreakReminder: (loggedToday: boolean) => Promise<void>;
  /** Show the reminders pre-prompt once, after the user's first log. */
  promptForRemindersOnce: () => Promise<void>;
}

const DEFAULTS: Record<MealType, ReminderConfig> = {
  breakfast: { hour: 8,  minute: 0,  enabled: false },
  lunch:     { hour: 13, minute: 0,  enabled: false },
  dinner:    { hour: 19, minute: 0,  enabled: false },
  snack:     { hour: 16, minute: 0,  enabled: false },
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Read today's logged meal types + water total from the other stores. */
function currentDayState() {
  const todayLogs = useFoodLogStore.getState().todayLogs;
  const loggedTypesToday = [
    ...new Set(todayLogs.map((l) => l.meal_type).filter(Boolean) as MealType[]),
  ];

  const profile = useAuthStore.getState().profile;
  const goalMl = waterGoalMl(profile?.daily_water_ml_goal, profile?.weight_kg, profile?.activity_level);

  const water = useWaterStore.getState();
  // Only trust the water total if the store is actually holding today's logs;
  // otherwise treat it as 0 and let the next sync (after a fetch) correct it.
  const consumedMl = water.loadedDate === todayISO() ? totalMl(water.logs) : 0;

  const newest = latestLog(useWeightStore.getState().logs);
  const lastWeighInMs = newest ? Date.parse(newest.logged_at) : null;

  return { loggedTypesToday, loggedToday: todayLogs.length > 0, goalMl, consumedMl, lastWeighInMs };
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      permissionGranted: false,
      reminders: DEFAULTS,
      streakReminderEnabled: true,
      waterReminderEnabled: true,
      weighInReminderEnabled: true,
      hasPromptedPermission: false,

      requestPermission: async () => {
        const granted = await requestNotificationPermission();
        set({ permissionGranted: granted });
        return granted;
      },

      syncReminders: async () => {
        const { permissionGranted, reminders, streakReminderEnabled, waterReminderEnabled, weighInReminderEnabled } = get();
        if (!permissionGranted) return;

        const { loggedTypesToday, loggedToday, goalMl, consumedMl, lastWeighInMs } = currentDayState();
        try {
          await Promise.all([
            scheduleSmartMealReminders({ reminders, loggedTypesToday }),
            scheduleStreakReminders({ enabled: streakReminderEnabled, loggedToday }),
            scheduleWaterReminders({ enabled: waterReminderEnabled, goalMl, consumedMl }),
            scheduleWeighInReminders({ enabled: weighInReminderEnabled, lastWeighInMs }),
          ]);
        } catch {
          // Non-fatal — reminders re-arm on the next log or foreground.
        }
      },

      refreshStreakReminder: async () => {
        await get().syncReminders();
      },

      toggleReminder: async (mealType) => {
        const current = get().reminders[mealType];
        const enabled = !current.enabled;

        // Verify permission live when enabling — the persisted flag can be stale
        // if the user revoked notifications in system settings.
        if (enabled) {
          const granted = await requestNotificationPermission();
          set({ permissionGranted: granted });
          if (!granted) return { ok: false, reason: 'permission_denied' };
        }

        set((s) => ({ reminders: { ...s.reminders, [mealType]: { ...current, enabled } } }));
        try {
          await get().syncReminders();
        } catch {
          set((s) => ({ reminders: { ...s.reminders, [mealType]: current } }));
          return { ok: false, reason: 'schedule_failed' };
        }
        return { ok: true };
      },

      setReminderTime: async (mealType, hour, minute) => {
        set((s) => ({ reminders: { ...s.reminders, [mealType]: { ...s.reminders[mealType], hour, minute } } }));
        await get().syncReminders();
      },

      toggleStreakReminder: async () => {
        const enabled = !get().streakReminderEnabled;
        if (enabled) {
          const granted = await requestNotificationPermission();
          set({ permissionGranted: granted });
          if (!granted) return { ok: false, reason: 'permission_denied' };
        }
        set({ streakReminderEnabled: enabled });
        try {
          if (enabled) await get().syncReminders();
          else await cancelStreakReminders();
        } catch {
          set({ streakReminderEnabled: !enabled });
          return { ok: false, reason: 'schedule_failed' };
        }
        return { ok: true };
      },

      toggleWaterReminder: async () => {
        const enabled = !get().waterReminderEnabled;
        if (enabled) {
          const granted = await requestNotificationPermission();
          set({ permissionGranted: granted });
          if (!granted) return { ok: false, reason: 'permission_denied' };
        }
        set({ waterReminderEnabled: enabled });
        try {
          if (enabled) await get().syncReminders();
          else await cancelWaterReminders();
        } catch {
          set({ waterReminderEnabled: !enabled });
          return { ok: false, reason: 'schedule_failed' };
        }
        return { ok: true };
      },

      toggleWeighInReminder: async () => {
        const enabled = !get().weighInReminderEnabled;
        if (enabled) {
          const granted = await requestNotificationPermission();
          set({ permissionGranted: granted });
          if (!granted) return { ok: false, reason: 'permission_denied' };
        }
        set({ weighInReminderEnabled: enabled });
        try {
          if (enabled) await get().syncReminders();
          else await cancelWeighInReminders();
        } catch {
          set({ weighInReminderEnabled: !enabled });
          return { ok: false, reason: 'schedule_failed' };
        }
        return { ok: true };
      },

      promptForRemindersOnce: async () => {
        if (get().permissionGranted || get().hasPromptedPermission) return;
        set({ hasPromptedPermission: true });

        // A soft pre-prompt, so a "no" doesn't burn the one system prompt iOS
        // allows — only a "yes" reaches the OS dialog.
        Alert.alert(
          'Turn on reminders?',
          "We'll nudge you to log meals and drink water so you don't break your streak. You can fine-tune these anytime in Reminders.",
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Turn on',
              onPress: async () => {
                const granted = await requestNotificationPermission();
                set({ permissionGranted: granted });
                if (granted) await get().syncReminders();
              },
            },
          ],
        );
      },
    }),
    {
      name: 'calsnap-notifications',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
