import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { ScanStackParamList } from '../../navigation/ScanNavigator';
import type { FoodItem } from '../../services/api';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { getMealTypeFromTime } from '../../utils/nutrition';
import { useTheme } from '../../hooks/useTheme';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import { PaywallModal } from '../Paywall/PaywallModal';
import { ProGate } from '../../components/ProGate';
import { ScanItemsEditor } from '../../components/ScanItemsEditor';
import { sumItems } from '../../utils/foodItems';
import { uuidv4 } from '../../utils/uuid';
import { useNotificationStore } from '../../store/notificationStore';

type Props = {
  navigation: NativeStackNavigationProp<ScanStackParamList, 'ScanResult'>;
  route: RouteProp<ScanStackParamList, 'ScanResult'>;
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

// Standard GDA (Guide Daily Amounts) for a 2 000 kcal diet
const MACRO_GDA: Record<string, number> = {
  Protein: 50,
  Carbs:   260,
  Fat:     78,
  Fiber:   25,
};

const MACRO_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Protein: 'barbell-outline',
  Carbs:   'restaurant-outline',
  Fat:     'water-outline',
  Fiber:   'leaf-outline',
};

function NutrientRow({ label, value, color }: { label: string; value: number; color: string }) {
  const { theme } = useTheme();
  const gdaPct = Math.round((value / (MACRO_GDA[label] ?? 100)) * 100);
  // Natural reading order: icon → name → amount → share of daily intake.
  return (
    <View style={[rowStyles.row, { borderBottomColor: theme.dividerColor }]}>
      <View style={[rowStyles.iconWrap, { backgroundColor: color + '22' }]}>
        <Ionicons name={MACRO_ICONS[label] ?? 'nutrition-outline'} size={18} color={color} />
      </View>
      <Text style={[rowStyles.macroLabel, { color: theme.textPrimary }]}>{label}</Text>
      <Text style={[rowStyles.amount, { color: theme.textPrimary }]}>
        {Math.round(value)}<Text style={[rowStyles.unit, { color: theme.textSecondary }]}>g</Text>
      </Text>
      <Text style={[rowStyles.gdaLabel, { color: theme.textMuted }]}>{gdaPct}% GDA</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  amount:   { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  unit:     { fontSize: 12, fontWeight: '500' },
  gdaLabel: { fontSize: 12, fontWeight: '600', minWidth: 64, textAlign: 'right' },
});

// Honest confidence labels — no fabricated percentages.
const CONFIDENCE_LABEL: Record<string, string> = {
  very_high: 'Very high match',
  high:      'High match',
  medium:    'Likely match',
  low:       'Low confidence',
};

export function ScanResultScreen({ navigation, route }: Props) {
  const { imageUri, imageStorageUrl, result } = route.params;
  const { session, fetchProfile } = useAuthStore();
  const { addLog } = useFoodLogStore();
  const { theme } = useTheme();
  const { isSubscribed, paywallVisible, showPaywall, dismissPaywall } = useSubscriptionGate();
  const [selectedMeal, setSelectedMeal] = useState<typeof MEAL_TYPES[number]>(getMealTypeFromTime());
  const [isSaving, setIsSaving] = useState(false);

  // The AI proposes items; the user confirms them. Legacy cached scans have no
  // items array, so fall back to a single row built from the top-level totals.
  const [items, setItems] = useState<FoodItem[]>(() =>
    result.items?.length
      ? result.items
      : [{
          name: result.food_name,
          quantity: 1,
          unit: result.portion_g > 0 ? 'g' : 'plate',
          grams: result.portion_g || 100,
          calories: result.calories,
          protein_g: result.protein_g,
          carbs_g: result.carbs_g,
          fat_g: result.fat_g,
          fiber_g: result.fiber_g,
        }],
  );

  // Totals are always derived from the edited items — never the original scan.
  const totals = sumItems(items);

  const handleSave = async () => {
    if (!session?.user.id) return;
    if (items.length === 0) {
      Alert.alert('Nothing to log', 'Add at least one item before logging this meal.');
      return;
    }
    setIsSaving(true);

    try {
      // One row per item — History, macro charts and export gain per-food
      // granularity. A shared meal_id lets History regroup them into one card
      // ("Dinner · 5 items") so the day view stays clean. Only meals with 2+
      // items are grouped; a single item logs ungrouped like a manual entry.
      const loggedAt = new Date().toISOString();
      // Must be a real UUID — `meal_id` is a uuid column. Generated in pure JS
      // so no native module (and therefore no rebuild) is required.
      const mealId = items.length > 1 ? uuidv4() : null;
      const { data, error } = await supabase
        .from('food_logs')
        .insert(
          items.map((it) => ({
            user_id: session.user.id,
            image_url: imageStorageUrl || null,
            meal_id: mealId,
            // food_name is NOT NULL and the name field is user-editable, so a
            // cleared field must not write an empty row.
            food_name: it.name.trim() || 'Food item',
            calories: it.calories,
            protein_g: it.protein_g,
            carbs_g: it.carbs_g,
            fat_g: it.fat_g,
            fiber_g: it.fiber_g,
            meal_type: selectedMeal,
            raw_ai_response: { ...result, logged_item: it, edited: true },
            logged_at: loggedAt,
          })),
        )
        .select();

      if (error) throw error;

      // Increment scan_count
      try {
        await supabase.rpc('increment_scan_count', { user_id: session.user.id });
      } catch {
        // Fallback: direct update
        supabase.from('profiles')
          .update({ scan_count: (useAuthStore.getState().profile?.scan_count ?? 0) + 1 })
          .eq('id', session.user.id);
      }

      (data ?? []).forEach(addLog);
      await fetchProfile();

      // Logged today — push tonight's streak nudge to tomorrow so it only ever
      // fires on days the user actually hasn't logged.
      useNotificationStore.getState().refreshStreakReminder(true);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.getParent()?.navigate('Home');
    } catch (err: any) {
      Alert.alert('Save failed', err.message ?? 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero — a spoken log has no photo, so show a compact banner instead
            of a blank 1:1 image block. */}
        <View style={styles.heroWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.foodImage} />
          ) : (
            <View style={[styles.voiceHero, { backgroundColor: theme.surface, borderColor: theme.borderColor }]}>
              <Ionicons name="mic" size={26} color={theme.primary} />
              <Text style={[styles.voiceHeroText, { color: theme.textSecondary }]}>
                Logged by voice
              </Text>
            </View>
          )}
          <View style={[styles.aiBadge, { backgroundColor: theme.primary + 'EE' }]}>
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={styles.aiBadgeText}>
              {CONFIDENCE_LABEL[result.confidence.toLowerCase()] ?? 'AI estimate'}
            </Text>
          </View>
        </View>

        {/* Result card */}
        <View style={[styles.card, { backgroundColor: theme.surface, shadowColor: theme.primary }]}>

          {/* Name + calories row */}
          <View style={styles.nameRow}>
            <Text style={[styles.foodName, { color: theme.textPrimary }]}>{result.food_name}</Text>
            <View style={styles.calBlock}>
              <Text style={[styles.calories, { color: theme.primary }]}>{totals.calories}</Text>
              <Text style={[styles.kcalUnit, { color: theme.textSecondary }]}>KCAL</Text>
            </View>
          </View>

          {/* Portion the estimate is based on — the biggest source of error, so
              show it plainly rather than hiding the assumption. */}
          {(result.portion_g > 0 || !!result.portion_desc) && (
            <View style={styles.portionRow}>
              <Ionicons name="scale-outline" size={14} color={theme.textMuted} />
              <Text style={[styles.portionText, { color: theme.textSecondary }]}>
                Based on {result.portion_desc || 'the visible portion'}
                {totals.grams > 0 ? ` · ~${totals.grams}g` : ''}
              </Text>
            </View>
          )}

          {!!result.notes && (
            <Text style={[styles.notesText, { color: theme.textMuted }]}>{result.notes}</Text>
          )}

          {/* Editable item list — AI proposes, user confirms */}
          <ScanItemsEditor items={items} onChange={setItems} />

          {/* Meal type chips */}
          <View style={styles.mealChips}>
            {MEAL_TYPES.map((meal) => (
              <TouchableOpacity
                key={meal}
                onPress={() => setSelectedMeal(meal)}
                style={[
                  styles.mealChip,
                  { borderColor: theme.borderColor },
                  selectedMeal === meal && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.mealChipLabel,
                  { color: theme.textSecondary },
                  selectedMeal === meal && { color: '#fff' },
                ]}>
                  {MEAL_LABELS[meal]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Macro rows — Pro Feature */}
          <ProGate isSubscribed={isSubscribed} onUpgrade={showPaywall} label="Full Nutrition Analysis" borderRadius={12}>
            <View style={styles.macroList}>
              <NutrientRow label="Protein" value={totals.protein_g} color={theme.protein} />
              <NutrientRow label="Carbs"   value={totals.carbs_g}   color={theme.carbs} />
              <NutrientRow label="Fat"     value={totals.fat_g}     color={theme.fat} />
              <NutrientRow label="Fiber"   value={totals.fiber_g}   color={theme.fiber} />
            </View>
          </ProGate>
        </View>
      </ScrollView>

      {/* Action buttons */}
      <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.borderColor }]}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={[styles.retakeButton, { borderColor: theme.borderColor }]}
          contentStyle={styles.buttonContent}
          textColor={theme.textSecondary}
          icon="camera-retake-outline"
        >
          Retake
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving}
          style={styles.saveButton}
          contentStyle={styles.buttonContent}
          buttonColor={theme.primary}
          icon="check"
        >
          {items.length > 1 ? `Log ${items.length} items` : 'Log This Meal'}
        </Button>
      </View>

      <PaywallModal visible={paywallVisible} onDismiss={dismissPaywall} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },
  heroWrap: { position: 'relative' },
  foodImage: { width: '100%', aspectRatio: 1, resizeMode: 'cover' },
  voiceHero: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 12,
    paddingVertical: 22, borderRadius: 20, borderWidth: 1,
  },
  voiceHeroText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  aiBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  card: {
    margin: 16,
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  foodName: { flex: 1, fontSize: 22, fontWeight: '800', lineHeight: 28 },
  calBlock: { alignItems: 'flex-end' },
  calories: { fontSize: 40, fontWeight: '800', lineHeight: 44, letterSpacing: -1 },
  kcalUnit: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  portionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  portionText: { fontSize: 13, fontWeight: '600', flex: 1 },
  notesText: { fontSize: 12, lineHeight: 17, fontStyle: 'italic' },
  mealChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  mealChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 50,
    borderWidth: 1,
  },
  mealChipLabel: { fontSize: 13, fontWeight: '700' },
  macroList: { gap: 0 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  retakeButton: { flex: 1 },
  saveButton: { flex: 2, borderRadius: 12 },
  buttonContent: { height: 52 },
});
