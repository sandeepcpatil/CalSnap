import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ExportRangeKey } from '../services/export';
import { T } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (key: ExportRangeKey) => void;
  busyKey: ExportRangeKey | null;
}

// Screen palette — derived from the shared design tokens so colours stay in
// sync app-wide (see theme/tokens.ts).
const C = {
  sheet: T.surface,
  glassBorder: T.border,
  primary: T.primary,
  secondaryCont: T.primary,
  onSurface: T.textPrimary,
  onSurfaceVar: T.textSecondary,
  outline: T.textMuted,
  rowBg: T.surface2,
};

const OPTIONS: { key: ExportRangeKey; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'week', label: 'This Week', sub: 'Last 7 days', icon: 'calendar-outline' },
  { key: 'last30', label: 'Last 30 Days', sub: 'Rolling month', icon: 'calendar-outline' },
  { key: 'last90', label: 'Last 90 Days', sub: 'Rolling quarter', icon: 'calendar-outline' },
  { key: 'thisMonth', label: 'This Month', sub: 'From the 1st to today', icon: 'today-outline' },
  { key: 'lastMonth', label: 'Last Month', sub: 'Previous calendar month', icon: 'today-outline' },
];

export function ExportRangeModal({ visible, onClose, onSelect, busyKey }: Props) {
  const busy = busyKey !== null;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={busy ? undefined : onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Ionicons name="download-outline" size={20} color={C.primary} />
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
                >
                  <Ionicons name={opt.icon} size={20} color={C.primary} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{opt.label}</Text>
                    <Text style={styles.rowSub}>{opt.sub}</Text>
                  </View>
                  {isBusy ? (
                    <ActivityIndicator animating size={16} color={C.secondaryCont} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={C.outline} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={busy} activeOpacity={0.7}>
            <Text style={[styles.cancelText, busy && { opacity: 0.4 }]}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: C.glassBorder,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '800', color: C.onSurface },
  subtitle: { fontSize: 13, color: C.onSurfaceVar, marginTop: 4, marginBottom: 14 },

  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.rowBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.glassBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  rowSub: { fontSize: 12, color: C.onSurfaceVar },

  cancelBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 6 },
  cancelText: { fontSize: 15, fontWeight: '700', color: C.outline },
});
