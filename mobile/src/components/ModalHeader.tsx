import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { T, spacing, HIT_TARGET, type } from '../theme';

interface Props {
  title: string;
  /** Called by the close control. Modals close; they do not "go back". */
  onClose: () => void;
  /** Optional primary action rendered on the right ("Save", "Done"). */
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  /** Use a back arrow instead of X for a pushed screen inside a modal stack. */
  variant?: 'close' | 'back';
}

/**
 * The one header every full-screen modal and pushed form uses.
 *
 * Before this, five files each drew their own: a tinted back circle, a plain
 * back arrow, an X on the right, a sheet grabber, a card with Cancel/Confirm.
 * A back arrow inside a modal implies push navigation that is not there, so
 * the default is a close X on the left and the optional action on the right,
 * both at the 44pt hit target with labels for screen readers.
 */
export function ModalHeader({
  title,
  onClose,
  actionLabel,
  onAction,
  actionDisabled = false,
  variant = 'close',
}: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={onClose}
        style={styles.iconBtn}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={variant === 'back' ? 'Back' : 'Close'}
      >
        <Ionicons name={variant === 'back' ? 'arrow-back' : 'close'} size={24} color={T.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          disabled={actionDisabled}
          style={styles.actionBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ disabled: actionDisabled }}
        >
          <Text style={[styles.actionLabel, actionDisabled && styles.actionDisabled]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : (
        // Keeps the title optically centred when there is no action.
        <View style={styles.iconBtn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: HIT_TARGET + spacing.sm * 2,
    borderBottomWidth: 1,
    borderBottomColor: T.divider,
  },
  iconBtn: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...type.titleSm,
    flex: 1,
    textAlign: 'center',
    color: T.textPrimary,
  },
  actionBtn: {
    minWidth: HIT_TARGET,
    height: HIT_TARGET,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...type.body,
    fontWeight: '700',
    color: T.primary,
  },
  actionDisabled: {
    color: T.textMuted,
  },
});
