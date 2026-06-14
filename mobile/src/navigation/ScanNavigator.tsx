import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScanScreen } from '../screens/Scan/ScanScreen';
import { ScanResultScreen } from '../screens/Scan/ScanResultScreen';
import { FoodAnalysisResult } from '../services/api';

export type ScanStackParamList = {
  ScanCamera: undefined;
  ScanResult: {
    imageUri: string;
    imageStorageUrl: string;
    result: FoodAnalysisResult;
  };
};

const Stack = createNativeStackNavigator<ScanStackParamList>();

export function ScanNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ScanCamera" component={ScanScreen} />
      <Stack.Screen name="ScanResult" component={ScanResultScreen} />
    </Stack.Navigator>
  );
}
