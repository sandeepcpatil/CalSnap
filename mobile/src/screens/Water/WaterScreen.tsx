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
import { Text, ActivityIndicator } from 'react-native-paper';
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
  recommendedWaterMl,
  MAX_CUSTOM_ML,
  MIN_CUSTOM_ML,
  MIN_GOAL_ML,
  MAX_GOAL_ML,
} from '../../utils/water';
import { T, HIT_TARGET, tabularNums } from '../../theme';

interface Props {
  navigation: { goBack: () => void };
}

/** Round litre values offered as one-tap goal presets. */
const GOAL_PRESETS_ML = [2000, 2500, 3000, 3500, 4000] as const;

const CUSTOM_HINT = `Between ${MIN_CUSTOM_ML} and ${MAX_CUSTOM_ML.toLocaleString()} ml`;
const GOAL_HINT = `Between ${formatMl(MIN_GOAL_ML)} and ${formatMl(MAX_GOAL_ML)}`;

/** A typed whole-ml value inside [min, max], or null when it is not one yet. */
function parseMl(text: string, min: number, max: number): number | null {
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n);
}

/**
 * The full hydration screen — reached from "More" in the log hub or the Home
 * water card. Everything here is one tap: vessel tiles log immediately with no
 * confirm step, because a confirm dialog on something people do eight times a
 * day is the fastest way to get it abandoned. Undo lives in the Today list.
 */
export function WaterScreen({ navigation }: Props) {
  const { profile, updateProfile } = useAuthStore();
  const { logs, consumedMl, goalMl, isLoading, add, remove } = useWater();
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  /** Set when the sheet is opened to (re)define "My bottle" rather than log once. */
  const [savingVessel, setSavingVessel] = useState(false);

  const [goalOpen, setGoalOpen] = useState(false);
  const [goalText, setGoalText] = useState('');

  const myBottleMl = profile?.custom_vessel_ml ?? null;
  const explicitGoal = profile?.daily_water_ml_goal ?? null;
  const recommendedMl = recommendedWaterMl(profile?.weight_kg, profile?.activity_level);

  const customMl = parseMl(customText, MIN_CUSTOM_ML, MAX_CUSTOM_ML);
  const customInvalid = customText.length > 0 && customMl == null;
  const goalCustomMl = parseMl(goalText, MIN_GOAL_ML, MAX_GOAL_ML);
  const goalInvalid = goalText.length > 0 && goalCustomMl == null;

  const setGoal = async (ml: number | null) => {
    setGoalOpen(false);
    setGoalText('');
    // null clears the override, so the goal reverts to the weight+activity value.
    await updateProfile({ daily_water_ml_goal: ml });
  };

  const submitGoalCustom = async () => {
    if (goalCustomMl == null) return;
    await setGoal(goalCustomMl);
  };

  const openCustom = (asVessel: boolean) => {
    setSavingVessel(asVessel);
    setCustomText(asVessel && myBottleMl ? String(myBottleMl) : '');
    setCustomOpen(true);
  };

  const submitCustom = async () => {
    if (customMl == null) return;
    const ml = clampCustomMl(customMl);
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
  const showLoading = isLoading && todayRows.length === 0;

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

        <TouchableOpacity
          style={styles.goalBtn}
          onPress={() => { setGoalText(''); setGoalOpen(true); }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Daily goal ${formatMl(goalMl)}${explicitGoal ? '' : ', set automatically'}. Tap to change.`}
        >
          <Ionicons name="flag-outline" size={15} color={T.primary} />
          <Text style={styles.goalBtnText}>
            Daily goal · {formatMl(goalMl)}
            {explicitGoal ? '' : '  ·  auto'}
          </Text>
          <Ionicons name="create-outline" size={16} color={T.textMuted} />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Add a drink</Text>

        {/* Your own size is a VESSEL, so it sits in the vessel row and looks
            like one. Labelled "Mine" to avoid colliding with the 500 ml
            "Bottle" preset next to it. */}
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
              <Text style={styles.vesselLabel} numberOfLines={1}>{v.label}</Text>
              <Text style={styles.vesselMl} numberOfLines={1}>{formatMl(v.ml)}</Text>
            </TouchableOpacity>
          ))}

          {myBottleMl ? (
            <TouchableOpacity
              style={[styles.vessel, styles.vesselMine]}
              onPress={() => add(myBottleMl)}
              onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                openCustom(true);
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Log your own size, ${formatMl(myBottleMl)}. Long press to change it.`}
            >
              <Ionicons name="bookmark" size={24} color={T.primary} />
              <Text style={styles.vesselLabel} numberOfLines={1}>Mine</Text>
              <Text style={styles.vesselMl} numberOfLines={1}>{formatMl(myBottleMl)}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.vessel, styles.vesselAdd]}
              onPress={() => openCustom(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Save your own bottle size for one-tap logging"
            >
              <Ionicons name="add-circle-outline" size={24} color={T.textSecondary} />
              <Text style={[styles.vesselLabel, { color: T.textSecondary }]} numberOfLines={1}>Add</Text>
              <Text style={styles.vesselMl} numberOfLines={1}>yours</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.vesselHint}>
          {myBottleMl
            ? 'Tap a vessel to log it. Hold “Mine” to change your size.'
            : 'Bottle a different size? Save it once and log it in one tap.'}
        </Text>

        <TouchableOpacity
          style={styles.customTile}
          onPress={() => openCustom(false)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Log a custom amount"
        >
          <Ionicons name="create-outline" size={18} color={T.textSecondary} />
          <View style={styles.customTileText}>
            <Text style={styles.customTileLabel}>Custom amount</Text>
            <Text style={styles.customTileSub}>Type a one-off amount in ml</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Today</Text>
        {showLoading ? (
          <View style={styles.empty} accessibilityLabel="Loading today's water">
            <ActivityIndicator color={T.primary} />
          </View>
        ) : todayRows.length === 0 ? (
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
                  style={styles.removeBtn}
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
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setCustomOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{savingVessel ? 'Your bottle size' : 'Custom amount'}</Text>
            {savingVessel && (
              <Text style={styles.modalHint}>
                Saved as a vessel next to Glass and Bottle, so you can log it in one tap.
              </Text>
            )}
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
                onSubmitEditing={customMl != null ? submitCustom : undefined}
                returnKeyType="done"
                accessibilityLabel="Amount in millilitres"
              />
              <Text style={styles.inputUnit}>ml</Text>
            </View>
            <Text style={[styles.modalHint, customInvalid && styles.modalHintError]}>{CUSTOM_HINT}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCustomOpen(false)} accessibilityRole="button">
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, customMl == null && styles.modalConfirmDisabled]}
                onPress={submitCustom}
                disabled={customMl == null}
                accessibilityRole="button"
                accessibilityState={{ disabled: customMl == null }}
              >
                <Text style={styles.modalConfirmText}>{savingVessel ? 'Save size' : 'Log it'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Daily goal */}
      <Modal visible={goalOpen} transparent animationType="fade" onRequestClose={() => setGoalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setGoalOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Daily water goal</Text>
            <Text style={styles.modalHint}>
              Based on your weight and activity, we suggest {formatMl(recommendedMl)}. You also
              get water from food and tea, so this counts only what you drink.
            </Text>

            <View style={styles.goalChips}>
              {/* Auto reverts to the weight + activity recommendation. */}
              <TouchableOpacity
                style={[styles.goalChip, explicitGoal === null && styles.goalChipActive]}
                onPress={() => setGoal(null)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: explicitGoal === null }}
              >
                <Text style={[styles.goalChipText, explicitGoal === null && styles.goalChipTextActive]}>
                  Auto ({formatMl(recommendedMl)})
                </Text>
              </TouchableOpacity>

              {GOAL_PRESETS_ML.map((ml) => {
                const active = explicitGoal === ml;
                return (
                  <TouchableOpacity
                    key={ml}
                    style={[styles.goalChip, active && styles.goalChipActive]}
                    onPress={() => setGoal(ml)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.goalChipText, active && styles.goalChipTextActive]}>{formatMl(ml)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.modalHint}>Or set your own</Text>
            <View style={styles.inputRow}>
              <TextInput
                value={goalText}
                onChangeText={(t) => setGoalText(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder={String(recommendedMl)}
                placeholderTextColor={T.textMuted}
                style={styles.input}
                maxLength={4}
                onSubmitEditing={goalCustomMl != null ? submitGoalCustom : undefined}
                returnKeyType="done"
                accessibilityLabel="Daily goal in millilitres"
              />
              <Text style={styles.inputUnit}>ml</Text>
            </View>
            <Text style={[styles.modalHint, goalInvalid && styles.modalHintError]}>{GOAL_HINT}</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setGoalOpen(false)} accessibilityRole="button">
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, goalCustomMl == null && styles.modalConfirmDisabled]}
                onPress={submitGoalCustom}
                disabled={goalCustomMl == null}
                accessibilityRole="button"
                accessibilityState={{ disabled: goalCustomMl == null }}
              >
                <Text style={styles.modalConfirmText}>Save</Text>
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
  backBtn: { width: HIT_TARGET, height: HIT_TARGET, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.2 },

  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 16 },

  goalBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: HIT_TARGET,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 50,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    marginTop: -4,
  },
  goalBtnText: { fontSize: 13, fontWeight: '700', color: T.textSecondary, ...tabularNums },

  goalChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  goalChip: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 50,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    justifyContent: 'center',
  },
  goalChipActive: { backgroundColor: T.primary, borderColor: T.primary },
  goalChipText: { fontSize: 13, fontWeight: '700', color: T.textSecondary },
  goalChipTextActive: { color: T.textOnPrimary },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: T.textMuted,
    marginTop: 6,
  },

  // gap 8 (not 10) so four tiles still breathe on a 320pt screen.
  vesselRow: { flexDirection: 'row', gap: 8 },
  vessel: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 16,
    paddingHorizontal: 2,
    borderRadius: 16,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  /** The saved personal size — tinted so it reads as "yours". */
  vesselMine: { borderColor: T.primaryBorder, backgroundColor: T.primaryTint },
  /** Empty slot inviting you to save a size. */
  vesselAdd: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  vesselLabel: { fontSize: 13, fontWeight: '700', color: T.textPrimary, marginTop: 2 },
  vesselMl: { fontSize: 12, fontWeight: '600', color: T.textMuted, ...tabularNums },
  vesselHint: { fontSize: 12, color: T.textMuted, marginTop: -6, lineHeight: 16 },

  customTile: {
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
  customTileText: { flex: 1 },
  customTileLabel: { fontSize: 14, fontWeight: '700', color: T.textPrimary },
  customTileSub: { fontSize: 12, fontWeight: '600', color: T.textMuted, marginTop: 1 },

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
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 4,
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
  logAmount: { flex: 1, fontSize: 15, fontWeight: '700', color: T.textPrimary, ...tabularNums },
  logTime: { fontSize: 13, fontWeight: '600', color: T.textMuted },
  removeBtn: { width: HIT_TARGET, height: HIT_TARGET, alignItems: 'center', justifyContent: 'center' },

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
  modalHint: { fontSize: 12, lineHeight: 17, fontWeight: '600', color: T.textMuted },
  modalHintError: { color: T.error },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalCancel: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surface2,
  },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: T.textSecondary },
  modalConfirm: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primary,
  },
  modalConfirmDisabled: { opacity: 0.4 },
  modalConfirmText: { fontSize: 15, fontWeight: '800', color: T.textOnPrimary },
});
