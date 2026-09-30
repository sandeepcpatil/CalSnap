import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore } from '../store/notificationStore';
import type { MealType } from '../services/notifications';
import { ModalHeader } from './ModalHeader';
import { T, withAlpha, spacing, radius, HIT_TARGET, tabularNums } from '../theme';

const MEALS: { type: MealType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { type: 'breakfast', label: 'Breakfast', icon: 'cafe-outline',        color: T.mealBreakfast },
  { type: 'lunch',     label: 'Lunch',     icon: 'fast-food-outline',   color: T.mealLunch },
  { type: 'dinner',    label: 'Dinner',    icon: 'restaurant-outline',  color: T.mealDinner },
  { type: 'snack',     label: 'Snack',     icon: 'nutrition-outline',   color: T.mealSnack },
];

/** Times most people actually eat at — one tap instead of eight arrow presses. */
const COMMON_TIMES: { hour: number; minute: number }[] = [
  { hour: 7, minute: 0 },
  { hour: 8, minute: 0 },
  { hour: 12, minute: 30 },
  { hour: 13, minute: 0 },
  { hour: 19, minute: 0 },
  { hour: 20, minute: 0 },
];

const MINUTE_STEP = 15;

const SWITCH_TRACK = { false: T.surface2, true: withAlpha(T.primary, 0.4) };

const pad2 = (n: number) => n.toString().padStart(2, '0');
const hour12 = (h: number) => h % 12 || 12;
const meridiem = (h: number) => (h >= 12 ? 'PM' : 'AM');
/** "8:00 AM" — the one format the display, the stepper and the chips share. */
const fmt12 = (h: number, m: number) => `${hour12(h)}:${pad2(m)} ${meridiem(h)}`;

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function NotificationSettingsModal({ visible, onDismiss }: Props) {
  const {
    reminders, toggleReminder, setReminderTime,
    streakReminderEnabled, toggleStreakReminder,
    waterReminderEnabled, toggleWaterReminder,
    weighInReminderEnabled, toggleWeighInReminder,
  } = useNotificationStore();

  const handleToggle = async (mealType: MealType) => {
    const result = await toggleReminder(mealType);
    if (result.ok) return;

    if (result.reason === 'permission_denied') {
      Alert.alert(
        'Notifications are turned off',
        'To get meal reminders, allow notifications for CalVue in your device settings.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => Linking.openSettings() },
        ],
      );
    } else {
      Alert.alert("Couldn't set reminder", 'Something went wrong scheduling this reminder. Please try again.');
    }
  };

  const handleTogglePreset = async (toggle: () => Promise<{ ok: boolean; reason?: string }>, what: string) => {
    const result = await toggle();
    if (result.ok) return;
    if (result.reason === 'permission_denied') {
      Alert.alert(
        'Notifications are turned off',
        `To get ${what}, allow notifications for CalVue in your device settings.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => Linking.openSettings() },
        ],
      );
    } else {
      Alert.alert("Couldn't update", 'Something went wrong. Please try again.');
    }
  };
  const handleStreakToggle = () => handleTogglePreset(toggleStreakReminder, 'streak reminders');
  const handleWaterToggle = () => handleTogglePreset(toggleWaterReminder, 'water reminders');
  const handleWeighInToggle = () => handleTogglePreset(toggleWeighInReminder, 'weigh-in reminders');

  const adjustHour = (mealType: MealType, delta: number) => {
    const r = reminders[mealType];
    setReminderTime(mealType, (r.hour + delta + 24) % 24, r.minute);
  };
  const adjustMinute = (mealType: MealType, delta: number) => {
    const r = reminders[mealType];
    setReminderTime(mealType, r.hour, (r.minute + delta + 60) % 60);
  };
  const toggleMeridiem = (mealType: MealType) => adjustHour(mealType, 12);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onDismiss}>
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <ModalHeader title="Reminders" onClose={onDismiss} />
        </SafeAreaView>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.hint}>
            Gentle nudges so you never forget to log. Meal reminders skip a meal you've already
            logged, and water reminders stop once you hit your goal for the day.
          </Text>

          {/* Streak nudge — on by default, but switchable so nobody has to
              disable every CalVue notification just to silence this one. */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.mealIcon, { backgroundColor: T.warningTint }]}>
                <Ionicons name="flame-outline" size={20} color={T.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mealLabel}>Streak reminder</Text>
                <Text style={styles.streakSub}>
                  8:00 PM, only on days you haven't logged
                </Text>
              </View>
              <Switch
                value={streakReminderEnabled}
                onValueChange={handleStreakToggle}
                trackColor={SWITCH_TRACK}
                thumbColor={streakReminderEnabled ? T.primary : T.textMuted}
                accessibilityLabel="Streak reminder"
              />
            </View>
          </View>

          {/* Water — paced through the day, stops once the goal is met. */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.mealIcon, { backgroundColor: T.primaryTint }]}>
                <Ionicons name="water-outline" size={20} color={T.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mealLabel}>Water reminder</Text>
                <Text style={styles.streakSub}>
                  A few nudges a day, only until you hit your goal
                </Text>
              </View>
              <Switch
                value={waterReminderEnabled}
                onValueChange={handleWaterToggle}
                trackColor={SWITCH_TRACK}
                thumbColor={waterReminderEnabled ? T.primary : T.textMuted}
                accessibilityLabel="Water reminder"
              />
            </View>
          </View>

          {/* Weekly weigh-in — anchored to your last weigh-in. */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.mealIcon, { backgroundColor: withAlpha(T.protein, 0.14) }]}>
                <Ionicons name="scale-outline" size={20} color={T.protein} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mealLabel}>Weigh-in reminder</Text>
                <Text style={styles.streakSub}>
                  Weekly nudge, skipped the week you've already weighed in
                </Text>
              </View>
              <Switch
                value={weighInReminderEnabled}
                onValueChange={handleWeighInToggle}
                trackColor={SWITCH_TRACK}
                thumbColor={weighInReminderEnabled ? T.primary : T.textMuted}
                accessibilityLabel="Weigh-in reminder"
              />
            </View>
          </View>

          {MEALS.map((meal) => {
            const config = reminders[meal.type];
            return (
              <View key={meal.type} style={styles.card}>
                {/* Meal header row */}
                <View style={styles.cardHeader}>
                  <View style={[styles.mealIcon, { backgroundColor: withAlpha(meal.color, 0.14) }]}>
                    <Ionicons name={meal.icon} size={20} color={meal.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mealLabel}>{meal.label}</Text>
                    {config.enabled && (
                      <Text style={styles.streakSub}>Reminder at {fmt12(config.hour, config.minute)}</Text>
                    )}
                  </View>
                  <Switch
                    value={config.enabled}
                    onValueChange={() => handleToggle(meal.type)}
                    trackColor={SWITCH_TRACK}
                    thumbColor={config.enabled ? T.primary : T.textMuted}
                    accessibilityLabel={`${meal.label} reminder`}
                  />
                </View>

                {/* Time control (only when enabled) */}
                {config.enabled && (
                  <View style={styles.timePicker}>
                    <View style={styles.chipRow}>
                      {COMMON_TIMES.map((t) => {
                        const active = t.hour === config.hour && t.minute === config.minute;
                        return (
                          <TouchableOpacity
                            key={`${t.hour}:${t.minute}`}
                            style={[styles.timeChip, active && styles.timeChipActive]}
                            onPress={() => setReminderTime(meal.type, t.hour, t.minute)}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`Set ${meal.label} reminder to ${fmt12(t.hour, t.minute)}`}
                          >
                            <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>
                              {fmt12(t.hour, t.minute)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={styles.timeDisplay} accessibilityLiveRegion="polite">
                      {fmt12(config.hour, config.minute)}
                    </Text>

                    <View style={styles.timeControls}>
                      {/* Hour */}
                      <View style={styles.timeUnit}>
                        <TouchableOpacity
                          style={styles.arrowBtn}
                          onPress={() => adjustHour(meal.type, 1)}
                          accessibilityRole="button"
                          accessibilityLabel="One hour later"
                        >
                          <Ionicons name="chevron-up" size={20} color={T.primary} />
                        </TouchableOpacity>
                        <Text style={styles.timeNumber}>{hour12(config.hour)}</Text>
                        <TouchableOpacity
                          style={styles.arrowBtn}
                          onPress={() => adjustHour(meal.type, -1)}
                          accessibilityRole="button"
                          accessibilityLabel="One hour earlier"
                        >
                          <Ionicons name="chevron-down" size={20} color={T.primary} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.timeSep}>:</Text>
                      {/* Minute */}
                      <View style={styles.timeUnit}>
                        <TouchableOpacity
                          style={styles.arrowBtn}
                          onPress={() => adjustMinute(meal.type, MINUTE_STEP)}
                          accessibilityRole="button"
                          accessibilityLabel={`${MINUTE_STEP} minutes later`}
                        >
                          <Ionicons name="chevron-up" size={20} color={T.primary} />
                        </TouchableOpacity>
                        <Text style={styles.timeNumber}>{pad2(config.minute)}</Text>
                        <TouchableOpacity
                          style={styles.arrowBtn}
                          onPress={() => adjustMinute(meal.type, -MINUTE_STEP)}
                          accessibilityRole="button"
                          accessibilityLabel={`${MINUTE_STEP} minutes earlier`}
                        >
                          <Ionicons name="chevron-down" size={20} color={T.primary} />
                        </TouchableOpacity>
                      </View>
                      {/* AM / PM */}
                      <TouchableOpacity
                        style={styles.meridiemBtn}
                        onPress={() => toggleMeridiem(meal.type)}
                        accessibilityRole="button"
                        accessibilityLabel={`Switch to ${meridiem(config.hour) === 'AM' ? 'PM' : 'AM'}`}
                      >
                        <Text style={styles.meridiemText}>{meridiem(config.hour)}</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.stepHint}>Minutes move in {MINUTE_STEP}-minute steps</Text>
                  </View>
                )}
              </View>
            );
          })}

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  headerSafe: { zIndex: 10, backgroundColor: T.bg },

  scroll: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.md },

  hint: {
    fontSize: 15,
    color: T.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },

  card: {
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  mealIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  mealLabel: { fontSize: 16, fontWeight: '600', color: T.textPrimary },
  streakSub: { fontSize: 13, lineHeight: 18, color: T.textSecondary, marginTop: 2 },

  timePicker: {
    borderTopWidth: 1,
    borderTopColor: T.divider,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  timeChip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    justifyContent: 'center',
  },
  timeChipActive: { backgroundColor: T.primaryTint, borderColor: T.primaryBorder },
  timeChipText: { fontSize: 13, fontWeight: '700', color: T.textSecondary, ...tabularNums },
  timeChipTextActive: { color: T.primary },
  timeDisplay: {
    fontSize: 28,
    fontWeight: '800',
    color: T.primary,
    ...tabularNums,
  },
  timeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeUnit: { alignItems: 'center', gap: spacing.xs },
  arrowBtn: {
    width: HIT_TARGET, height: HIT_TARGET,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.primaryTint,
    borderRadius: radius.sm,
  },
  timeNumber: { fontSize: 22, fontWeight: '700', color: T.textPrimary, minWidth: 40, textAlign: 'center', ...tabularNums },
  timeSep: { fontSize: 24, fontWeight: '700', color: T.textMuted, marginBottom: spacing.xs },
  meridiemBtn: {
    minWidth: HIT_TARGET + 8,
    height: HIT_TARGET,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  meridiemText: { fontSize: 15, fontWeight: '700', color: T.textPrimary },
  stepHint: { fontSize: 12, color: T.textMuted },
});
