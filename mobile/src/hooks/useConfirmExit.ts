import { useCallback, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/** How long the first back press stays "armed". */
const CONFIRM_WINDOW_MS = 2000;

/**
 * Require two back presses to leave the app.
 *
 * Android's hardware back closes the app from the root screen, which means one
 * stray press — often aimed at dismissing a keyboard — drops the user out
 * mid-session. Attach this to the home screen only; every other screen should
 * still navigate back normally.
 */
export function useConfirmExit(): void {
  const armedAt = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const onBack = () => {
        const now = Date.now();
        if (now - armedAt.current < CONFIRM_WINDOW_MS) {
          // Second press inside the window — let the default handler exit.
          return false;
        }
        armedAt.current = now;
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        return true;
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, []),
  );
}
