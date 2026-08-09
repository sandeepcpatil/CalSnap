/** @type {import('tailwindcss').Config} */

// "CalSnap Ink" — mirrored from mobile/src/theme/tokens.ts so the website and
// the app are visibly the same product. Keep these in sync if the app's
// palette changes.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          bg: '#0C1112',        // page
          surface: '#151B1C',   // cards
          surface2: '#1C2324',  // inputs, chips
          offset: '#232B2C',    // pressed / offset sections
        },
        brand: {
          DEFAULT: '#85D3DA',   // CTAs, active states
          deep: '#01696F',      // icon wells, gradient end
          on: '#00363A',        // text on primary
          from: '#A9EDF3',      // hero gradient start
          to: '#38B6C2',        // hero gradient end
        },
        content: {
          primary: '#EDF2F2',
          secondary: '#AAB6B7',
          muted: '#7E8A8C',
        },
        macro: {
          protein: '#B9A3EC',
          carbs: '#EFBE7A',
          fat: '#F2938C',
          fiber: '#86DCA8',
        },
        state: {
          success: '#7ADCA6',
          warning: '#F2C170',
          error: '#FF9E94',
        },
        // Kept: the existing admin pages still reference `teal`.
        teal: { DEFAULT: '#01696f', light: '#4a9ca0', dark: '#004c50' },
      },
      borderColor: {
        hairline: 'rgba(255,255,255,0.08)',
      },
      backgroundImage: {
        'brand-grad': 'linear-gradient(135deg, #A9EDF3 0%, #38B6C2 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};
