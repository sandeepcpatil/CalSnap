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

/** Fixed, user-safe copy. Raw error strings never reach the screen. */
export const FETCH_ERROR_COPY = "Couldn't refresh. Showing saved data.";

/**
 * How long a removed row stays recoverable before the server delete runs.
 * Matches the snackbar's 6 s action window so "Undo" always beats the delete.
 */
const UNDO_WINDOW_MS = 6000;

interface FoodLogState {
  todayLogs: FoodLog[];
  selectedDate: string; // ISO date string YYYY-MM-DD
  isLoading: boolean;
  /**
   * True once the store holds *some* answer for the current fetch — the cache
   * or the network. Until then the screen has nothing to show and should render
   * a placeholder rather than "goal remaining".
   */
  hasLoaded: boolean;
  /** Fixed copy set when the network fetch fails; null after a successful one. */
  error: string | null;

  setSelectedDate: (date: string) => void;
  fetchLogsForDate: (userId: string, date: string) => Promise<void>;
  addLog: (log: FoodLog) => void;
  removeLog: (logId: string) => void;
  /**
   * Optimistic delete with an undo window: the row leaves the list at once,
   * the server delete runs after `UNDO_WINDOW_MS` unless `restoreLog` cancels
   * it. Resolves to the removed row (for the toast copy) or null if not found.
   */
  deleteLogWithUndo: (logId: string) => FoodLog | null;
  /** Cancels a pending delete and puts the row back where it was. */
  restoreLog: (logId: string) => void;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function persistToday(logs: FoodLog[]) {
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(logs)).catch(() => {});
}

function sortByTime(logs: FoodLog[]): FoodLog[] {
  return [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
}

/** Rows removed optimistically and still inside their undo window. */
const pendingDeletes = new Map<string, { log: FoodLog; timer: ReturnType<typeof setTimeout> }>();

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
  hasLoaded: false,
  error: null,

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
          set({ todayLogs: JSON.parse(cached), isLoading: false, hasLoaded: true });
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
      // A row still inside its undo window must not reappear from the server.
      const logs = (data as FoodLog[])
        .map(normalizeLog)
        .filter((l) => !pendingDeletes.has(l.id));
      set({ todayLogs: logs, isLoading: false, hasLoaded: true, error: null });

      // Cache today's result for offline support
      if (date === todayISO()) {
        persistToday(logs);
      }
    } else {
      // The message is fixed copy; the underlying error stays out of the UI.
      set({ isLoading: false, hasLoaded: true, error: FETCH_ERROR_COPY });
    }
  },

  addLog: (log) => {
    set((state) => {
      // A freshly-inserted row from `.select()` carries the same stringy
      // macros, so normalize it here too.
      const updated = [...state.todayLogs, normalizeLog(log)];
      persistToday(updated);
      return { todayLogs: updated };
    });
  },

  removeLog: (logId) => {
    set((state) => {
      const updated = state.todayLogs.filter((l) => l.id !== logId);
      persistToday(updated);
      return { todayLogs: updated };
    });
  },

  deleteLogWithUndo: (logId) => {
    const log = get().todayLogs.find((l) => l.id === logId);
    if (!log) return null;

    get().removeLog(logId);

    const timer = setTimeout(async () => {
      pendingDeletes.delete(logId);
      // Scoped to the owner as well as the id, so the request can only ever
      // touch a row that belongs to this user.
      const { error } = await supabase
        .from('food_logs')
        .delete()
        .eq('id', logId)
        .eq('user_id', log.user_id);
      if (error) {
        // The row still exists on the server, so put it back rather than let the
        // list drift from the truth.
        reinsert(log);
        set({ error: "Couldn't remove that item. It has been put back." });
      }
    }, UNDO_WINDOW_MS);

    pendingDeletes.set(logId, { log, timer });
    return log;
  },

  restoreLog: (logId) => {
    const pending = pendingDeletes.get(logId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingDeletes.delete(logId);
    reinsert(pending.log);
  },
}));

/** Puts a removed row back in time order (no-op if it is already present). */
function reinsert(log: FoodLog) {
  useFoodLogStore.setState((state) => {
    if (state.todayLogs.some((l) => l.id === log.id)) return {};
    const updated = sortByTime([...state.todayLogs, log]);
    persistToday(updated);
    return { todayLogs: updated };
  });
}
