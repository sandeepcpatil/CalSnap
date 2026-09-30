import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { T, spacing, radius, type } from '../theme';

interface Props {
  isSubscribed: boolean;
  onUpgrade: () => void;
  /** Text shown inside the lock badge */
  label?: string;
  /** Match the border radius of the wrapped card */
  borderRadius?: number;
  children: React.ReactNode;
}

/**
 * Wraps any UI section. If the user is subscribed, children render normally.
 * If not, children are dimmed and an upgrade prompt overlays them.
 */
export function ProGate({
  isSubscribed,
  onUpgrade,
  label = 'Pro feature',
  borderRadius = radius.lg,
  children,
}: Props) {
  if (isSubscribed) return <>{children}</>;

  return (
    <View style={[styles.container, { borderRadius, overflow: 'hidden' }]}>
      {/* Dim the underlying content so users can glimpse what they're missing */}
      <View style={styles.dimmed} pointerEvents="none">
        {children}
      </View>

      {/* Lock overlay */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={onUpgrade}
        activeOpacity={0.95}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Upgrade to Pro`}
      >
        <View style={styles.overlay}>
          <View style={styles.lockCard}>
            <View style={styles.lockIconCircle}>
              <Ionicons name="lock-closed" size={16} color={T.primary} />
            </View>
            <Text style={styles.lockLabel}>{label}</Text>
            <View style={styles.upgradeBadge}>
              <Ionicons name="star" size={12} color={T.textOnPrimary} />
              <Text style={styles.upgradeText}>Upgrade to Pro</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // minHeight guarantees the centered lock card (~130px tall) is never clipped
  // by `overflow: hidden` when the wrapped content is shorter than the card.
  container: { position: 'relative', minHeight: 150 },
  dimmed:    { opacity: 0.15 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: T.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },

  lockCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['2xl'],
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: T.border,
  },

  lockIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: T.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  lockLabel: {
    ...type.bodySm,
    fontWeight: '700',
    color: T.textPrimary,
  },

  upgradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 32,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: T.primary,
    borderRadius: radius.pill,
    marginTop: 2,
  },

  upgradeText: {
    ...type.bodySm,
    fontWeight: '700',
    color: T.textOnPrimary,
  },
});
