import { create } from 'zustand';
import type { ScanMode } from '../navigation/ScanNavigator';

/**
 * A launcher shortcut or external link that wants to open a root-stack screen.
 *
 * Only two destinations are reachable from outside the app, and both sit on the
 * root stack behind the signed-in, onboarded gate. The link is parked here
 * until `MainTabNavigator` mounts (which is exactly when that gate is open) and
 * consumed there — so a tap on the cold-start splash, a signed-out user or a
 * half-finished onboarding never navigates anywhere.
 */
export type PendingDeepLink =
  | { name: 'Scan'; params: { mode: ScanMode } }
  | { name: 'Water' };

const SCAN_MODES: readonly ScanMode[] = ['meal', 'label', 'barcode', 'voice'];

/**
 * `calvue://scan?mode=meal|label|barcode|voice` → Scan (mode defaults to meal)
 * `calvue://water`                               → Water
 * Anything else — including an unknown mode — is rejected rather than coerced.
 */
export function parseDeepLink(url: string): PendingDeepLink | null {
  const match = /^calvue:\/\/([a-z]+)\/?(?:\?([^#]*))?(?:#.*)?$/i.exec(url.trim());
  if (!match) return null;
  const path = match[1].toLowerCase();
  const query = new Map<string, string>();
  for (const pair of (match[2] ?? '').split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    try {
      const key = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq));
      const value = decodeURIComponent(eq === -1 ? '' : pair.slice(eq + 1));
      query.set(key, value);
    } catch {
      return null;
    }
  }

  if (path === 'scan') {
    const mode = query.get('mode') ?? 'meal';
    if (!(SCAN_MODES as readonly string[]).includes(mode)) return null;
    return { name: 'Scan', params: { mode: mode as ScanMode } };
  }
  if (path === 'water') return { name: 'Water' };
  return null;
}

interface DeepLinkState {
  pending: PendingDeepLink | null;
  /** Parks a link; a newer one replaces an older unconsumed one. */
  setPending: (link: PendingDeepLink | null) => void;
  /** Hands the parked link to the navigator and clears it. */
  consume: () => PendingDeepLink | null;
}

export const useDeepLinkStore = create<DeepLinkState>((set, get) => ({
  pending: null,
  setPending: (link) => set({ pending: link }),
  consume: () => {
    const link = get().pending;
    if (link) set({ pending: null });
    return link;
  },
}));

/** Parse a URL and park it if it names a destination we open from outside. */
export function receiveDeepLink(url: string | null | undefined) {
  if (!url) return;
  const link = parseDeepLink(url);
  if (link) useDeepLinkStore.getState().setPending(link);
}
