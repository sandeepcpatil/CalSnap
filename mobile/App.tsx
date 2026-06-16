import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { MD3LightTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/services/supabase';
import { useAuthStore } from './src/store/authStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';

/** Inner component so it can consume ThemeContext for PaperProvider. */
function AppContent() {
  const { setSession, fetchProfile } = useAuthStore();
  const { theme } = useAppTheme();

  const paperTheme = {
    ...MD3LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      primary: theme.paper.primary,
      primaryContainer: theme.paper.primaryContainer,
      background: theme.paper.background,
      surface: theme.paper.surface,
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
      <NavigationContainer>
        <RootNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
