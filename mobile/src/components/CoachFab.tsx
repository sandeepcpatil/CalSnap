import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, Animated, Easing, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { T } from '../theme';

/** Ignore scroll jitter below this many px so the pill doesn't flicker. */
const SCROLL_THRESHOLD = 8;
/** Above this scroll offset we start hiding; below it the pill always shows. */
const TOP_ZONE = 40;

/**
 * Tracks scroll direction for a scroll-aware floating control.
 *
 * Spread `onScroll` (plus `scrollEventThrottle`) onto a ScrollView and pass
 * `hidden` to `CoachFab`. Kept as a hook rather than baked into the FAB because
 * the FAB is a sibling of the list, not a child — it has no other way to know.
 */
export function useHideOnScroll(): {
  hidden: boolean;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
} {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY.current;
    if (Math.abs(dy) < SCROLL_THRESHOLD) return;
    lastY.current = y;
    // Near the top there's nothing to get out of the way of.
    setHidden(y > TOP_ZONE && dy > 0);
  }, []);

  return { hidden, onScroll };
}

interface Props {
  /** Slide it away while the user scrolls down through content. */
  hidden?: boolean;
}

/**
 * Floating "Ask Coach" entry point.
 *
 * A PILL, not a circle, on purpose: the tab bar already has a raised circular
 * "+" button, and two floating circles would compete for the same "primary
 * action" role. A pill reads as a different class of control — and it labels
 * itself, which matters for a feature nobody has seen before.
 *
 * Fixed bottom-right. Dragging was tried and removed: the gesture handling made
 * the whole screen feel unstable, and auto-hiding on scroll already solves the
 * "it's covering something" problem without any of that cost.
 *
 * Renders nothing unless the user is in the chat beta.
 */
export function CoachFab({ hidden = false }: Props) {
  const chatBeta = useAuthStore((s) => s.profile?.chat_beta ?? false);
  const rootNav = useNavigation().getParent<NativeStackNavigationProp<RootStackParamList>>();
  const tabBarHeight = useBottomTabBarHeight();
  const anim = useRef(new Animated.Value(0)).current; // 0 = shown, 1 = tucked away

  useEffect(() => {
    Animated.timing(anim, {
      toValue: hidden ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [hidden, anim]);

  if (!chatBeta) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 90] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View
      style={[styles.wrap, { bottom: tabBarHeight + 14, transform: [{ translateY }], opacity }]}
      pointerEvents={hidden ? 'none' : 'auto'}
    >
      <TouchableOpacity
        style={styles.pill}
        onPress={() => rootNav?.navigate('Coach')}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Ask your nutrition coach"
      >
        <Ionicons name="chatbubbles" size={17} color={T.textOnPrimary} />
        <Text style={styles.label}>Ask Coach</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 16 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: T.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 8,
  },
  label: { fontSize: 14, fontWeight: '800', color: T.textOnPrimary, letterSpacing: 0.2 },
});
