import { useCallback, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/authStore';
import { useWaterStore, totalMl } from '../store/waterStore';
import { useNotificationStore } from '../store/notificationStore';
import { waterGoalMl } from '../utils/water';

/**
 * Everything a screen needs to show and change today's hydration.
 *
 * Three surfaces log water — the Home card, the log hub sheet and the Water
 * screen — and each of them needs the same fetch-on-mount, the same goal
 * derivation and the same failure handling. Putting it here is what stops the
 * three from drifting.
 */
export function useWater() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const logs = useWaterStore((s) => s.logs);
  const isLoading = useWaterStore((s) => s.isLoading);
  const fetchForDate = useWaterStore((s) => s.fetchForDate);
  const addWater = useWaterStore((s) => s.addWater);
  const removeWater = useWaterStore((s) => s.removeWater);

  const userId = session?.user.id;
  const consumedMl = useMemo(() => totalMl(logs), [logs]);
  const goalMl = waterGoalMl(profile?.daily_water_ml_goal, profile?.weight_kg, profile?.activity_level);

  const refresh = useCallback(() => {
    if (!userId) return;
    fetchForDate(userId, new Date().toISOString().slice(0, 10));
  }, [userId, fetchForDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (amountMl: number) => {
      if (!userId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        await addWater(userId, amountMl);
        // Water changed — re-arm the paced reminders so they reflect the new
        // total (and stop for the day once the goal is met).
        void useNotificationStore.getState().syncReminders();
      } catch (err) {
        // The optimistic row has already been rolled back by the store, so the
        // ring is correct again — the user only needs to know why it moved.
        Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
      }
    },
    [userId, addWater],
  );

  const remove = useCallback(
    async (logId: string) => {
      try {
        await removeWater(logId);
      } catch (err) {
        Alert.alert('Could not remove', err instanceof Error ? err.message : 'Please try again.');
      }
    },
    [removeWater],
  );

  return { logs, consumedMl, goalMl, isLoading, add, remove, refresh };
}
