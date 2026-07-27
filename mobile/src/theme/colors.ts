// ─── CaloSnap Color System ───────────────────────────────────────────────────
// Dual light/dark theme with WCAG AA compliant contrast ratios.
// All values are plain hex — no opacity strings here.
// For semi-transparent overlays and shadows, use the dedicated opacity tokens
// further down this file.
//
// Primary brand color: teal #01696f (Stitch Calm primary-container) — clean, health-focused.
// Not the clinical default #00BCD4 teal; this reads warmer and more grounded.
// ─────────────────────────────────────────────────────────────────────────────

export interface ColorTheme {
  // ── Backgrounds ─────────────────────────────────────────────────────────
  /** Screen / page background — warm off-white or deep dark */
  bg: string;
  /** Elevated surface: cards, sheets, dialogs */
  surface: string;
  /** Secondary surface: input backgrounds, inline chips */
  surface2: string;
  /** Offset surface: subtle section separation inside a card */
  surfaceOffset: string;

  // ── Text ────────────────────────────────────────────────────────────────
  /** High-emphasis body text — must pass 4.5:1 on `bg` */
  textPrimary: string;
  /** Medium-emphasis text: subtitles, secondary labels */
  textSecondary: string;
  /** Low-emphasis text: placeholders, captions, disabled */
  textMuted: string;
  /** Text on top of a primary-colored button or badge */
  textInverse: string;

  // ── Brand ────────────────────────────────────────────────────────────────
  /** Primary CTA and active highlight color */
  primary: string;
  /** Tinted lighter variant — hover states, gradient starts */
  primaryLight: string;
  /** Deeper variant — pressed states, badge borders */
  primaryDark: string;
  /** Very light tint — primary-colored badge backgrounds */
  primaryTint: string;

  // ── Semantic ─────────────────────────────────────────────────────────────
  success: string;
  successTint: string;
  warning: string;
  warningTint: string;
  error: string;
  errorTint: string;
  info: string;
  infoTint: string;

  // ── Nutrition macro colors ────────────────────────────────────────────────
  // Must be visually distinct from each other AND the primary brand.
  // Each has a tint variant for badge/chip backgrounds.
  /** Protein — purple family */
  protein: string;
  proteinTint: string;
  /** Carbohydrates — amber/gold */
  carbs: string;
  carbsTint: string;
  /** Fat — coral red */
  fat: string;
  fatTint: string;
  /** Fiber — mid-green (distinct from primary teal) */
  fiber: string;
  fiberTint: string;

  // ── Borders & Dividers ───────────────────────────────────────────────────
  /** Standard border: inputs, cards */
  borderColor: string;
  /** Hairline separator between list items */
  dividerColor: string;

  // ── Interactive ───────────────────────────────────────────────────────────
  /** Press ripple / touch highlight color */
  ripple: string;
  /** Modal/drawer overlay tint */
  overlay: string;
  /** Box shadow color */
  shadow: string;

  // ── Tab Bar ───────────────────────────────────────────────────────────────
  tabBarBg: string;
  tabBarActive: string;
  tabBarInactive: string;
  tabBarBorder: string;

  // ── Card ──────────────────────────────────────────────────────────────────
  cardBg: string;
  cardShadow: string;

  // ── Scan UI ───────────────────────────────────────────────────────────────
  /** Semi-dark vignette behind the viewfinder cutout */
  scanOverlayColor: string;
  /** Viewfinder corner bracket color */
  scanBorderColor: string;
  /** Color when a food item is recognised successfully */
  scanSuccessColor: string;

  // ── Status bar ────────────────────────────────────────────────────────────
  /** 'light' or 'dark' — passed to expo-status-bar */
  statusBar: 'light' | 'dark';

  // ── Navigation (React Navigation theme extension) ─────────────────────────
  navBackground: string;
  navCard: string;
  navText: string;
  navBorder: string;

  // ── Calorie ring sub-tokens ───────────────────────────────────────────────
  ring: {
    gradFrom: string;
    gradTo: string;
    track: string;
    badgeBg: string;
    badgeText: string;
  };

  // ── Meal accent colors ────────────────────────────────────────────────────
  // Fixed per meal type — consistent across light/dark for recognition.
  meal: {
    breakfast: string;
    lunch: string;
    dinner: string;
    snack: string;
  };

  // ── Auth screen tokens ────────────────────────────────────────────────────
  auth: {
    heroGradient: readonly [string, string, string, string];
    glassBg: string;
    glassBorder: string;
    chipBgs: readonly [string, string, string];
    chipBorder: string;
  };
}

// ─── Light Theme ─────────────────────────────────────────────────────────────
// Aligned to Stitch "CalSnap Calm" design system.
// Primary: teal #01696f / deep #004f54. Secondary: amber #fd8b00. Tertiary: forest #006d37.
// Surface tokens match the Stitch surface-container scale exactly.

const light: ColorTheme = {
  // Backgrounds — Stitch surface scale
  bg:            '#f7fafa',  // surface / background
  surface:       '#ffffff',  // surface-container-lowest
  surface2:      '#ebeeee',  // surface-container
  surfaceOffset: '#e6e9e9',  // surface-container-high

  // Text — Stitch on-surface tokens
  textPrimary:   '#181c1d',  // on-surface
  textSecondary: '#3f4949',  // on-surface-variant
  textMuted:     '#6f797a',  // outline
  textInverse:   '#ffffff',  // on-primary

  // Brand — Stitch primary family
  primary:     '#01696f',   // primary-container (interactive teal)
  primaryLight:'#85d3da',   // inverse-primary
  primaryDark: '#004f54',   // primary (deep teal)
  primaryTint: '#a1f0f6',   // primary-fixed

  // Semantic — mapped to Stitch tertiary (green) & secondary (amber)
  success:     '#006d37',   // tertiary-container
  successTint: '#d4f5e7',
  warning:     '#904d00',   // secondary
  warningTint: '#ffdcc3',   // secondary-fixed
  error:       '#ba1a1a',   // error
  errorTint:   '#ffdad6',   // error-container
  info:        '#01696f',
  infoTint:    '#a1f0f6',

  // Macros — Stitch secondary amber + Stitch violet/coral/green
  protein:     '#7B5EA7',   // muted violet
  proteinTint: '#ede5f8',
  carbs:       '#904d00',   // secondary (Stitch amber)
  carbsTint:   '#ffdcc3',   // secondary-fixed
  fat:         '#C84040',   // coral
  fatTint:     '#ffe4e0',
  fiber:       '#005228',   // tertiary (Stitch forest green)
  fiberTint:   '#d4f5e2',

  // Borders — Stitch outline tokens
  borderColor:  '#bec8c9',  // outline-variant
  dividerColor: '#e0e3e3',  // surface-variant

  // Interactive
  ripple:  'rgba(1,105,111,0.12)',
  overlay: 'rgba(24,28,29,0.50)',
  shadow:  'rgba(24,28,29,0.10)',

  // Tab bar
  tabBarBg:       '#ffffff',
  tabBarActive:   '#01696f',
  tabBarInactive: '#6f797a',
  tabBarBorder:   '#e0e3e3',

  // Card
  cardBg:     '#ffffff',
  cardShadow: 'rgba(24,28,29,0.08)',

  // Scan UI
  scanOverlayColor:  'rgba(0,0,0,0.55)',
  scanBorderColor:   '#01696f',
  scanSuccessColor:  '#006d37',

  statusBar: 'dark',

  // Navigation
  navBackground: '#f7fafa',
  navCard:       '#ffffff',
  navText:       '#181c1d',
  navBorder:     '#e0e3e3',

  ring: {
    gradFrom: '#85d3da',   // inverse-primary (light teal)
    gradTo:   '#01696f',   // primary-container
    track:    '#ebeeee',   // surface-container
    badgeBg:  '#ffdcc3',   // secondary-fixed (amber)
    badgeText:'#904d00',   // secondary
  },

  meal: {
    breakfast: '#fd8b00',  // secondary-container (warm amber)
    lunch:     '#01696f',  // primary-container (teal)
    dinner:    '#006d37',  // tertiary-container (forest green)
    snack:     '#ffb77d',  // secondary-fixed-dim (soft amber)
  },

  auth: {
    heroGradient: ['#004f54', '#01696f', '#85d3da', '#a1f0f6'],
    glassBg:     'rgba(255,255,255,0.88)',
    glassBorder: 'rgba(190,200,201,0.6)',
    chipBgs:     ['#a1f0f6', '#ffdcc3', '#d4f5e2'],
    chipBorder:  'rgba(190,200,201,0.5)',
  },
};

// ─── Dark Theme ───────────────────────────────────────────────────────────────
// Dark variant of the Stitch Calm palette — inverse-surface as the base.
// Accent colors derived from Stitch inverse-primary / primary-fixed tokens.

// "CalSnap Ink" — kept in exact sync with theme/tokens.ts (`T`), which is what
// the screens import. One teal-grey surface hue, one accent family, shared
// macro colours, and every text pair at WCAG AA or better.
const dark: ColorTheme = {
  // Surfaces — one hue, four steps
  bg:            '#0C1112',
  surface:       '#151B1C',
  surface2:      '#1C2324',
  surfaceOffset: '#232B2C',

  // Text — AA-safe on every surface step
  textPrimary:   '#EDF2F2',  // 15.9:1
  textSecondary: '#AAB6B7',  // 8.4:1
  textMuted:     '#7E8A8C',  // 4.9:1 — was #6f797a (3.6:1, failed AA)
  textInverse:   '#00363A',

  // Brand — one accent family
  primary:     '#85D3DA',
  primaryLight:'#A9EDF3',
  primaryDark: '#01696F',
  primaryTint: 'rgba(133,211,218,0.14)',

  // Semantic (= score colours)
  success:     '#7ADCA6',
  successTint: 'rgba(122,220,166,0.14)',
  warning:     '#F2C170',
  warningTint: 'rgba(242,193,112,0.14)',
  error:       '#FF9E94',
  errorTint:   'rgba(255,158,148,0.14)',
  info:        '#85D3DA',
  infoTint:    'rgba(133,211,218,0.14)',

  // Macros — matched vibrance, shared app-wide
  protein:     '#B9A3EC',
  proteinTint: 'rgba(185,163,236,0.14)',
  carbs:       '#EFBE7A',
  carbsTint:   'rgba(239,190,122,0.14)',
  fat:         '#F2938C',
  fatTint:     'rgba(242,147,140,0.14)',
  fiber:       '#86DCA8',
  fiberTint:   'rgba(134,220,168,0.14)',

  // Borders — only two hairlines allowed
  borderColor:  'rgba(255,255,255,0.08)',
  dividerColor: 'rgba(255,255,255,0.05)',

  // Interactive
  ripple:  'rgba(133,211,218,0.15)',
  overlay: 'rgba(12,17,18,0.72)',
  shadow:  'rgba(0,0,0,0.35)',

  // Tab bar
  tabBarBg:       '#151B1C',
  tabBarActive:   '#85D3DA',
  tabBarInactive: '#7E8A8C',
  tabBarBorder:   'rgba(255,255,255,0.08)',

  // Card
  cardBg:     '#151B1C',
  cardShadow: 'rgba(0,0,0,0.35)',

  // Scan UI
  scanOverlayColor: 'rgba(12,17,18,0.65)',
  scanBorderColor:  '#85D3DA',
  scanSuccessColor: '#7ADCA6',

  statusBar: 'light',

  // Navigation
  navBackground: '#0C1112',
  navCard:       '#151B1C',
  navText:       '#EDF2F2',
  navBorder:     'rgba(255,255,255,0.08)',

  ring: {
    gradFrom: '#A9EDF3',
    gradTo:   '#38B6C2',
    track:    '#1C2324',
    badgeBg:  'rgba(242,193,112,0.14)',
    badgeText:'#F2C170',
  },

  meal: {
    breakfast: '#EFBE7A',
    lunch:     '#85D3DA',
    dinner:    '#B9A3EC',
    snack:     '#86DCA8',
  },

  auth: {
    heroGradient: ['#00363A', '#01696F', '#38B6C2', '#85D3DA'],
    glassBg:     'rgba(12,17,18,0.80)',
    glassBorder: 'rgba(255,255,255,0.10)',
    chipBgs:     ['rgba(133,211,218,0.14)', 'rgba(239,190,122,0.14)', 'rgba(134,220,168,0.14)'],
    chipBorder:  'rgba(255,255,255,0.08)',
  },
};

export const Colors = { light, dark } as const;
export type ColorMode = 'light' | 'dark';
