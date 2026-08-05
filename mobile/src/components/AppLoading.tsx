import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Text } from 'react-native-paper';
import { T } from '../theme';

/**
 * Shown while the session, cached profile and first profile fetch settle.
 *
 * Without this the app rendered Main the moment the session was known — but
 * `profile` was still null, so every Pro gate briefly drew its locked state and
 * a paying subscriber saw the upsell flash before it corrected itself.
 *
 * Styled to match the splash screen so the handoff reads as one continuous
 * launch rather than two separate screens.
 */
export function AppLoading() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  return (
    <View style={styles.root}>
      <Animated.View style={{ opacity: pulse }}>
        <Text style={styles.brand}>
          CAL<Text style={styles.brandSnap}>SNAP</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 28, fontWeight: '800', letterSpacing: 3, color: T.textPrimary },
  brandSnap: { color: T.primary },
});
