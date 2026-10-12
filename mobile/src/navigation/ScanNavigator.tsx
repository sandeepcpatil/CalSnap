import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScanScreen } from '../screens/Scan/ScanScreen';
import { ScanResultScreen } from '../screens/Scan/ScanResultScreen';
import { LabelResultScreen } from '../screens/Scan/LabelResultScreen';
import { FoodAnalysisResult, LabelScanData } from '../services/api';

/** Which capture mode the scan screen opens in. */
export type ScanMode = 'meal' | 'label' | 'voice' | 'barcode';

/**
 * Context for a result that came from the describe path. `transcript` is the
 * user's own typed text, or what the API reports it heard; it is never made up.
 * When there is no transcript the result screen shows the recorded length.
 */
export interface VoiceContext {
  source: 'spoken' | 'typed';
  transcript?: string;
  durationMs?: number;
}

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
    voice?: VoiceContext;
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
      {/* `initialParams` only applies the first time the route is created, so
          a later navigate('Scan', { mode }) onto an existing stack would keep
          the old mode. Passing the live value as a prop keeps the camera and
          the hub in agreement every time. */}
      <Stack.Screen name="ScanCamera">
        {(props) => <ScanScreen {...props} requestedMode={route.params?.mode ?? 'meal'} />}
      </Stack.Screen>
      <Stack.Screen name="ScanResult" component={ScanResultScreen} />
      <Stack.Screen name="LabelResult" component={LabelResultScreen} />
    </Stack.Navigator>
  );
}
