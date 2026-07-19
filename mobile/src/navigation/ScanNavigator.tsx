import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScanScreen } from '../screens/Scan/ScanScreen';
import { ScanResultScreen } from '../screens/Scan/ScanResultScreen';
import { LabelResultScreen } from '../screens/Scan/LabelResultScreen';
import { FoodAnalysisResult, LabelScanData } from '../services/api';

export type ScanStackParamList = {
  ScanCamera: undefined;
  ScanResult: {
    imageUri: string;
    imageStorageUrl: string;
    result: FoodAnalysisResult;
  };
  LabelResult: {
    imageUri: string;
    imageStorageUrl: string;
    result: LabelScanData;
  };
};

const Stack = createNativeStackNavigator<ScanStackParamList>();

export function ScanNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ScanCamera" component={ScanScreen} />
      <Stack.Screen name="ScanResult" component={ScanResultScreen} />
      <Stack.Screen name="LabelResult" component={LabelResultScreen} />
    </Stack.Navigator>
  );
}
