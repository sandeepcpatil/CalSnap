import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';

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
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
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
      set({ todayLogs: data as FoodLog[], isLoading: false });

      // Cache today's result for offline support
      if (date === todayISO()) {
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
      }
    } else {
      set({ isLoading: false });
    }
  },

  addLog: (log) => {
    set((state) => {
      const updated = [...state.todayLogs, log];
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
