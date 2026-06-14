import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

const TEAL = '#01696f';
const TEAL_LIGHT = '#4a9ca0';
const TEAL_DARK = '#004c50';

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: TEAL,
    primaryContainer: '#b2ebf2',
    secondary: TEAL_LIGHT,
    secondaryContainer: '#e0f7fa',
    background: '#f8fffe',
    surface: '#ffffff',
    error: '#b00020',
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: TEAL_LIGHT,
    primaryContainer: TEAL_DARK,
    background: '#0a1a1b',
    surface: '#1a2a2b',
  },
};
