import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../store/authStore';
import { useWater } from '../../hooks/useWater';
import { WaterRing } from '../../components/WaterRing';
import {
  VESSELS,
  clampCustomMl,
  formatLogTime,
  formatMl,
  MAX_CUSTOM_ML,
  MIN_CUSTOM_ML,
} from '../../utils/water';
import { T } from '../../theme';

interface Props {
  navigation: { goBack: () => void };
}

/**
 * The full hydration screen — reached from "More" in the log hub or the Home
 * water card. Everything here is one tap: vessel tiles log immediately with no
 * confirm step, because a confirm dialog on something people do eight times a
 * day is the fastest way to get it abandoned. Undo lives in the Today list.
 */
export function WaterScreen({ navigation }: Props) {
  const { profile, updateProfile } = useAuthStore();
  const { logs, consumedMl, goalMl, add, remove } = useWater();
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  /** Set when the sheet is opened to (re)define "My bottle" rather than log once. */
  const [savingVessel, setSavingVessel] = useState(false);

  const myBottleMl = profile?.custom_vessel_ml ?? null;

  const openCustom = (asVessel: boolean) => {
    setSavingVessel(asVessel);
    setCustomText(asVessel && myBottleMl ? String(myBottleMl) : '');
    setCustomOpen(true);
  };

  const submitCustom = async () => {
    const parsed = Number(customText);
    if (!Number.isFinite(parsed) || parsed < MIN_CUSTOM_ML) return;
    const ml = clampCustomMl(parsed);
    setCustomOpen(false);
    setCustomText('');

    if (savingVessel) {
      await updateProfile({ custom_vessel_ml: ml });
      return;
    }
    await add(ml);
  };

  // Newest drink first — the row you're most likely to undo sits at the top.
  const todayRows = [...logs].reverse();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={navigation.goBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={T.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Water</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <WaterRing consumedMl={consumedMl} goalMl={goalMl} size={196} />

        <Text style={styles.sectionLabel}>Add a drink</Text>
        <View style={styles.vesselRow}>
          {VESSELS.map((v) => (
            <TouchableOpacity
              key={v.key}
              style={styles.vessel}
              onPress={() => add(v.ml)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Log ${v.label}, ${formatMl(v.ml)}`}
            >
              <Ionicons name={v.icon as never} size={24} color={T.primary} />
              <Text style={styles.vesselLabel}>{v.label}</Text>
              <Text style={styles.vesselMl}>{formatMl(v.ml)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.customRow}>
          {myBottleMl ? (
            <TouchableOpacity
              style={[styles.customTile, styles.customTileFilled]}
              onPress={() => add(myBottleMl)}
              onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                openCustom(true);
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Log my bottle, ${formatMl(myBottleMl)}. Long press to change the size.`}
            >
              <Ionicons name="bookmark" size={18} color={T.primary} />
              <View style={styles.customTileText}>
                <Text style={styles.customTileLabel}>My bottle</Text>
                <Text style={styles.customTileSub}>{formatMl(myBottleMl)} · hold to edit</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.customTile}
              onPress={() => openCustom(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Save my bottle size"
            >
              <Ionicons name="bookmark-outline" size={18} color={T.textSecondary} />
              <View style={styles.customTileText}>
                <Text style={styles.customTileLabel}>My bottle</Text>
                <Text style={styles.customTileSub}>Save your size</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.customTile}
            onPress={() => openCustom(false)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Log a custom amount"
          >
            <Ionicons name="add" size={20} color={T.textSecondary} />
            <View style={styles.customTileText}>
              <Text style={styles.customTileLabel}>Custom</Text>
              <Text style={styles.customTileSub}>Type an amount</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Today</Text>
        {todayRows.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="water-outline" size={26} color={T.textMuted} />
            <Text style={styles.emptyText}>No water logged yet today.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {todayRows.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logIcon}>
                  <Ionicons name="water" size={15} color={T.primary} />
                </View>
                <Text style={styles.logAmount}>{formatMl(log.amount_ml)}</Text>
                <Text style={styles.logTime}>{formatLogTime(log.logged_at)}</Text>
                <TouchableOpacity
                  onPress={() => remove(log.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${formatMl(log.amount_ml)} logged at ${formatLogTime(log.logged_at)}`}
                >
                  <Ionicons name="close" size={18} color={T.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Custom amount / vessel size */}
      <Modal visible={customOpen} transparent animationType="fade" onRequestClose={() => setCustomOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setCustomOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{savingVessel ? 'My bottle size' : 'Custom amount'}</Text>
            <View style={styles.inputRow}>
              <TextInput
                value={customText}
                onChangeText={(t) => setCustomText(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={T.textMuted}
                style={styles.input}
                autoFocus
                maxLength={4}
                onSubmitEditing={submitCustom}
                returnKeyType="done"
              />
              <Text style={styles.inputUnit}>ml</Text>
            </View>
            <Text style={styles.modalHint}>
              Between {MIN_CUSTOM_ML} and {MAX_CUSTOM_ML} ml
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCustomOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, !customText && styles.modalConfirmDisabled]}
                onPress={submitCustom}
                disabled={!customText}
              >
                <Text style={styles.modalConfirmText}>{savingVessel ? 'Save' : 'Log it'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.2 },

  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 16 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: T.textMuted,
    marginTop: 6,
  },

  vesselRow: { flexDirection: 'row', gap: 10 },
  vessel: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  vesselLabel: { fontSize: 13.5, fontWeight: '700', color: T.textPrimary, marginTop: 2 },
  vesselMl: { fontSize: 12, fontWeight: '600', color: T.textMuted },

  customRow: { flexDirection: 'row', gap: 10 },
  customTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  customTileFilled: { borderColor: 'rgba(133,211,218,0.35)', backgroundColor: T.primaryTint },
  customTileText: { flex: 1 },
  customTileLabel: { fontSize: 13.5, fontWeight: '700', color: T.textPrimary },
  customTileSub: { fontSize: 11.5, fontWeight: '600', color: T.textMuted, marginTop: 1 },

  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
    borderRadius: 16,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  emptyText: { fontSize: 13, fontWeight: '600', color: T.textMuted },

  list: {
    borderRadius: 16,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.divider,
  },
  logIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primaryTint,
  },
  logAmount: { flex: 1, fontSize: 14.5, fontWeight: '700', color: T.textPrimary },
  logTime: { fontSize: 12.5, fontWeight: '600', color: T.textMuted },

  /* Custom amount modal */
  modalRoot: { flex: 1, backgroundColor: T.overlay, alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCard: {
    alignSelf: 'stretch',
    backgroundColor: T.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: T.border,
    padding: 22,
    gap: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: T.textPrimary },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 6 },
  input: {
    flex: 1,
    fontSize: 34,
    fontWeight: '800',
    color: T.textPrimary,
    paddingVertical: 6,
    borderBottomWidth: 2,
    borderBottomColor: T.primary,
  },
  inputUnit: { fontSize: 16, fontWeight: '700', color: T.textSecondary, paddingBottom: 12 },
  modalHint: { fontSize: 12, fontWeight: '600', color: T.textMuted },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalCancel: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surface2,
  },
  modalCancelText: { fontSize: 14.5, fontWeight: '700', color: T.textSecondary },
  modalConfirm: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primary,
  },
  modalConfirmDisabled: { opacity: 0.4 },
  modalConfirmText: { fontSize: 14.5, fontWeight: '800', color: T.textOnPrimary },
});
