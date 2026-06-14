import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeStep } from '../screens/Onboarding/WelcomeStep';
import { BodyStatsStep } from '../screens/Onboarding/BodyStatsStep';
import { ActivityStep } from '../screens/Onboarding/ActivityStep';
import { GoalStep } from '../screens/Onboarding/GoalStep';
import { SummaryStep } from '../screens/Onboarding/SummaryStep';

export type OnboardingStackParamList = {
  Welcome: undefined;
  BodyStats: undefined;
  Activity: undefined;
  Goal: undefined;
  Summary: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Welcome" component={WelcomeStep} />
      <Stack.Screen name="BodyStats" component={BodyStatsStep} />
      <Stack.Screen name="Activity" component={ActivityStep} />
      <Stack.Screen name="Goal" component={GoalStep} />
      <Stack.Screen name="Summary" component={SummaryStep} />
    </Stack.Navigator>
  );
}
