import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, Animated, Easing, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { T, spacing, radius, type, HIT_TARGET, shadows } from '../theme';

/** Ignore scroll jitter below this many px so the pill doesn't flicker. */
const SCROLL_THRESHOLD = 8;
/** Above this scroll offset we start hiding; below it the pill always shows. */
const TOP_ZONE = 40;

/**
 * Vertical room a scrolling list should leave at its end so the last row's
 * trailing column (kcal, chevron) is never sitting under the pill.
 */
export const COACH_FAB_CLEARANCE = HIT_TARGET + spacing['2xl'] * 2;

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
 * A PILL, not a circle, and a *secondary* one: the tab bar already has the one
 * filled primary control (the raised "+"), so this sits on `surface2` with a
 * primary-tinted border and text. It labels itself, which matters for a
 * feature nobody has seen before.
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
      style={[styles.wrap, { bottom: tabBarHeight + spacing.lg, transform: [{ translateY }], opacity }]}
      pointerEvents={hidden ? 'none' : 'auto'}
    >
      <TouchableOpacity
        style={styles.pill}
        onPress={() => rootNav?.navigate('Coach')}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Ask your nutrition coach"
      >
        <Ionicons name="chatbubbles-outline" size={18} color={T.primary} />
        <Text style={styles.label}>Ask Coach</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: spacing.lg },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: HIT_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.primaryBorder,
    ...shadows.e2,
  },
  label: { ...type.body, fontWeight: '700', color: T.primary },
});
