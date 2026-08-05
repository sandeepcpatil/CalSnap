import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScanScreen } from '../screens/Scan/ScanScreen';
import { ScanResultScreen } from '../screens/Scan/ScanResultScreen';
import { LabelResultScreen } from '../screens/Scan/LabelResultScreen';
import { FoodAnalysisResult, LabelScanData } from '../services/api';

/** Which capture mode the scan screen opens in. */
export type ScanMode = 'meal' | 'label' | 'voice';

export type ScanStackParamList = {
  /**
   * `mode` is always passed by the log hub, so the screen never has to guess
   * whether the user asked for the camera or the microphone.
   */
  ScanCamera: { mode?: ScanMode } | undefined;
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

interface Props {
  /** Supplied by the root stack, which is where the log hub sends the mode. */
  route: { params?: { mode?: ScanMode } };
}

export function ScanNavigator({ route }: Props) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="ScanCamera"
        component={ScanScreen}
        initialParams={{ mode: route.params?.mode ?? 'meal' }}
      />
      <Stack.Screen name="ScanResult" component={ScanResultScreen} />
      <Stack.Screen name="LabelResult" component={LabelResultScreen} />
    </Stack.Navigator>
  );
}
