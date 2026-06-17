import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThemedTextVariant =
  | 'heading'      // 28px, 800
  | 'subheading'   // 20px, 700
  | 'body'         // 16px, 400
  | 'label'        // 14px, 600
  | 'caption';     // 12px, 500

interface ThemedTextProps extends TextProps {
  variant?: ThemedTextVariant;
  /** Override text color from theme for semantic uses (e.g. error, primary) */
  color?: string;
  /** When true, uses textSecondary instead of textPrimary */
  secondary?: boolean;
  /** When true, uses textMuted */
  muted?: boolean;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const SIZE_MAP: Record<ThemedTextVariant, TextStyle> = {
  heading:    { fontSize: 28, fontWeight: '800', lineHeight: 34, letterSpacing: -0.5 },
  subheading: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  body:       { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  label:      { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  caption:    { fontSize: 12, fontWeight: '500', lineHeight: 16, letterSpacing: 0.2 },
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Text component that automatically picks the correct colour from the
 * active theme. Replaces raw <Text> for any text that must respond to
 * light/dark mode.
 *
 * @example
 * <ThemedText variant="heading">Good morning</ThemedText>
 * <ThemedText variant="caption" muted>3 scans left today</ThemedText>
 * <ThemedText color={theme.primary}>View all</ThemedText>
 */
export function ThemedText({
  variant = 'body',
  color,
  secondary,
  muted,
  style,
  children,
  ...rest
}: ThemedTextProps) {
  const { theme } = useTheme();

  let resolvedColor = theme.textPrimary;
  if (secondary) resolvedColor = theme.textSecondary;
  if (muted)     resolvedColor = theme.textMuted;
  if (color)     resolvedColor = color;

  const computedStyle: TextStyle = {
    ...SIZE_MAP[variant],
    color: resolvedColor,
  };

  return (
    <Text style={[computedStyle, style]} {...rest}>
      {children}
    </Text>
  );
}
