import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme, type Theme as NavTheme } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/services/supabase';
import { useAuthStore } from './src/store/authStore';
import { useNotificationStore } from './src/store/notificationStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useTheme } from './src/hooks/useTheme';
import { configurePurchases, identifyUser } from './src/services/purchases';
import { ToastHost } from './src/components/ToastHost';
import { T } from './src/theme';
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

  // Every MD3 role a Paper control can reach for is mapped, otherwise
  // SegmentedButtons, TextInput labels and contained-button text fall back to
  // Material's default purples and greys.
  const paperTheme = {
    ...(isDark ? MD3DarkTheme : MD3LightTheme),
    colors: {
      ...(isDark ? MD3DarkTheme.colors : MD3LightTheme.colors),
      primary:              theme.primary,
      onPrimary:            T.textOnPrimary,
      primaryContainer:     theme.primaryTint,
      onPrimaryContainer:   T.textPrimary,
      secondary:            theme.primary,
      onSecondary:          T.textOnPrimary,
      secondaryContainer:   T.primaryTint,
      onSecondaryContainer: T.textPrimary,
      background:           theme.bg,
      onBackground:         T.textPrimary,
      surface:              theme.surface,
      onSurface:            T.textPrimary,
      surfaceVariant:       T.surface2,
      onSurfaceVariant:     T.textSecondary,
      surfaceDisabled:      T.surface2,
      onSurfaceDisabled:    T.textMuted,
      outline:              T.textMuted,
      outlineVariant:       T.border,
      error:                T.error,
      onError:              T.textOnPrimary,
      errorContainer:       T.errorTint,
      onErrorContainer:     T.error,
      inverseSurface:       T.textPrimary,
      inverseOnSurface:     T.bg,
      inversePrimary:       T.primaryDeep,
      elevation: {
        level0: 'transparent',
        level1: T.surface,
        level2: T.surface2,
        level3: T.surface2,
        level4: T.surfaceOffset,
        level5: T.surfaceOffset,
      },
    },
  };

  useEffect(() => {
    // Configure RevenueCat once; identity is attached when a session exists.
    configurePurchases();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        identifyUser(session.user.id);
        fetchProfile();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        identifyUser(session.user.id);
        fetchProfile();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Re-arm reminders whenever the app comes to the foreground: this rolls the
  // runway forward, fixes the day boundary, and reflects logs made elsewhere.
  useEffect(() => {
    const sync = () => { void useNotificationStore.getState().syncReminders(); };
    sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
  }, []);

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
        <StatusBar style={theme.statusBar} />
      </NavigationContainer>
      <ToastHost />
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
