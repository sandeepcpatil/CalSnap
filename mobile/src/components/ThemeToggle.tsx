import React, { useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import type { ThemeMode } from '../store/themeStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SegmentConfig {
  mode: ThemeMode;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
}

const SEGMENTS: SegmentConfig[] = [
  { mode: 'light', icon: 'sunny-outline',  label: 'Light' },
  { mode: 'dark',  icon: 'moon-outline',   label: 'Dark'  },
];

interface Props {
  style?: ViewStyle;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * A 3-segment (Light / Auto / Dark) theme switcher.
 * The active pill slides smoothly using the Animated API.
 *
 * Place on the Settings / Profile screen.
 */
export function ThemeToggle({ style }: Props) {
  const { theme, preference, setTheme } = useTheme();

  // Index of the currently selected segment
  const activeIndex = SEGMENTS.findIndex((s) => s.mode === preference);

  // Animated pill position — 0..1..2 mapped to x offset
  const slideAnim = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeIndex,
      useNativeDriver: true,
      tension: 180,
      friction: 18,
    }).start();
  }, [activeIndex]);

  const SEGMENT_WIDTH = 120; // px per segment
  const PILL_INSET   = 3;   // gap between pill and track edge

  const pillTranslateX = slideAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [
      PILL_INSET,
      SEGMENT_WIDTH + PILL_INSET,
    ],
  });

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: theme.surface2,
          borderColor: theme.borderColor,
          width: SEGMENT_WIDTH * 2 + PILL_INSET * 2,
        },
        style,
      ]}
    >
      {/* Animated sliding pill */}
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: theme.surface,
            width: SEGMENT_WIDTH - PILL_INSET * 2,
            shadowColor: theme.shadow,
            transform: [{ translateX: pillTranslateX }],
          },
        ]}
      />

      {/* Segment buttons */}
      {SEGMENTS.map((seg, idx) => {
        const isActive = idx === activeIndex;
        return (
          <TouchableOpacity
            key={seg.mode}
            onPress={() => setTheme(seg.mode)}
            activeOpacity={0.8}
            style={[styles.segment, { width: SEGMENT_WIDTH }]}
            accessibilityRole="button"
            accessibilityLabel={seg.label}
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={seg.icon}
              size={18}
              color={isActive ? theme.primary : theme.textMuted}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: 18,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  segment: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
