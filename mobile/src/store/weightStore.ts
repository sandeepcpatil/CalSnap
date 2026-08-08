import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { uuidv4 } from '../utils/uuid';
import { useAuthStore } from './authStore';
import { num } from '../utils/foodItems';

export interface WeightLog {
  id: string;
  user_id: string;
  weight_kg: number;
  logged_at: string;
}

const CACHE_KEY = 'calsnap_weight_logs';
/** How far back the screen and trend look. */
const WINDOW_DAYS = 180;

interface WeightState {
  logs: WeightLog[];
  isLoading: boolean;
  loaded: boolean;

  fetch: (userId: string) => Promise<void>;
  addWeight: (userId: string, kg: number, at?: string) => Promise<void>;
  removeWeight: (logId: string) => Promise<void>;
}

/** Newest reading, or null. */
export function latestLog(logs: readonly WeightLog[]): WeightLog | null {
  let best: WeightLog | null = null;
  for (const l of logs) if (!best || l.logged_at > best.logged_at) best = l;
  return best;
}

function persist(logs: readonly WeightLog[]): void {
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(logs)).catch(() => {});
}

/**
 * Weigh-ins. Lower-frequency than food or water, so a single window fetch is
 * plenty. Logging a new weight also writes `profiles.weight_kg` (below) so the
 * calorie and water goals keep tracking the latest reading — the whole point of
 * the "closes the loop" design.
 */
export const useWeightStore = create<WeightState>((set, get) => ({
  logs: [],
  isLoading: false,
  loaded: false,

  fetch: async (userId) => {
    set({ isLoading: true });

    // Cached first so the chart doesn't flash empty on a cold start.
    if (!get().loaded) {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) set({ logs: JSON.parse(cached) as WeightLog[] });
      } catch {
        // ignore a corrupt cache
      }
    }

    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from('weight_logs')
      .select('id, user_id, weight_kg, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', since)
      .order('logged_at', { ascending: true });

    if (error || !data) { set({ isLoading: false, loaded: true }); return; }

    const logs = (data as WeightLog[]).map((l) => ({ ...l, weight_kg: num(l.weight_kg) }));
    set({ logs, isLoading: false, loaded: true });
    persist(logs);
  },

  addWeight: async (userId, kg, at) => {
    const optimistic: WeightLog = {
      id: uuidv4(),
      user_id: userId,
      weight_kg: kg,
      logged_at: at ?? new Date().toISOString(),
    };

    set((s) => {
      const logs = [...s.logs, optimistic];
      persist(logs);
      return { logs };
    });

    const { error } = await supabase.from('weight_logs').insert({
      id: optimistic.id,
      user_id: userId,
      weight_kg: kg,
      logged_at: optimistic.logged_at,
    });

    if (error) {
      set((s) => {
        const logs = s.logs.filter((l) => l.id !== optimistic.id);
        persist(logs);
        return { logs };
      });
      throw new Error(error.message);
    }

    // Keep the profile's weight (which the calorie + water goals read) in step
    // with the newest reading. Fire-and-forget: a failure here must not undo a
    // successful weigh-in.
    if (latestLog(get().logs)?.id === optimistic.id) {
      void useAuthStore.getState().updateProfile({ weight_kg: kg });
    }
  },

  removeWeight: async (logId) => {
    const previous = get().logs;
    set((s) => {
      const logs = s.logs.filter((l) => l.id !== logId);
      persist(logs);
      return { logs };
    });

    const { error } = await supabase.from('weight_logs').delete().eq('id', logId);
    if (error) {
      set({ logs: previous });
      persist(previous);
      throw new Error(error.message);
    }

    // If the newest reading was removed, roll the profile weight back to what's
    // now the latest.
    const newest = latestLog(get().logs);
    if (newest) void useAuthStore.getState().updateProfile({ weight_kg: newest.weight_kg });
  },
}));
