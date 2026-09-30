import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ExportRangeKey } from '../services/export';
import { T, spacing, radius, HIT_TARGET } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (key: ExportRangeKey) => void;
  busyKey: ExportRangeKey | null;
}

const OPTIONS: { key: ExportRangeKey; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'week', label: 'This week', sub: 'Last 7 days', icon: 'calendar-outline' },
  { key: 'last30', label: 'Last 30 days', sub: 'Rolling month', icon: 'calendar-outline' },
  { key: 'last90', label: 'Last 90 days', sub: 'Rolling quarter', icon: 'calendar-outline' },
  { key: 'thisMonth', label: 'This month', sub: 'From the 1st to today', icon: 'today-outline' },
  { key: 'lastMonth', label: 'Last month', sub: 'Previous calendar month', icon: 'today-outline' },
];

/** Bottom sheet: pick the period to export. Stays a sheet — it is one choice, not a form. */
export function ExportRangeModal({ visible, onClose, onSelect, busyKey }: Props) {
  const busy = busyKey !== null;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={busy ? undefined : onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={busy ? undefined : onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Ionicons name="download-outline" size={20} color={T.primary} />
            <Text style={styles.title}>Export to Excel</Text>
          </View>
          <Text style={styles.subtitle}>Choose the period to export.</Text>

          <View style={styles.list}>
            {OPTIONS.map((opt) => {
              const isBusy = busyKey === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={styles.row}
                  onPress={() => !busy && onSelect(opt.key)}
                  activeOpacity={0.8}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`${opt.label}, ${opt.sub}`}
                  accessibilityState={{ disabled: busy, busy: isBusy }}
                >
                  <Ionicons name={opt.icon} size={20} color={T.primary} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{opt.label}</Text>
                    <Text style={styles.rowSub}>{opt.sub}</Text>
                  </View>
                  {isBusy ? (
                    <ActivityIndicator animating size={16} color={T.primary} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            disabled={busy}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
          >
            <Text style={[styles.cancelText, busy && { opacity: 0.4 }]}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: T.overlay },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: T.grabber, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 18, fontWeight: '800', color: T.textPrimary },
  subtitle: { fontSize: 13, color: T.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md },

  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT_TARGET + spacing.sm,
    backgroundColor: T.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '700', color: T.textPrimary },
  rowSub: { fontSize: 13, color: T.textSecondary },

  cancelBtn: { alignItems: 'center', justifyContent: 'center', minHeight: HIT_TARGET, paddingVertical: spacing.md, marginTop: spacing.xs },
  cancelText: { fontSize: 15, fontWeight: '700', color: T.textMuted },
});
