import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AppTheme, ThemeId, THEMES } from '../theme/themes';

interface ThemeContextValue {
  theme: AppTheme;
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES.sunset,
  themeId: 'sunset',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default to 'sunset' — change to 'ocean' to flip the default
  const [themeId, setThemeId] = useState<ThemeId>('sunset');

  return (
    <ThemeContext.Provider
      value={{ theme: THEMES[themeId], themeId, setTheme: setThemeId }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/** Use this hook in any screen or component to access the current theme. */
export function useAppTheme() {
  return useContext(ThemeContext);
}
