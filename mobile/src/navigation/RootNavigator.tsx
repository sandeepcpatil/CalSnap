import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { MainTabNavigator } from './MainTabNavigator';
import { AuthScreen } from '../screens/Auth/AuthScreen';
import { OnboardingNavigator } from './OnboardingNavigator';

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, profile, isLoading } = useAuthStore();

  // Still restoring session
  if (isLoading) return null;

  const isAuthenticated = !!session;
  const needsOnboarding = isAuthenticated && profile && !profile.onboarding_complete;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : needsOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      )}
    </Stack.Navigator>
  );
}
