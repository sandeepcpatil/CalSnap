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

const dark: ColorTheme = {
  // Backgrounds — Stitch inverse-surface family
  bg:            '#0d1718',  // very dark teal-grey
  surface:       '#191f20',  // dark card
  surface2:      '#252c2d',  // dark chip / input bg
  surfaceOffset: '#2d3435',  // subtle offset

  // Text — Stitch inverse-on-surface → lighter for dark
  textPrimary:   '#eef1f1',  // inverse-on-surface
  textSecondary: '#a0b4b5',  // muted on dark
  textMuted:     '#6f797a',  // outline
  textInverse:   '#002022',  // on-primary-fixed

  // Brand — Stitch inverse-primary (bright teal for dark bg)
  primary:     '#85d3da',   // inverse-primary
  primaryLight:'#a1f0f6',   // primary-fixed
  primaryDark: '#4da8b0',
  primaryTint: '#002022',   // on-primary-fixed (deep dark tint)

  // Semantic
  success:     '#4ae183',   // tertiary-fixed-dim
  successTint: '#00210c',
  warning:     '#ffb77d',   // secondary-fixed-dim
  warningTint: '#3a2800',
  error:       '#ffb4ab',   // on-error (lighter for dark surfaces)
  errorTint:   '#401414',
  info:        '#85d3da',
  infoTint:    '#002022',

  // Macros — lighter/more saturated for dark surfaces
  protein:     '#A888D0',   // lighter violet
  proteinTint: '#2A1F40',
  carbs:       '#ffb77d',   // secondary-fixed-dim (warm amber)
  carbsTint:   '#3A2800',
  fat:         '#F08080',   // soft coral
  fatTint:     '#3A1414',
  fiber:       '#4ae183',   // tertiary-fixed-dim
  fiberTint:   '#00210c',

  // Borders
  borderColor:  '#3f4949',  // on-surface-variant
  dividerColor: '#2d3131',  // inverse-surface

  // Interactive
  ripple:  'rgba(133,211,218,0.15)',
  overlay: 'rgba(0,0,0,0.70)',
  shadow:  'rgba(0,0,0,0.40)',

  // Tab bar
  tabBarBg:       '#191f20',
  tabBarActive:   '#85d3da',
  tabBarInactive: '#6f797a',
  tabBarBorder:   '#252c2d',

  // Card
  cardBg:     '#191f20',
  cardShadow: 'rgba(0,0,0,0.30)',

  // Scan UI
  scanOverlayColor: 'rgba(0,0,0,0.65)',
  scanBorderColor:  '#85d3da',
  scanSuccessColor: '#4ae183',

  statusBar: 'light',

  // Navigation
  navBackground: '#0d1718',
  navCard:       '#191f20',
  navText:       '#eef1f1',
  navBorder:     '#252c2d',

  ring: {
    gradFrom: '#a1f0f6',   // primary-fixed
    gradTo:   '#85d3da',   // inverse-primary
    track:    '#252c2d',
    badgeBg:  '#3a2800',
    badgeText:'#ffb77d',
  },

  meal: {
    breakfast: '#ffb77d',  // secondary-fixed-dim
    lunch:     '#85d3da',  // inverse-primary
    dinner:    '#4ae183',  // tertiary-fixed-dim
    snack:     '#ffdcc3',  // secondary-fixed
  },

  auth: {
    heroGradient: ['#002022', '#004f54', '#01696f', '#85d3da'],
    glassBg:     'rgba(25,31,32,0.90)',
    glassBorder: 'rgba(63,73,73,0.5)',
    chipBgs:     ['#002022', '#3A2800', '#00210c'],
    chipBorder:  'rgba(63,73,73,0.4)',
  },
};

export const Colors = { light, dark } as const;
export type ColorMode = 'light' | 'dark';
