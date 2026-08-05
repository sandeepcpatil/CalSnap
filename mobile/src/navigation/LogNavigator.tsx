import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FromHistoryScreen } from '../screens/Log/FromHistoryScreen';
import { CreateMealScreen } from '../screens/Log/CreateMealScreen';
import type { SavedMeal } from '../services/savedMeals';

export type LogStackParamList = {
  FindFood: undefined;
  /** Omit `meal` to build a new one; pass it to edit an existing one. */
  CreateMeal: { meal?: SavedMeal } | undefined;
};

const Stack = createNativeStackNavigator<LogStackParamList>();

/**
 * The no-camera logging flow: pick a past food or a saved meal, and build new
 * saved meals. Kept as its own stack so the meal builder can be pushed on top
 * of the picker without the tab bar coming with it.
 */
export function LogNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FindFood" component={FromHistoryScreen} />
      <Stack.Screen name="CreateMeal" component={CreateMealScreen} />
    </Stack.Navigator>
  );
}
