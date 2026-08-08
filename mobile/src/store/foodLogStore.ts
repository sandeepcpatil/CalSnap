import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { num } from '../utils/foodItems';

export interface FoodLog {
  id: string;
  user_id: string;
  image_url: string | null;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  sugar_g: number;
  sat_fat_g: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
  meal_id?: string | null;
  logged_at: string;
}

const CACHE_KEY = 'calsnap_today_logs';

interface FoodLogState {
  todayLogs: FoodLog[];
  selectedDate: string; // ISO date string YYYY-MM-DD
  isLoading: boolean;

  setSelectedDate: (date: string) => void;
  fetchLogsForDate: (userId: string, date: string) => Promise<void>;
  addLog: (log: FoodLog) => void;
  removeLog: (logId: string) => void;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Postgres returns the DECIMAL macro columns as strings. Coerce them the moment
 * a row enters the store, so everything downstream — dashboard totals, meal
 * sections, export — can treat a FoodLog's macros as the numbers the type
 * promises. Without this, `sum + protein_g` concatenates and the day's totals
 * read as NaN (which then shows as 0).
 */
export function normalizeLog(row: FoodLog): FoodLog {
  return {
    ...row,
    calories: num(row.calories),
    protein_g: num(row.protein_g),
    carbs_g: num(row.carbs_g),
    fat_g: num(row.fat_g),
    fiber_g: num(row.fiber_g),
    sodium_mg: num(row.sodium_mg),
    sugar_g: num(row.sugar_g),
    sat_fat_g: num(row.sat_fat_g),
  };
}

export const useFoodLogStore = create<FoodLogState>((set, get) => ({
  todayLogs: [],
  selectedDate: todayISO(),
  isLoading: false,

  setSelectedDate: (date) => {
    set({ selectedDate: date });
  },

  fetchLogsForDate: async (userId, date) => {
    set({ isLoading: true });

    // Load cached today logs instantly for snappy UX
    if (date === todayISO()) {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          set({ todayLogs: JSON.parse(cached), isLoading: false });
        }
      } catch {
        // Ignore cache errors
      }
    }

    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const { data, error } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', startOfDay)
      .lte('logged_at', endOfDay)
      .order('logged_at', { ascending: true });

    if (!error && data) {
      const logs = (data as FoodLog[]).map(normalizeLog);
      set({ todayLogs: logs, isLoading: false });

      // Cache today's result for offline support
      if (date === todayISO()) {
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(logs)).catch(() => {});
      }
    } else {
      set({ isLoading: false });
    }
  },

  addLog: (log) => {
    set((state) => {
      // A freshly-inserted row from `.select()` carries the same stringy
      // macros, so normalize it here too.
      const updated = [...state.todayLogs, normalizeLog(log)];
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updated)).catch(() => {});
      return { todayLogs: updated };
    });
  },

  removeLog: (logId) => {
    set((state) => {
      const updated = state.todayLogs.filter((l) => l.id !== logId);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updated)).catch(() => {});
      return { todayLogs: updated };
    });
  },
}));
