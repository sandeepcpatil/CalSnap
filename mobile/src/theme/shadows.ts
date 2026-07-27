import type { ViewStyle } from 'react-native';

/**
 * Elevation scale. Dark UIs get depth from surface steps and hairlines, not
 * drop shadows — so `e0`/`e1` are the default and real shadows are rare.
 *
 * `glow` is deliberately scarce: the scan FAB and the paywall CTA only.
 * (Previously a primary glow appeared on 6 unrelated elements.)
 */
export const shadows = {
  /** Flat — the default for everything. */
  e0: {} as ViewStyle,

  /** Hairline border only — the standard card. Pair with `border` token. */
  e1: { borderWidth: 1 } as ViewStyle,

  /** Border + soft drop — sheets and modals that float above content. */
  e2: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  } as ViewStyle,

  /** Accent glow — scan FAB and paywall CTA ONLY. */
  glow: (color: string): ViewStyle => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  }),
} as const;
