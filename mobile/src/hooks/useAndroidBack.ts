import { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Handle the Android hardware back button for the focused screen.
 *
 * Needed because a screen that is the FIRST route of a nested native-stack has
 * nothing for its own navigator to pop, and the press does not reliably bubble
 * up to the parent stack — so it falls through to Android's default, which
 * closes the app. Handling it explicitly removes that ambiguity.
 *
 * `handler` returns true if it consumed the press, false to let the default
 * behaviour continue.
 */
export function useAndroidBack(handler: () => boolean): void {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', handler);
      return () => sub.remove();
    }, [handler]),
  );
}
