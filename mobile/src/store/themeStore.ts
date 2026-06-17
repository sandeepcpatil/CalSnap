import { Appearance, type ColorSchemeName } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ColorMode } from '../theme/colors';

// --- Types -------------------------------------------------------------------

export type ThemeMode = 'light' | 'dark' | 'system';

// Only plain serialisable state here — NO getters, NO derived properties.
// Zustand's set() merges via Object.assign, which calls and flattens getters,
// turning them into frozen values after the first update. Computed values
// (activeMode, theme) are derived in useTheme() on every render instead.
interface ThemeState {
  mode: ThemeMode;
  systemScheme: ColorMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  _setSystemScheme: (scheme: ColorMode) => void;
}

// --- Helpers -----------------------------------------------------------------

function getSystemScheme(): ColorMode {
  const scheme: ColorSchemeName = Appearance.getColorScheme();
  return scheme === 'dark' ? 'dark' : 'light';
}

// --- Store --------------------------------------------------------------------

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system' as ThemeMode,
      systemScheme: getSystemScheme(),

      setTheme: (mode) => set({ mode }),

      toggleTheme: () => {
        const { mode, systemScheme } = get();
        const active: ColorMode = mode === 'system' ? systemScheme : mode;
        set({ mode: active === 'dark' ? 'light' : 'dark' });
      },

      _setSystemScheme: (scheme) => set({ systemScheme: scheme }),
    }),
    {
      name: 'calsnap-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ mode: state.mode }),
    },
  ),
);

// --- System theme change listener --------------------------------------------

Appearance.addChangeListener(({ colorScheme }) => {
  useThemeStore.getState()._setSystemScheme(
    colorScheme === 'dark' ? 'dark' : 'light',
  );
});
