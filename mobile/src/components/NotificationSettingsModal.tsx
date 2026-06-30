import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore } from '../store/notificationStore';
import type { MealType } from '../services/notifications';

const C = {
  bg:           '#101415',
  glass:        'rgba(15,23,42,0.80)',
  glassBorder:  'rgba(255,255,255,0.08)',
  primary:      '#85d3da',
  secondary:    '#bdf4ff',
  onSurface:    '#e0e3e5',
  onSurfaceVar: '#bec8c9',
  outline:      '#889393',
  outlineVar:   '#3f4949',
  header:       'rgba(16,20,21,0.88)',
  error:        '#ffb4ab',
};

const MEALS: { type: MealType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { type: 'breakfast', label: 'Breakfast', icon: 'cafe-outline',        color: '#ffd580' },
  { type: 'lunch',     label: 'Lunch',     icon: 'fast-food-outline',   color: '#85d3da' },
  { type: 'dinner',    label: 'Dinner',    icon: 'restaurant-outline',  color: '#c0c1ff' },
  { type: 'snack',     label: 'Snack',     icon: 'nutrition-outline',   color: '#a8d8a8' },
];

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function NotificationSettingsModal({ visible, onDismiss }: Props) {
  const { reminders, toggleReminder, setReminderTime } = useNotificationStore();

  const adjustHour   = (mealType: MealType, delta: number) => {
    const r = reminders[mealType];
    setReminderTime(mealType, (r.hour + delta + 24) % 24, r.minute);
  };
  const adjustMinute = (mealType: MealType, delta: number) => {
    const r = reminders[mealType];
    setReminderTime(mealType, r.hour, (r.minute + delta + 60) % 60);
  };

  const fmt = (h: number, m: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onDismiss}>
      <View style={styles.root}>
        {/* Header */}
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onDismiss} style={styles.backBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={C.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Meal Reminders</Text>
            <View style={{ width: 36 }} />
          </View>
        </SafeAreaView>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.hint}>
            Set daily reminders for each meal. CalSnap will notify you so you never forget to log.
          </Text>

          {MEALS.map((meal) => {
            const config = reminders[meal.type];
            return (
              <View key={meal.type} style={styles.card}>
                {/* Meal header row */}
                <View style={styles.cardHeader}>
                  <View style={[styles.mealIcon, { backgroundColor: meal.color + '22' }]}>
                    <Ionicons name={meal.icon} size={20} color={meal.color} />
                  </View>
                  <Text style={styles.mealLabel}>{meal.label}</Text>
                  <Switch
                    value={config.enabled}
                    onValueChange={() => toggleReminder(meal.type)}
                    trackColor={{ false: C.outlineVar, true: C.primary + '66' }}
                    thumbColor={config.enabled ? C.primary : C.outline}
                  />
                </View>

                {/* Time picker (only when enabled) */}
                {config.enabled && (
                  <View style={styles.timePicker}>
                    <Text style={styles.timeDisplay}>{fmt(config.hour, config.minute)}</Text>
                    <View style={styles.timeControls}>
                      {/* Hour */}
                      <View style={styles.timeUnit}>
                        <TouchableOpacity style={styles.arrowBtn} onPress={() => adjustHour(meal.type, 1)}>
                          <Ionicons name="chevron-up" size={18} color={C.primary} />
                        </TouchableOpacity>
                        <Text style={styles.timeNumber}>{config.hour.toString().padStart(2, '0')}</Text>
                        <TouchableOpacity style={styles.arrowBtn} onPress={() => adjustHour(meal.type, -1)}>
                          <Ionicons name="chevron-down" size={18} color={C.primary} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.timeSep}>:</Text>
                      {/* Minute */}
                      <View style={styles.timeUnit}>
                        <TouchableOpacity style={styles.arrowBtn} onPress={() => adjustMinute(meal.type, 15)}>
                          <Ionicons name="chevron-up" size={18} color={C.primary} />
                        </TouchableOpacity>
                        <Text style={styles.timeNumber}>{config.minute.toString().padStart(2, '0')}</Text>
                        <TouchableOpacity style={styles.arrowBtn} onPress={() => adjustMinute(meal.type, -15)}>
                          <Ionicons name="chevron-down" size={18} color={C.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.stepHint}>15-min steps</Text>
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
  root: { flex: 1, backgroundColor: C.bg },

  headerSafe: { zIndex: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: C.header,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.onSurface },

  scroll: { flex: 1 },
  content: { padding: 20, gap: 14 },

  hint: {
    fontSize: 13,
    color: C.onSurfaceVar,
    lineHeight: 20,
    marginBottom: 4,
  },

  card: {
    backgroundColor: C.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  mealIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  mealLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: C.onSurface },

  timePicker: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12,
  },
  timeDisplay: {
    fontSize: 28,
    fontWeight: '800',
    color: C.primary,
    letterSpacing: 1,
  },
  timeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeUnit: { alignItems: 'center', gap: 4 },
  arrowBtn: {
    width: 36, height: 32,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(133,211,218,0.1)',
    borderRadius: 8,
  },
  timeNumber: { fontSize: 22, fontWeight: '700', color: C.onSurface, minWidth: 36, textAlign: 'center' },
  timeSep: { fontSize: 24, fontWeight: '700', color: C.outline, marginBottom: 4 },
  stepHint: { fontSize: 10, color: C.outline, letterSpacing: 1, textTransform: 'uppercase' },
});
