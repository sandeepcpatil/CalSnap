import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWeeklyRecap, type WeeklyRecap } from '../services/api';

interface RecapState {
  recap: WeeklyRecap | null;
  locked: boolean;
  loading: boolean;
  error: boolean;
  /** The access token the current recap was fetched for — refetch on account change. */
  fetchedForToken: string | null;
  /** The week_start the user has already seen — persisted, drives the unread dot. */
  seenWeek: string | null;

  fetch: (token: string, force?: boolean) => Promise<void>;
  markSeen: () => void;
  /** A generated recap the user hasn't opened yet. */
  hasUnread: () => boolean;
}

/**
 * The weekly recap, fetched once per session and cached in memory. The server
 * generates it at most once per week, so re-fetches are cheap DB reads. Only
 * `seenWeek` is persisted — enough to know whether the bell should show a dot.
 */
export const useRecapStore = create<RecapState>()(
  persist(
    (set, get) => ({
      recap: null,
      locked: false,
      loading: false,
      error: false,
      fetchedForToken: null,
      seenWeek: null,

      fetch: async (token, force = false) => {
        if (!force && (get().loading || get().fetchedForToken === token)) return;
        set({ loading: true, error: false });
        try {
          const { locked, recap } = await getWeeklyRecap(token);
          set({ recap, locked, loading: false, fetchedForToken: token });
        } catch {
          set({ loading: false, error: true });
        }
      },

      markSeen: () => {
        const wk = get().recap?.week_start;
        if (wk) set({ seenWeek: wk });
      },

      hasUnread: () => {
        const { recap, seenWeek } = get();
        return !!recap && recap.week_start !== seenWeek;
      },
    }),
    {
      name: 'calsnap-recap',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ seenWeek: s.seenWeek }),
    },
  ),
);
