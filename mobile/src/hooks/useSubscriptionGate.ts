import { useCallback, useState } from 'react';
import { useAuthStore } from '../store/authStore';

const FREE_DAILY_LIMIT = 3;

export interface ScanGateResult {
  canScan: boolean;
  scansUsedToday: number;
  scansRemaining: number;
  isSubscribed: boolean;
  showPaywall: () => void;
  paywallVisible: boolean;
  dismissPaywall: () => void;
  /**
   * Call this after a successful scan to optimistically update local state.
   * The authoritative count is always re-fetched from the server on next profile load.
   */
  consumeScan: () => void;
}

/**
 * useSubscriptionGate
 *
 * Checks whether the current user is allowed to perform a food scan.
 * - Subscribed users: always allowed
 * - Free users: allowed if daily_scan_count < FREE_DAILY_LIMIT (3)
 *
 * The server enforces the same limits — this hook is for UI-layer gating only
 * (preventing the camera from opening, showing the paywall proactively).
 */
export function useSubscriptionGate(): ScanGateResult {
  const { profile } = useAuthStore();
  const [paywallVisible, setPaywallVisible] = useState(false);

  const now = new Date();

  const isPaidSubscriber =
    (profile?.is_subscribed ?? false) &&
    (!profile?.subscription_end_date || new Date(profile.subscription_end_date) > now);

  const isOnTrial =
    !isPaidSubscriber &&
    !!profile?.trial_end_date &&
    new Date(profile.trial_end_date) > now;

  const isSubscribed = isPaidSubscriber || isOnTrial;

  // Reset daily count if it's a new day (client-side estimate — server is authoritative)
  const resetDate = profile?.daily_scan_reset_at
    ? new Date(profile.daily_scan_reset_at)
    : new Date(0);
  const isNewDay = resetDate.toDateString() !== new Date().toDateString();
  const scansUsedToday = isNewDay ? 0 : (profile?.daily_scan_count ?? 0);
  const scansRemaining = isSubscribed
    ? Infinity
    : Math.max(0, FREE_DAILY_LIMIT - scansUsedToday);

  const canScan = isSubscribed || scansUsedToday < FREE_DAILY_LIMIT;

  const showPaywall = useCallback(() => setPaywallVisible(true), []);
  const dismissPaywall = useCallback(() => setPaywallVisible(false), []);

  const consumeScan = useCallback(() => {
    // Optimistically update local profile state without a full refetch
    const store = useAuthStore.getState();
    if (store.profile) {
      store.setProfile({
        ...store.profile,
        daily_scan_count: scansUsedToday + 1,
        scan_count: (store.profile.scan_count ?? 0) + 1,
        daily_scan_reset_at: new Date().toISOString().split('T')[0],
      });
    }
  }, [scansUsedToday]);

  return {
    canScan,
    scansUsedToday,
    scansRemaining,
    isSubscribed,
    showPaywall,
    paywallVisible,
    dismissPaywall,
    consumeScan,
  };
}
