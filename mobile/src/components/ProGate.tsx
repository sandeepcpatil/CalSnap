import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

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
  label = 'Pro Feature',
  borderRadius = 16,
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
      >
        <View style={styles.overlay}>
          <View style={styles.lockCard}>
            <View style={styles.lockIconCircle}>
              <Ionicons name="lock-closed" size={16} color="#00e3fd" />
            </View>
            <Text style={styles.lockLabel}>{label}</Text>
            <View style={styles.upgradeBadge}>
              <Ionicons name="star" size={10} color="#00363a" />
              <Text style={styles.upgradeText}>UPGRADE TO PRO</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  dimmed:    { opacity: 0.15 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,20,21,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  lockCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,227,253,0.25)',
  },

  lockIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,227,253,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  lockLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e0e3e5',
    letterSpacing: 0.3,
  },

  upgradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#00e3fd',
    borderRadius: 20,
    marginTop: 2,
  },

  upgradeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00363a',
    letterSpacing: 1,
  },
});
