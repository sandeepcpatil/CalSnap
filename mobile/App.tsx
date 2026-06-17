import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme, type Theme as NavTheme } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/services/supabase';
import { useAuthStore } from './src/store/authStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useTheme } from './src/hooks/useTheme';
import './src/store/themeStore';

function AppContent() {
  const { setSession, fetchProfile } = useAuthStore();
  const { theme, isDark } = useTheme();

  // ── React Navigation theme ────────────────────────────────────────────────
  const navTheme: NavTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary:    theme.primary,
      background: theme.navBackground,
      card:       theme.navCard,
      text:       theme.navText,
      border:     theme.navBorder,
      notification: theme.primary,
    },
  };

  const paperTheme = {
    ...(isDark ? MD3DarkTheme : MD3LightTheme),
    colors: {
      ...(isDark ? MD3DarkTheme.colors : MD3LightTheme.colors),
      primary:          theme.primary,
      primaryContainer: theme.primaryTint,
      background:       theme.bg,
      surface:          theme.surface,
    },
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
        <StatusBar style={theme.statusBar} />
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
