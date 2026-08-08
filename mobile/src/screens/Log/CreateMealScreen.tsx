import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { useNotificationStore } from '../../store/notificationStore';
import { ScanItemsEditor } from '../../components/ScanItemsEditor';
import { sumItems } from '../../utils/foodItems';
import { getMealTypeFromTime } from '../../utils/nutrition';
import { logFoodItems, type MealType } from '../../services/foodLogs';
import { MealTypePicker } from '../../components/MealTypePicker';
import {
  createSavedMeal,
  updateSavedMeal,
  deleteSavedMeal,
  touchSavedMeal,
  MAX_MEAL_NAME_LENGTH,
  type SavedMeal,
} from '../../services/savedMeals';
import type { FoodItem } from '../../services/api';
import { T } from '../../theme';

interface Props {
  navigation: { goBack: () => void };
  route: { params?: { meal?: SavedMeal } };
}

/**
 * Build or edit a named meal — "my usual breakfast" = 2 idli + sambar + coffee.
 *
 * The item list is the same `ScanItemsEditor` the scan result uses, so portions
 * behave identically whether a food arrived from the camera or from here, and
 * there is only one place to fix when that behaviour changes.
 */
export function CreateMealScreen({ navigation, route }: Props) {
  const existing = route.params?.meal;
  const { session } = useAuthStore();
  const addLog = useFoodLogStore((s) => s.addLog);

  const [name, setName] = useState(existing?.name ?? '');
  const [items, setItems] = useState<FoodItem[]>(existing?.items ?? []);
  const [busy, setBusy] = useState<'save' | 'log' | null>(null);
  const [mealType, setMealType] = useState<MealType>(getMealTypeFromTime());

  const totals = sumItems(items);
  const userId = session?.user.id;
  const canSave = name.trim().length > 0 && items.length > 0 && busy === null;

  const persist = useCallback(async (): Promise<SavedMeal | null> => {
    if (!userId) return null;
    if (existing) {
      await updateSavedMeal(existing.id, name, items);
      return { ...existing, name: name.trim(), items };
    }
    return createSavedMeal(userId, name, items);
  }, [userId, existing, name, items]);

  const handleSaveOnly = async () => {
    if (!canSave) return;
    setBusy('save');
    try {
      await persist();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleSaveAndLog = async () => {
    if (!canSave || !userId) return;
    setBusy('log');
    try {
      // Save first. If the log succeeded but the save failed, the user would be
      // told the meal was saved when it wasn't — and would find nothing here
      // next time.
      const saved = await persist();

      const rows = await logFoodItems({
        userId,
        items,
        mealType,
        source: { origin: 'saved-meal', saved_meal_name: name.trim() },
      });
      rows.forEach(addLog);
      if (saved) touchSavedMeal(saved.id);

      const notif = useNotificationStore.getState();
      void notif.refreshStreakReminder(true);
      // First log ever → offer to turn on reminders (self-gates to once).
      void notif.promptForRemindersOnce();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not log', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert('Delete meal?', `“${existing.name}” will be removed. Past logs are not affected.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSavedMeal(existing.id);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Could not delete', err instanceof Error ? err.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={navigation.goBack}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={T.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{existing ? 'Edit meal' : 'Create a meal'}</Text>
        {existing ? (
          <TouchableOpacity
            onPress={handleDelete}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Delete this meal"
          >
            <Ionicons name="trash-outline" size={20} color={T.error} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="My usual breakfast"
            placeholderTextColor={T.textMuted}
            style={styles.nameInput}
            maxLength={MAX_MEAL_NAME_LENGTH}
            autoFocus={!existing}
            returnKeyType="done"
          />

          {/* Same editor as the scan result — add, re-portion and remove. */}
          <ScanItemsEditor
            items={items}
            onChange={setItems}
            heading="ITEMS IN THIS MEAL"
            addLabel="Add a food"
          />
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.totalsRow}>
            <View>
              <Text style={styles.totalsLabel}>Per serving</Text>
              <Text style={styles.totalsKcal}>
                {totals.calories}<Text style={styles.totalsKcalUnit}> kcal</Text>
              </Text>
            </View>
            <View style={styles.macroRow}>
              <Macro value={`${totals.protein_g}g`} label="PROTEIN" color={T.protein} />
              <Macro value={`${totals.carbs_g}g`} label="CARBS" color={T.carbs} />
              <Macro value={`${totals.fat_g}g`} label="FAT" color={T.fat} />
            </View>
          </View>

          {/* Which meal "Save & log" writes to. Ignored by "Save only". */}
          <MealTypePicker value={mealType} onChange={setMealType} />

          <View style={styles.actions}>
            {/* Two exits that matter: "Save only" for setting up ahead of time,
                "Save & log" for someone building it while eating. */}
            <TouchableOpacity
              style={[styles.secondaryBtn, !canSave && styles.btnDisabled]}
              onPress={handleSaveOnly}
              disabled={!canSave}
              activeOpacity={0.85}
            >
              {busy === 'save' ? (
                <ActivityIndicator size={15} color={T.textPrimary} />
              ) : (
                <Text style={styles.secondaryText}>Save only</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, !canSave && styles.btnDisabled]}
              onPress={handleSaveAndLog}
              disabled={!canSave}
              activeOpacity={0.85}
            >
              {busy === 'log' ? (
                <ActivityIndicator size={15} color={T.textOnPrimary} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={17} color={T.textOnPrimary} />
                  <Text style={styles.primaryText}>Save &amp; log</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Macro({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={styles.macro}>
      <Text style={[styles.macroValue, { color }]}>{value}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.2 },

  scroll: { padding: 16, paddingBottom: 24, gap: 10 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: T.textMuted,
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '700',
    color: T.textPrimary,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 6,
  },

  footer: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: T.surface,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 14,
  },
  totalsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  totalsLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.textMuted,
  },
  totalsKcal: { fontSize: 30, fontWeight: '800', color: T.textPrimary, letterSpacing: -1 },
  totalsKcalUnit: { fontSize: 14, fontWeight: '600', color: T.textSecondary, letterSpacing: 0 },
  macroRow: { flexDirection: 'row', gap: 16 },
  macro: { alignItems: 'flex-end', gap: 1 },
  macroValue: { fontSize: 15, fontWeight: '800' },
  macroLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8, color: T.textMuted },

  actions: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  secondaryText: { fontSize: 14.5, fontWeight: '700', color: T.textPrimary },
  primaryBtn: {
    flex: 1.4,
    flexDirection: 'row',
    height: 50,
    gap: 7,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primary,
  },
  primaryText: { fontSize: 14.5, fontWeight: '800', color: T.textOnPrimary },
  btnDisabled: { opacity: 0.45 },
});
