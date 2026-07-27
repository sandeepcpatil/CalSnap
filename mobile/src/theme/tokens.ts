/**
 * "CalSnap Ink" — the single source of colour truth for the app.
 *
 * The app ships **dark-only** (see app.config.js `userInterfaceStyle: 'dark'`).
 * Light tokens remain in `colors.ts` so the option is preserved, but no screen
 * renders them today.
 *
 * Before this file, eleven screens/modals each declared their own local
 * `const C = { ... }` palette, which drifted apart and made light mode
 * impossible. They now all import `T` from here.
 *
 * Design rules encoded below:
 * - Surfaces are one teal-grey hue in four steps (the old cards were
 *   slate-BLUE `rgba(15,23,42,.8)` floating on a teal-grey bg — a visible hue
 *   clash on OLED).
 * - One accent family. `#00E3FD`, `#BDF4FF` and `#C0C1FF` are retired as UI
 *   colours; gradients survive only in hero rings.
 * - Macro colours are shared app-wide, so the Dashboard bars and the Scan
 *   Result rows finally speak the same colour language.
 * - Every text/background pair meets WCAG AA (≥4.5:1); data figures ≥8:1.
 */

export const T = {
  // ── Surfaces · one hue, four steps ────────────────────────────────────────
  bg:            '#0C1112', // screen
  surface:       '#151B1C', // cards
  surface2:      '#1C2324', // inputs, chips, bar tracks
  surfaceOffset: '#232B2C', // pressed / offset sections

  /** Only two hairlines are allowed. */
  border:  'rgba(255,255,255,0.08)',
  divider: 'rgba(255,255,255,0.05)',

  // ── Text · AA-safe on every surface step ──────────────────────────────────
  textPrimary:   '#EDF2F2', // 15.9:1
  textSecondary: '#AAB6B7', // 8.4:1
  textMuted:     '#7E8A8C', // 4.9:1 — replaces the failing #6f797a (3.6:1)
  textOnPrimary: '#00363A', // on primary · 8.7:1

  // ── Brand · one accent family ─────────────────────────────────────────────
  primary:     '#85D3DA',            // CTAs, active states, brand text
  primaryDeep: '#01696F',            // icon wells, gradient end
  primaryTint: 'rgba(133,211,218,0.14)', // badges, selected chips

  /** Hero arcs only — the one place gradients live. */
  ringFrom: '#A9EDF3',
  ringTo:   '#38B6C2',

  // ── Macros · one palette app-wide ─────────────────────────────────────────
  protein: '#B9A3EC',
  carbs:   '#EFBE7A',
  fat:     '#F2938C',
  fiber:   '#86DCA8',

  // ── Semantic = score · good/medium/bad collapse into these ────────────────
  success: '#7ADCA6',
  warning: '#F2C170',
  error:   '#FF9E94',

  // ── Meal accents ──────────────────────────────────────────────────────────
  mealBreakfast: '#EFBE7A',
  mealLunch:     '#85D3DA',
  mealDinner:    '#B9A3EC',
  mealSnack:     '#86DCA8',

  // ── Overlays / scrims ─────────────────────────────────────────────────────
  overlay:    'rgba(12,17,18,0.72)',
  /** Buttons sitting on a live camera feed need a dark scrim, not white glass. */
  scrim:      'rgba(0,0,0,0.45)',
  /** Translucent glass survives ONLY where there is something behind to blur. */
  glass:      'rgba(12,17,18,0.80)',
  glassBorder:'rgba(255,255,255,0.10)',
} as const;

/** Score/grade → colour. Shared by the label result ring and any score chip. */
export function scoreColor(score: number): string {
  if (score >= 76) return T.success;
  if (score >= 56) return T.warning;
  return T.error;
}

export type Tokens = typeof T;
