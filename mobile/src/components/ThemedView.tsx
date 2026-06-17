import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThemedViewVariant = 'screen' | 'card' | 'surface' | 'modal';

interface ThemedViewProps extends ViewProps {
  variant?: ThemedViewVariant;
  /** Override the background color for one-off customisations */
  bg?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * A View that automatically applies the correct background colour
 * from the active theme. Use instead of raw <View> whenever you
 * need the background to respond to light/dark mode.
 *
 * Variants:
 *  - 'screen'  → theme.bg           (full-screen containers)
 *  - 'card'    → theme.cardBg       (elevated cards, list rows)
 *  - 'surface' → theme.surface      (general elevated surface)
 *  - 'modal'   → theme.surface      (bottom sheets, dialogs)
 *
 * @example
 * <ThemedView variant="screen" style={{ flex: 1 }}>
 *   <ThemedView variant="card" style={styles.card}>...</ThemedView>
 * </ThemedView>
 */
export function ThemedView({ variant = 'screen', bg, style, children, ...rest }: ThemedViewProps) {
  const { theme } = useTheme();

  const bgMap: Record<ThemedViewVariant, string> = {
    screen:  theme.bg,
    card:    theme.cardBg,
    surface: theme.surface,
    modal:   theme.surface,
  };

  const resolvedBg = bg ?? bgMap[variant];

  const baseStyle: ViewStyle = { backgroundColor: resolvedBg };

  return (
    <View style={[baseStyle, style]} {...rest}>
      {children}
    </View>
  );
}
