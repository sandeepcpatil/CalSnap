import React from 'react';
import { StyleSheet } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '../store/toastStore';
import { T, spacing, radius, type } from '../theme';

/** Height of the tab bar the snackbar must clear when shown over Main. */
const TAB_BAR_CLEARANCE = 72;

/**
 * Mounts once at the root (see App.tsx) and renders whatever `toastStore`
 * holds. Sits above the tab bar and the home indicator so it never covers the
 * centre "+" button.
 */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const current = useToastStore((s) => s.current);
  const dismiss = useToastStore((s) => s.dismiss);

  const bottom = Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE;

  return (
    <Snackbar
      visible={current !== null}
      onDismiss={dismiss}
      duration={current?.duration ?? (current?.action ? 6000 : 4000)}
      action={
        current?.action
          ? {
              label: current.action.label,
              textColor: T.primary,
              onPress: () => {
                void current.action?.onPress();
                dismiss();
              },
            }
          : undefined
      }
      style={[styles.bar, { marginBottom: bottom }]}
      wrapperStyle={styles.wrapper}
    >
      <Text style={styles.text}>{current?.message ?? ''}</Text>
    </Snackbar>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: spacing.lg },
  bar: {
    backgroundColor: T.surfaceOffset,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.border,
  },
  text: { ...type.body, color: T.textPrimary },
});
