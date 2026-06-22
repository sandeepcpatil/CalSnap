import { useThemeStore, type ThemeMode } from '../store/themeStore';
import { Colors, type ColorTheme, type ColorMode } from '../theme/colors';

export interface UseThemeReturn {
  /** The fully resolved ColorTheme object — use this for all style values */
  theme: ColorTheme;
  /** Resolved active mode: 'light' or 'dark' */
  mode: ColorMode;
  /** The user-selected preference: 'light' or 'dark' */
  preference: ThemeMode;
  /** Convenience flag */
  isDark: boolean;
  /** Toggle between light ↔ dark */
  toggleTheme: () => void;
  /** Explicitly set 'light' or 'dark' */
  setTheme: (mode: ThemeMode) => void;
}

export function useTheme(): UseThemeReturn {
  const mode        = useThemeStore((s) => s.mode);
  const setTheme    = useThemeStore((s) => s.setTheme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const theme: ColorTheme = Colors[mode];

  return {
    theme,
    mode,
    preference: mode,
    isDark:     mode === 'dark',
    toggleTheme,
    setTheme,
  };
}
