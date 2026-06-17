import { useThemeStore, type ThemeMode } from '../store/themeStore';
import { Colors, type ColorTheme, type ColorMode } from '../theme/colors';

export interface UseThemeReturn {
  /** The fully resolved ColorTheme object — use this for all style values */
  theme: ColorTheme;
  /** Resolved active mode: 'light' or 'dark' */
  mode: ColorMode;
  /** The user-selected preference including 'system' */
  preference: ThemeMode;
  /** Convenience flag */
  isDark: boolean;
  /** Toggle between light ↔ dark (locks out of system mode) */
  toggleTheme: () => void;
  /** Explicitly set 'light', 'dark', or 'system' */
  setTheme: (mode: ThemeMode) => void;
}

/**
 * Primary hook for accessing the current theme throughout the app.
 *
 * activeMode and theme are computed here — NOT in the store — so they are
 * always freshly derived from the current mode + systemScheme on every render.
 * Keeping them out of the Zustand store prevents them being frozen by
 * Object.assign during state updates.
 */
export function useTheme(): UseThemeReturn {
  const mode        = useThemeStore((s) => s.mode);
  const systemScheme= useThemeStore((s) => s.systemScheme);
  const setTheme    = useThemeStore((s) => s.setTheme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const activeMode: ColorMode = mode === 'system' ? systemScheme : mode;
  const theme: ColorTheme     = Colors[activeMode];

  return {
    theme,
    mode:       activeMode,
    preference: mode,
    isDark:     activeMode === 'dark',
    toggleTheme,
    setTheme,
  };
}
