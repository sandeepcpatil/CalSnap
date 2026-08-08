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
import { WeightChart } from '../../components/WeightChart';
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
import { T } from '../../theme';

interface Props {
  navigation: { goBack: () => void };
}

const MIN_KG = 20;
const MAX_KG = 500;
const PROJECTION_DAYS = 28;

function parseKg(text: string): number | null {
  const n = Number(text);
  if (!Number.isFinite(n) || n <= MIN_KG || n >= MAX_KG) return null;
  return Math.round(n * 10) / 10;
}

function niceDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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

  const chartWidth = Dimensions.get('window').width - 32 - 32; // screen − scroll pad − card pad

  const openLog = () => {
    setLogText(current != null ? String(current) : '');
    setLogOpen(true);
  };

  const submitLog = async () => {
    if (!userId) return;
    const kg = parseKg(logText);
    if (kg == null) { Alert.alert('Enter a valid weight', `Weight should be between ${MIN_KG} and ${MAX_KG} kg.`); return; }
    setBusy(true);
    try {
      await addWeight(userId, kg);
      // Push the weekly weigh-in nudge out a week now that they've weighed in.
      void useNotificationStore.getState().syncReminders();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLogOpen(false);
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
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
    if (kg == null) { Alert.alert('Enter a valid weight', `Goal should be between ${MIN_KG} and ${MAX_KG} kg.`); return; }
    setTargetOpen(false);
    await updateProfile({ target_weight_kg: kg });
  };

  const clearTarget = async () => {
    setTargetOpen(false);
    await updateProfile({ target_weight_kg: null });
  };

  const confirmRemove = (id: string, kg: number, at: string) => {
    Alert.alert('Remove this weigh-in?', `${formatKg(kg)} on ${niceDate(at)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeWeight(id).catch(() => {}) },
    ]);
  };

  const recent = [...logs].sort((a, b) => b.logged_at.localeCompare(a.logged_at)).slice(0, 20);

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
                <Text style={styles.deltaLabel}>{series.length}-reading change</Text>
                <Text style={[styles.deltaValue, { color: change <= 0 ? T.success : T.warning }]}>
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
              <Text style={styles.statValue}>{rate != null ? formatDeltaKg(rate).replace(' kg', '') : '—'}<Text style={styles.statUnit}> kg/wk</Text></Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>In 4 weeks</Text>
              <Text style={styles.statValue}>{projected != null ? formatKg(projected) : '—'}</Text>
            </View>
          </View>

          <View style={styles.goalDivider} />

          {/* Goal weight + ETA */}
          <TouchableOpacity style={styles.goalRow} onPress={openTarget} activeOpacity={0.8}>
            <Ionicons name="flag-outline" size={16} color={T.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.goalLabel}>
                {target != null ? `Goal · ${formatKg(target)}` : 'Set a goal weight'}
              </Text>
              <Text style={styles.goalSub}>
                {target == null
                  ? 'Add a target to see how long it will take'
                  : eta == null
                    ? series.length < 2
                      ? 'Log a few more weigh-ins for a projection'
                      : 'Trending away from your goal right now'
                    : eta === 0
                      ? "You're at your goal 🎉"
                      : `About ${etaLabel(eta)} at this rate`}
              </Text>
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
                  <Text style={styles.logDate}>{niceDate(l.logged_at)}</Text>
                  <TouchableOpacity
                    onPress={() => confirmRemove(l.id, l.weight_kg, l.logged_at)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${formatKg(l.weight_kg)}`}
                  >
                    <Ionicons name="close" size={17} color={T.textMuted} />
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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />
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
              onSubmitEditing={onSubmit}
              returnKeyType="done"
            />
            <Text style={styles.inputUnit}>kg</Text>
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={onCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalConfirm, (!value || busy) && styles.modalConfirmDisabled]} onPress={onSubmit} disabled={!value || busy}>
              <Text style={styles.modalConfirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
          {extra && (
            <TouchableOpacity style={styles.modalExtra} onPress={extra.onPress}>
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
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.2 },

  scroll: { padding: 16, gap: 14 },

  card: { borderRadius: 18, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, padding: 16, gap: 14 },

  currentRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  currentLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: T.textMuted },
  currentValue: { fontSize: 34, fontWeight: '800', color: T.textPrimary, letterSpacing: -1 },
  deltaBlock: { alignItems: 'flex-end', gap: 2 },
  deltaLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: T.textMuted },
  deltaValue: { fontSize: 18, fontWeight: '800' },

  chartLoading: { height: 180, alignItems: 'center', justifyContent: 'center' },

  statRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, gap: 3 },
  statLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: T.textMuted },
  statValue: { fontSize: 20, fontWeight: '800', color: T.textPrimary },
  statUnit: { fontSize: 12, fontWeight: '600', color: T.textSecondary },
  statDivider: { width: 1, height: 34, backgroundColor: T.divider },

  goalDivider: { height: 1, backgroundColor: T.divider },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalLabel: { fontSize: 14.5, fontWeight: '800', color: T.textPrimary },
  goalSub: { fontSize: 12.5, fontWeight: '600', color: T.textMuted, marginTop: 1 },

  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: T.textMuted, marginTop: 2 },

  logRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.divider },
  logKg: { flex: 1, fontSize: 15, fontWeight: '700', color: T.textPrimary },
  logDate: { fontSize: 12.5, fontWeight: '600', color: T.textMuted },

  footer: { position: 'absolute', left: 16, right: 16, bottom: 20 },
  logBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 16, backgroundColor: T.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  logBtnText: { fontSize: 15, fontWeight: '800', color: T.textOnPrimary },

  modalRoot: { flex: 1, backgroundColor: T.overlay, alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCard: { alignSelf: 'stretch', backgroundColor: T.surface, borderRadius: 22, borderWidth: 1, borderColor: T.border, padding: 22, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: T.textPrimary },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 },
  input: { flex: 1, fontSize: 34, fontWeight: '800', color: T.textPrimary, paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: T.primary },
  inputUnit: { fontSize: 16, fontWeight: '700', color: T.textSecondary, paddingBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancel: { flex: 1, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: T.surface2 },
  modalCancelText: { fontSize: 14.5, fontWeight: '700', color: T.textSecondary },
  modalConfirm: { flex: 1, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: T.primary },
  modalConfirmDisabled: { opacity: 0.4 },
  modalConfirmText: { fontSize: 14.5, fontWeight: '800', color: T.textOnPrimary },
  modalExtra: { alignItems: 'center', paddingVertical: 6 },
  modalExtraText: { fontSize: 13, fontWeight: '700', color: T.error },
});
