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

interface NotificationState {
  permissionGranted: boolean;
  reminders: Record<MealType, ReminderConfig>;

  requestPermission: () => Promise<boolean>;
  toggleReminder: (mealType: MealType) => Promise<void>;
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

        // Ask for permission if enabling for the first time
        if (enabled && !get().permissionGranted) {
          const granted = await requestNotificationPermission();
          if (!granted) return; // user denied — don't enable
          set({ permissionGranted: true });
        }

        const updated = { ...current, enabled };
        set((s) => ({ reminders: { ...s.reminders, [mealType]: updated } }));

        if (enabled) {
          await scheduleMealReminder({ mealType, ...updated });
        } else {
          await cancelMealReminder(mealType);
        }
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
