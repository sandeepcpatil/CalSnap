import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { MainTabNavigator, type MainTabParamList } from './MainTabNavigator';
import { AuthScreen } from '../screens/Auth/AuthScreen';
import { OnboardingNavigator } from './OnboardingNavigator';
import { AppLoading } from '../components/AppLoading';
import { WaterScreen } from '../screens/Water/WaterScreen';
import { WeightScreen } from '../screens/Weight/WeightScreen';
import { CoachScreen } from '../screens/Coach/CoachScreen';
import { LogNavigator } from './LogNavigator';
import { ScanNavigator, type ScanMode } from './ScanNavigator';

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  /**
   * The camera lives here rather than in the tabs so it can be genuinely
   * full-screen — a tab bar over a viewfinder covers the shot and offers
   * destinations that make no sense mid-capture.
   */
  Scan: { mode: ScanMode };
  /** Full hydration screen — pushed over the tabs from the log hub or Home. */
  Water: undefined;
  /** Weight history, trend and goal — pushed from Profile. */
  Weight: undefined;
  /** AI nutrition coach (beta) — gated on profiles.chat_beta. */
  Coach: undefined;
  /** Re-log a past food, or build and log a saved meal. */
  LogFromHistory: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Hard ceiling on the wait for the *profile*. A slow or dead network must never
 * trap the user on a loading screen — after this we render with whatever we
 * have, which is the cached profile in the common offline case.
 *
 * Deliberately does NOT cover the session restore. See `ready` below.
 */
const PROFILE_TIMEOUT_MS = 2500;

/**
 * Safety ceiling on the session restore. Long enough that a slow token refresh
 * finishes first (which is the whole point — see `sessionKnown`), short enough
 * that a genuinely hung network doesn't strand the user on the splash forever.
 */
const SESSION_TIMEOUT_MS = 10_000;

export function RootNavigator() {
  const { session, profile, isLoading, hydrated, profileResolved } = useAuthStore();
  const [timedOut, setTimedOut] = useState(false);
  const [sessionTimedOut, setSessionTimedOut] = useState(false);

  useEffect(() => {
    const profileTimer = setTimeout(() => setTimedOut(true), PROFILE_TIMEOUT_MS);
    const sessionTimer = setTimeout(() => setSessionTimedOut(true), SESSION_TIMEOUT_MS);
    return () => {
      clearTimeout(profileTimer);
      clearTimeout(sessionTimer);
    };
  }, []);

  const isAuthenticated = !!session;

  // Two separate gates, and the difference matters.
  //
  // The session gate has NO timeout. `supabase.auth.getSession()` hits the
  // network whenever the stored JWT needs refreshing, and on a slow connection
  // that takes longer than the profile timeout — so a shared timeout would
  // decide "not authenticated" while the session was still loading and flash
  // the Google sign-in screen at an already-signed-in user before correcting
  // itself. Restoring a session is cheap and always terminates; wait for it.
  const sessionKnown = (!isLoading && hydrated) || sessionTimedOut;

  // The profile gate does time out: it is a network read, and rendering Main
  // before the subscription state is known makes every Pro gate flash its
  // locked state at paying subscribers. Falling back to the disk-cached
  // profile is the right call once the wait gets long.
  const profileKnown = !isAuthenticated || profileResolved || !!profile || timedOut;

  if (!sessionKnown || !profileKnown) return <AppLoading />;

  const needsOnboarding = isAuthenticated && profile && !profile.onboarding_complete;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : needsOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          {/* Logging destinations that are not tabs. They sit above the tab bar
              so the hub sheet can send you somewhere without the bar following
              you there. */}
          <Stack.Screen
            name="Scan"
            component={ScanNavigator}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="Water" component={WaterScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Weight" component={WeightScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Coach" component={CoachScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="LogFromHistory"
            component={LogNavigator}
            options={{ animation: 'slide_from_right' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
