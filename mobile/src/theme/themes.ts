// ─── CalSnap App Themes ──────────────────────────────────────────────────────
// Add new themes here and they automatically appear in Profile → Theme Switcher.

export type ThemeId = 'ocean' | 'sunset';

export interface AppTheme {
  id: ThemeId;
  name: string;
  emoji: string;

  // ─── Core backgrounds ───────────────────────────────────────────────────
  background: string;         // page/screen background
  surface: string;            // card / elevated surface
  surfaceTrack: string;       // progress-bar tracks, inactive chips
  cardBorder: string;         // subtle card border
  outlineVariant: string;     // dividers, input borders

  // ─── Text ───────────────────────────────────────────────────────────────
  onSurface: string;          // primary body text
  onSurfaceVariant: string;   // secondary / muted text

  // ─── Brand ──────────────────────────────────────────────────────────────
  primary: string;            // CTA buttons, key numbers, active states
  primaryMedium: string;      // tonal container (softer primary)
  primaryLight: string;       // avatar border, ring gradient start
  primaryUltraLight: string;  // avatar placeholder background

  // ─── Macros ─────────────────────────────────────────────────────────────
  protein: string;            // progress bar fill
  proteinText: string;        // pill text (may be darker)
  carbs: string;              // progress bar fill
  carbsText: string;          // pill text
  fat: string;                // progress bar fill
  fatText: string;            // pill text

  // ─── Meal section accents ───────────────────────────────────────────────
  meal: {
    breakfast: string;
    lunch: string;
    dinner: string;
    snack: string;
  };

  // ─── Calorie ring ───────────────────────────────────────────────────────
  ring: {
    gradFrom: string;
    gradTo: string;
    track: string;
    badgeBg: string;
    badgeText: string;
  };

  // ─── Auth / Login screen ────────────────────────────────────────────────
  auth: {
    heroType: 'gradient' | 'image';
    heroGradient: string[];         // used when heroType = 'gradient'
    overlayGradient: string[];      // used when heroType = 'image'
    rootBg: string;                 // fallback bg before hero loads
    logoBg: string;
    logoBorder: string;
    taglineColor: string;
    subtitleColor: string;
    glassBg: string;
    glassBorder: string;
    ctaButton: string;
    ctaButtonShadow: string;
    termsLinkColor: string;
    chipBgs: [string, string, string]; // AI, Macros, Streak
    chipBorder: string;
  };

  // ─── Paper component library colors ─────────────────────────────────────
  paper: {
    primary: string;
    primaryContainer: string;
    background: string;
    surface: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ocean theme (original teal / blue-green)
// ─────────────────────────────────────────────────────────────────────────────
const ocean: AppTheme = {
  id: 'ocean',
  name: 'Ocean',
  emoji: '🌊',

  background: '#f7fafa',
  surface: '#ffffff',
  surfaceTrack: '#ebeeee',
  cardBorder: '#e0e5e5',
  outlineVariant: '#bec8c9',

  onSurface: '#181c1d',
  onSurfaceVariant: '#3f4949',

  primary: '#004f54',
  primaryMedium: '#01696f',
  primaryLight: '#85d3da',
  primaryUltraLight: '#e0f7f7',

  protein: '#904d00',
  proteinText: '#904d00',
  carbs: '#4ae183',
  carbsText: '#005228',
  fat: '#004f54',
  fatText: '#004f54',

  meal: {
    breakfast: '#904d00',
    lunch: '#4ae183',
    dinner: '#004f54',
    snack: '#fd8b00',
  },

  ring: {
    gradFrom: '#85d3da',
    gradTo: '#004f54',
    track: '#e6e9e9',
    badgeBg: 'rgba(253,139,0,0.1)',
    badgeText: '#904d00',
  },

  auth: {
    heroType: 'gradient',
    heroGradient: ['#004f54', '#01696f', '#97e6ec', '#f7fafa'],
    overlayGradient: [],
    rootBg: '#004f54',
    logoBg: 'rgba(255,255,255,0.15)',
    logoBorder: 'rgba(255,255,255,0.3)',
    taglineColor: '#ffffff',
    subtitleColor: 'rgba(255,255,255,0.75)',
    glassBg: 'rgba(255,255,255,0.72)',
    glassBorder: 'rgba(255,255,255,0.5)',
    ctaButton: '#004f54',
    ctaButtonShadow: '#004f54',
    termsLinkColor: '#004f54',
    chipBgs: [
      'rgba(1,105,111,0.15)',
      'rgba(253,139,0,0.15)',
      'rgba(186,26,26,0.15)',
    ],
    chipBorder: 'rgba(255,255,255,0.3)',
  },

  paper: {
    primary: '#01696f',
    primaryContainer: '#b2ebf2',
    background: '#f7fafa',
    surface: '#ffffff',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sunset theme (warm orange / burnt sienna)
// ─────────────────────────────────────────────────────────────────────────────
const sunset: AppTheme = {
  id: 'sunset',
  name: 'Sunset',
  emoji: '🌅',

  background: '#f9f9f7',
  surface: '#ffffff',
  surfaceTrack: '#eeeeec',
  cardBorder: '#e1bfb5',
  outlineVariant: '#e1bfb5',

  onSurface: '#1a1c1b',
  onSurfaceVariant: '#594139',

  primary: '#ab3500',
  primaryMedium: '#ff6b35',
  primaryLight: '#ffb59d',
  primaryUltraLight: '#ffdbd0',

  protein: '#775372',
  proteinText: '#775372',
  carbs: '#c49100',
  carbsText: '#7a5900',
  fat: '#ab3500',
  fatText: '#ab3500',

  meal: {
    breakfast: '#775372',
    lunch: '#c49100',
    dinner: '#ab3500',
    snack: '#fcbc0c',
  },

  ring: {
    gradFrom: '#ffb59d',
    gradTo: '#ab3500',
    track: '#eeeeec',
    badgeBg: 'rgba(171,53,0,0.1)',
    badgeText: '#ab3500',
  },

  auth: {
    heroType: 'image',
    heroGradient: [],
    overlayGradient: [
      'rgba(249,249,247,0)',
      'rgba(249,249,247,0.55)',
      'rgba(249,249,247,1)',
    ],
    rootBg: '#f9f9f7',
    logoBg: 'rgba(171,53,0,0.12)',
    logoBorder: 'rgba(255,107,53,0.35)',
    taglineColor: '#1a1c1b',
    subtitleColor: '#594139',
    glassBg: 'rgba(255,255,255,0.82)',
    glassBorder: 'rgba(255,107,53,0.15)',
    ctaButton: '#ff6b35',
    ctaButtonShadow: '#ab3500',
    termsLinkColor: '#ab3500',
    chipBgs: [
      'rgba(171,53,0,0.1)',
      'rgba(196,145,0,0.1)',
      'rgba(119,83,114,0.1)',
    ],
    chipBorder: 'rgba(171,53,0,0.12)',
  },

  paper: {
    primary: '#ab3500',
    primaryContainer: '#ffdbd0',
    background: '#f9f9f7',
    surface: '#ffffff',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
export const THEMES: Record<ThemeId, AppTheme> = { ocean, sunset };
export const THEME_LIST: AppTheme[] = Object.values(THEMES);
