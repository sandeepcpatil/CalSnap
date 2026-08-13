import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AlertsSeenState {
  /** Signature of the alert set the user has already opened the sheet on. */
  seenSig: string;
  /** Record that the user has viewed the current set of alerts. */
  markSeen: (sig: string) => void;
  /** True when there's a fresh alert set the user hasn't opened yet. */
  hasUnread: (sig: string) => boolean;
}

/**
 * Tracks whether the smart-alerts sheet has been *seen* for its current set.
 * Smart alerts are derived live from the day's data, so without this the bell
 * badge would never clear — it would keep counting conditions that are still
 * true. Persisting only the last-seen signature is enough to drive the dot.
 */
export const useAlertsSeenStore = create<AlertsSeenState>()(
  persist(
    (set, get) => ({
      seenSig: '',
      markSeen: (sig) => set({ seenSig: sig }),
      hasUnread: (sig) => sig !== '' && sig !== get().seenSig,
    }),
    {
      name: 'calsnap-alerts-seen',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ seenSig: s.seenSig }),
    },
  ),
);
