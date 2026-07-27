import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestNotificationPermission,
  scheduleMealReminder,
  cancelMealReminder,
  type MealType,
} from '../services/notifications';

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

  requestPermission: () => Promise<boolean>;
  toggleReminder: (mealType: MealType) => Promise<ToggleResult>;
  setReminderTime: (mealType: MealType, hour: number, minute: number) => Promise<void>;
}

const DEFAULTS: Record<MealType, ReminderConfig> = {
  breakfast: { hour: 8,  minute: 0,  enabled: false },
  lunch:     { hour: 13, minute: 0,  enabled: false },
  dinner:    { hour: 19, minute: 0,  enabled: false },
  snack:     { hour: 16, minute: 0,  enabled: false },
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      permissionGranted: false,
      reminders: DEFAULTS,

      requestPermission: async () => {
        const granted = await requestNotificationPermission();
        set({ permissionGranted: granted });
        return granted;
      },

      toggleReminder: async (mealType) => {
        const current = get().reminders[mealType];
        const enabled = !current.enabled;

        // Always verify permission live when enabling — the persisted flag can be
        // stale if the user revoked notifications in system settings.
        if (enabled) {
          const granted = await requestNotificationPermission();
          set({ permissionGranted: granted });
          if (!granted) return { ok: false, reason: 'permission_denied' };
        }

        const updated = { ...current, enabled };
        set((s) => ({ reminders: { ...s.reminders, [mealType]: updated } }));

        try {
          if (enabled) {
            await scheduleMealReminder({ mealType, ...updated });
          } else {
            await cancelMealReminder(mealType);
          }
        } catch {
          // Scheduling failed — revert the switch so UI reflects reality.
          set((s) => ({ reminders: { ...s.reminders, [mealType]: current } }));
          return { ok: false, reason: 'schedule_failed' };
        }

        return { ok: true };
      },

      setReminderTime: async (mealType, hour, minute) => {
        const current = get().reminders[mealType];
        const updated = { ...current, hour, minute };
        set((s) => ({ reminders: { ...s.reminders, [mealType]: updated } }));

        // Re-schedule only if the reminder is active
        if (updated.enabled) {
          await scheduleMealReminder({ mealType, ...updated });
        }
      },
    }),
    {
      name: 'calsnap-notifications',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
