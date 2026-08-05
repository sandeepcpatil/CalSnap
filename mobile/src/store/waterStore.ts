import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { uuidv4 } from '../utils/uuid';

export interface WaterLog {
  id: string;
  user_id: string;
  amount_ml: number;
  logged_at: string;
}

const CACHE_KEY = 'calsnap_today_water';

interface WaterState {
  /** Logs for `loadedDate`, oldest first. */
  logs: WaterLog[];
  loadedDate: string;
  isLoading: boolean;

  fetchForDate: (userId: string, date: string) => Promise<void>;
  addWater: (userId: string, amountMl: number) => Promise<void>;
  removeWater: (logId: string) => Promise<void>;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Total ml in a list — the one place the day's number is computed. */
export function totalMl(logs: readonly WaterLog[]): number {
  return logs.reduce((sum, l) => sum + (l.amount_ml || 0), 0);
}

/**
 * Hydration is logged 6–8 times a day, far more often than meals, so every
 * write is optimistic: the ring moves on tap and reconciles with the server
 * afterwards. A failed insert rolls the row back out rather than leaving a
 * number on screen that isn't really saved.
 *
 * Day boundaries use the same UTC slicing as `foodLogStore` on purpose — the
 * water card and the calorie ring sit next to each other on Home and must
 * agree about which day it is.
 */
/**
 * Collapses concurrent fetches for the same day. Three surfaces call `useWater`
 * — the Home card, the hub sheet and the Water screen — and on a cold start
 * they would otherwise fire the same query two or three times.
 */
const inFlight = new Map<string, Promise<void>>();

export const useWaterStore = create<WaterState>((set, get) => ({
  logs: [],
  loadedDate: todayISO(),
  isLoading: false,

  fetchForDate: (userId, date) => {
    const key = `${userId}:${date}`;
    const existing = inFlight.get(key);
    if (existing) return existing;

    const run = (async () => {
      const isToday = date === todayISO();
      set({ isLoading: true, loadedDate: date });

      // Show cached water instantly on a cold start — the ring drawing 0 and
      // then jumping is worse than a brief stale value.
      if (isToday) {
        try {
          const cached = await AsyncStorage.getItem(CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as { date: string; logs: WaterLog[] };
            if (parsed?.date === date && Array.isArray(parsed.logs)) {
              set({ logs: parsed.logs, isLoading: false });
            }
          }
        } catch {
          // A corrupt cache is not worth failing the screen over.
        }
      }

      const { data, error } = await supabase
        .from('water_logs')
        .select('id, user_id, amount_ml, logged_at')
        .eq('user_id', userId)
        .gte('logged_at', `${date}T00:00:00.000Z`)
        .lte('logged_at', `${date}T23:59:59.999Z`)
        .order('logged_at', { ascending: true });

      if (error || !data) {
        // Offline: keep whatever we showed from cache.
        set({ isLoading: false });
        return;
      }

      // A slow response for yesterday must not overwrite today's list if the
      // user switched dates while it was in flight.
      if (get().loadedDate !== date) return;

      set({ logs: data as WaterLog[], isLoading: false });
      if (isToday) {
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ date, logs: data })).catch(() => {});
      }
    })().finally(() => inFlight.delete(key));

    inFlight.set(key, run);
    return run;
  },

  addWater: async (userId, amountMl) => {
    const optimistic: WaterLog = {
      id: uuidv4(),
      user_id: userId,
      amount_ml: amountMl,
      logged_at: new Date().toISOString(),
    };

    set((s) => {
      const logs = [...s.logs, optimistic];
      persist(s.loadedDate, logs);
      return { logs };
    });

    // Send our own id so the optimistic row and the stored row are the same
    // row — otherwise an undo tapped before the insert returns would delete
    // nothing on the server.
    const { error } = await supabase.from('water_logs').insert({
      id: optimistic.id,
      user_id: userId,
      amount_ml: amountMl,
      logged_at: optimistic.logged_at,
    });

    if (error) {
      set((s) => {
        const logs = s.logs.filter((l) => l.id !== optimistic.id);
        persist(s.loadedDate, logs);
        return { logs };
      });
      throw new Error(error.message);
    }
  },

  removeWater: async (logId) => {
    const previous = get().logs;
    set((s) => {
      const logs = s.logs.filter((l) => l.id !== logId);
      persist(s.loadedDate, logs);
      return { logs };
    });

    const { error } = await supabase.from('water_logs').delete().eq('id', logId);
    if (error) {
      set({ logs: previous });
      persist(get().loadedDate, previous);
      throw new Error(error.message);
    }
  },
}));

/** Only today is cached — older days are never read offline. */
function persist(date: string, logs: readonly WaterLog[]): void {
  if (date !== todayISO()) return;
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ date, logs })).catch(() => {});
}
