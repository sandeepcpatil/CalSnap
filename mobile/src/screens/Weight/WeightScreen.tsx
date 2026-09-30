import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../store/authStore';
import { useWeightStore } from '../../store/weightStore';
import { useNotificationStore } from '../../store/notificationStore';
import { WeightChart, shortDate, weightDeltaColor } from '../../components/WeightChart';
import {
  toSeries,
  latestKg,
  changeKg,
  weeklyRateKg,
  projectKg,
  etaDaysToTarget,
  etaLabel,
  formatKg,
  formatDeltaKg,
} from '../../utils/weightStats';
import { T, HIT_TARGET, tabularNums } from '../../theme';

interface Props {
  navigation: { goBack: () => void };
}

/** Same band the profile editor accepts, so the two never disagree. */
const MIN_KG = 20;
const MAX_KG = 300;
const PROJECTION_DAYS = 28;

const RANGE_HINT = `Enter a weight between ${MIN_KG} and ${MAX_KG} kg`;

function parseKg(text: string): number | null {
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < MIN_KG || n > MAX_KG) return null;
  return Math.round(n * 10) / 10;
}

/**
 * Body-weight history. Shows the trend (not a single number), the weekly rate,
 * and — if a goal weight is set — an ETA. Logging a weight updates the profile
 * weight the calorie and water goals read from.
 */
export function WeightScreen({ navigation }: Props) {
  const { session, profile, updateProfile } = useAuthStore();
  const { logs, isLoading, loaded, fetch, addWeight, removeWeight } = useWeightStore();

  const [logOpen, setLogOpen] = useState(false);
  const [logText, setLogText] = useState('');
  const [targetOpen, setTargetOpen] = useState(false);
  const [targetText, setTargetText] = useState('');
  const [busy, setBusy] = useState(false);

  const userId = session?.user.id;

  useEffect(() => { if (userId) fetch(userId); }, [userId, fetch]);

  const series = useMemo(() => toSeries(logs), [logs]);
  const current = latestKg(series) ?? profile?.weight_kg ?? null;
  const change = changeKg(series);
  const rate = weeklyRateKg(series);
  const target = profile?.target_weight_kg ?? null;
  const projected = projectKg(series, PROJECTION_DAYS);
  const eta = target != null ? etaDaysToTarget(series, target) : null;
  const bodyGoal = profile?.body_goal ?? null;

  const chartWidth = Dimensions.get('window').width - 32 - 32; // screen − scroll pad − card pad

  const openLog = () => {
    setLogText(current != null ? String(current) : '');
    setLogOpen(true);
  };

  const submitLog = async () => {
    if (!userId) return;
    const kg = parseKg(logText);
    if (kg == null) return;
    setBusy(true);
    try {
      await addWeight(userId, kg);
      // Push the weekly weigh-in nudge out a week now that they've weighed in.
      void useNotificationStore.getState().syncReminders();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLogOpen(false);
    } catch (err) {
      console.warn('[weight] save failed', err);
      Alert.alert("Couldn't save", 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const openTarget = () => {
    setTargetText(target != null ? String(target) : '');
    setTargetOpen(true);
  };

  const submitTarget = async () => {
    const kg = parseKg(targetText);
    if (kg == null) return;
    setTargetOpen(false);
    await updateProfile({ target_weight_kg: kg });
  };

  const clearTarget = async () => {
    setTargetOpen(false);
    await updateProfile({ target_weight_kg: null });
  };

  const confirmRemove = (id: string, kg: number, at: string) => {
    Alert.alert('Remove this weigh-in?', `${formatKg(kg)} on ${shortDate(at)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          removeWeight(id).catch((err) => {
            console.warn('[weight] remove failed', err);
            Alert.alert("Couldn't remove", 'Check your connection and try again.');
          }),
      },
    ]);
  };

  const recent = [...logs].sort((a, b) => b.logged_at.localeCompare(a.logged_at)).slice(0, 20);

  const goalSub =
    target == null
      ? 'Add a target to see how long it will take'
      : eta == null
        ? series.length < 2
          ? 'Log a few more weigh-ins for a projection'
          : 'Trending away from your goal right now'
        : eta === 0
          ? "You're at your goal"
          : `About ${etaLabel(eta)} at this rate`;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={navigation.goBack} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={T.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weight</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Current + change */}
        <View style={styles.card}>
          <View style={styles.currentRow}>
            <View>
              <Text style={styles.currentLabel}>Current</Text>
              <Text style={styles.currentValue}>{current != null ? formatKg(current) : '—'}</Text>
            </View>
            {change != null && (
              <View style={styles.deltaBlock}>
                <Text style={styles.deltaLabel}>Since your first weigh-in</Text>
                <Text style={[styles.deltaValue, { color: weightDeltaColor(change, bodyGoal) }]}>
                  {formatDeltaKg(change)}
                </Text>
              </View>
            )}
          </View>

          {isLoading && !loaded ? (
            <View style={[styles.chartLoading, { width: chartWidth }]}>
              <ActivityIndicator color={T.primary} />
            </View>
          ) : (
            <WeightChart series={series} width={chartWidth} />
          )}
        </View>

        {/* Trend + projection */}
        <View style={styles.card}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Weekly rate</Text>
              <Text style={styles.statValue}>
                {rate != null ? formatDeltaKg(rate).replace(' kg', '') : '—'}
                <Text style={styles.statUnit}> kg per week</Text>
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>In 4 weeks</Text>
              <Text style={styles.statValue}>{projected != null ? formatKg(projected) : '—'}</Text>
            </View>
          </View>

          <View style={styles.goalDivider} />

          {/* Goal weight + ETA */}
          <TouchableOpacity
            style={styles.goalRow}
            onPress={openTarget}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={target != null ? `Goal ${formatKg(target)}. Tap to change.` : 'Set a goal weight'}
          >
            <Ionicons name="flag-outline" size={16} color={T.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.goalLabel}>
                {target != null ? `Goal · ${formatKg(target)}` : 'Set a goal weight'}
              </Text>
              <Text style={styles.goalSub}>{goalSub}</Text>
            </View>
            <Ionicons name="create-outline" size={16} color={T.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Recent weigh-ins */}
        {recent.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Recent</Text>
            <View style={styles.card}>
              {recent.map((l) => (
                <View key={l.id} style={styles.logRow}>
                  <Ionicons name="scale-outline" size={16} color={T.textMuted} />
                  <Text style={styles.logKg}>{formatKg(l.weight_kg)}</Text>
                  <Text style={styles.logDate}>{shortDate(l.logged_at)}</Text>
                  <TouchableOpacity
                    onPress={() => confirmRemove(l.id, l.weight_kg, l.logged_at)}
                    style={styles.removeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${formatKg(l.weight_kg)} from ${shortDate(l.logged_at)}`}
                  >
                    <Ionicons name="close" size={18} color={T.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* Log weight CTA */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.logBtn} onPress={openLog} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel="Log your weight">
          <Ionicons name="add" size={20} color={T.textOnPrimary} />
          <Text style={styles.logBtnText}>Log weight</Text>
        </TouchableOpacity>
      </View>

      {/* Log modal */}
      <WeightInputModal
        visible={logOpen}
        title="Log your weight"
        value={logText}
        onChange={setLogText}
        onCancel={() => setLogOpen(false)}
        onSubmit={submitLog}
        confirmLabel={busy ? 'Saving…' : 'Save'}
        busy={busy}
      />

      {/* Target modal */}
      <WeightInputModal
        visible={targetOpen}
        title="Goal weight"
        value={targetText}
        onChange={setTargetText}
        onCancel={() => setTargetOpen(false)}
        onSubmit={submitTarget}
        confirmLabel="Save goal"
        extra={target != null ? { label: 'Remove goal', onPress: clearTarget } : undefined}
      />
    </SafeAreaView>
  );
}

interface ModalProps {
  visible: boolean;
  title: string;
  value: string;
  confirmLabel: string;
  busy?: boolean;
  extra?: { label: string; onPress: () => void };
  onChange: (t: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function WeightInputModal({ visible, title, value, confirmLabel, busy, extra, onChange, onCancel, onSubmit }: ModalProps) {
  const parsed = parseKg(value);
  const invalid = value.length > 0 && parsed == null;
  const canSubmit = parsed != null && !busy;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={value}
              onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor={T.textMuted}
              style={styles.input}
              autoFocus
              maxLength={5}
              onSubmitEditing={canSubmit ? onSubmit : undefined}
              returnKeyType="done"
              accessibilityLabel="Weight in kilograms"
            />
            <Text style={styles.inputUnit}>kg</Text>
          </View>
          <Text style={[styles.modalHint, invalid && styles.modalHintError]}>{RANGE_HINT}</Text>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={onCancel} accessibilityRole="button">
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirm, !canSubmit && styles.modalConfirmDisabled]}
              onPress={onSubmit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
            >
              <Text style={styles.modalConfirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
          {extra && (
            <TouchableOpacity style={styles.modalExtra} onPress={extra.onPress} accessibilityRole="button">
              <Text style={styles.modalExtraText}>{extra.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn: { width: HIT_TARGET, height: HIT_TARGET, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.2 },

  scroll: { padding: 16, gap: 14 },

  card: { borderRadius: 18, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, padding: 16, gap: 14 },

  currentRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  currentLabel: { fontSize: 12, fontWeight: '700', color: T.textMuted },
  currentValue: { fontSize: 34, fontWeight: '800', color: T.textPrimary, letterSpacing: -1, ...tabularNums },
  deltaBlock: { alignItems: 'flex-end', gap: 2 },
  deltaLabel: { fontSize: 12, fontWeight: '700', color: T.textMuted },
  deltaValue: { fontSize: 18, fontWeight: '800', ...tabularNums },

  chartLoading: { height: 180, alignItems: 'center', justifyContent: 'center' },

  statRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, gap: 3 },
  statLabel: { fontSize: 12, fontWeight: '700', color: T.textMuted },
  statValue: { fontSize: 20, fontWeight: '800', color: T.textPrimary, ...tabularNums },
  statUnit: { fontSize: 13, fontWeight: '600', color: T.textSecondary },
  statDivider: { width: 1, height: 34, backgroundColor: T.divider },

  goalDivider: { height: 1, backgroundColor: T.divider },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: HIT_TARGET },
  goalLabel: { fontSize: 15, fontWeight: '800', color: T.textPrimary },
  goalSub: { fontSize: 13, fontWeight: '600', color: T.textMuted, marginTop: 1 },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: T.textMuted, marginTop: 2 },

  logRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.divider },
  logKg: { flex: 1, fontSize: 15, fontWeight: '700', color: T.textPrimary, ...tabularNums },
  logDate: { fontSize: 13, fontWeight: '600', color: T.textMuted },
  removeBtn: { width: HIT_TARGET, height: HIT_TARGET, alignItems: 'center', justifyContent: 'center', marginRight: -12 },

  footer: { position: 'absolute', left: 16, right: 16, bottom: 20 },
  logBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 16, backgroundColor: T.primary },
  logBtnText: { fontSize: 15, fontWeight: '800', color: T.textOnPrimary },

  modalRoot: { flex: 1, backgroundColor: T.overlay, alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCard: { alignSelf: 'stretch', backgroundColor: T.surface, borderRadius: 22, borderWidth: 1, borderColor: T.border, padding: 22, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: T.textPrimary },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 },
  input: { flex: 1, fontSize: 34, fontWeight: '800', color: T.textPrimary, paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: T.primary },
  inputUnit: { fontSize: 16, fontWeight: '700', color: T.textSecondary, paddingBottom: 12 },
  modalHint: { fontSize: 12, fontWeight: '600', color: T.textMuted },
  modalHintError: { color: T.error },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancel: { flex: 1, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: T.surface2 },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: T.textSecondary },
  modalConfirm: { flex: 1, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: T.primary },
  modalConfirmDisabled: { opacity: 0.4 },
  modalConfirmText: { fontSize: 15, fontWeight: '800', color: T.textOnPrimary },
  modalExtra: { alignItems: 'center', paddingVertical: 6, minHeight: HIT_TARGET, justifyContent: 'center' },
  modalExtraText: { fontSize: 13, fontWeight: '700', color: T.error },
});
