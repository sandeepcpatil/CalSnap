import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { SmartAlert, AlertTone } from '../utils/alerts';

interface Props {
  visible: boolean;
  onClose: () => void;
  alerts: SmartAlert[];
}

const C = {
  bg: '#101415',
  glass: 'rgba(15,23,42,0.80)',
  glassBorder: 'rgba(255,255,255,0.08)',
  primary: '#85d3da',
  secondary: '#bdf4ff',
  onSurface: '#e0e3e5',
  onSurfaceVar: '#bec8c9',
  outline: '#889393',
  header: 'rgba(16,20,21,0.92)',
};

const TONE: Record<AlertTone, { bg: string; border: string; icon: string }> = {
  success: { bg: 'rgba(46,160,120,0.12)', border: 'rgba(120,216,168,0.30)', icon: '#78d8a8' },
  warning: { bg: 'rgba(255,180,80,0.12)', border: 'rgba(255,180,80,0.30)', icon: '#ffc46b' },
  info: { bg: 'rgba(0,227,253,0.10)', border: 'rgba(0,227,253,0.25)', icon: '#5fd0e6' },
};

export function AlertsModal({ visible, onClose, alerts }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="notifications" size={20} color={C.primary} />
              <Text style={styles.headerTitle}>Alerts</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={C.onSurfaceVar} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {alerts.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={C.outline} />
              <Text style={styles.emptyTitle}>All clear</Text>
              <Text style={styles.emptyBody}>
                No alerts right now. Keep logging your meals and we’ll surface anything worth your attention.
              </Text>
            </View>
          ) : (
            alerts.map((a) => {
              const tone = TONE[a.tone];
              return (
                <View key={a.id} style={[styles.card, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                  <View style={[styles.iconWrap, { borderColor: tone.border }]}>
                    <Ionicons name={a.icon} size={20} color={tone.icon} />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{a.title}</Text>
                    <Text style={styles.cardBody}>{a.body}</Text>
                  </View>
                </View>
              );
            })
          )}

          <Text style={styles.footnote}>
            Alerts are generated from your own logs on this device — no data leaves your phone.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  headerSafe: { zIndex: 10, backgroundColor: C.header },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.glassBorder,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.onSurface, letterSpacing: 0.3 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  scroll: { padding: 20, gap: 12 },
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  cardBody: { fontSize: 13, lineHeight: 19, color: C.onSurfaceVar },

  empty: { alignItems: 'center', gap: 10, paddingVertical: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.onSurface },
  emptyBody: { fontSize: 14, lineHeight: 21, color: C.onSurfaceVar, textAlign: 'center' },

  footnote: { fontSize: 11, color: C.outline, textAlign: 'center', marginTop: 8, lineHeight: 16 },
});
