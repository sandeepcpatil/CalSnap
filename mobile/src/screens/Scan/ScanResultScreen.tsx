import React, { useEffect, useRef, useState } from 'react';
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
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { FoodItem } from '../../services/api';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { toast } from '../../store/toastStore';
import { getMealTypeFromTime } from '../../utils/nutrition';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import { PaywallModal } from '../Paywall/PaywallModal';
import { ProGate } from '../../components/ProGate';
import { ScanItemsEditor } from '../../components/ScanItemsEditor';
import { MealTypePicker } from '../../components/MealTypePicker';
import { formatDuration } from '../../components/VoiceModePanel';
import { rescaleItem, sumItems } from '../../utils/foodItems';
import { getUsualPortions, normaliseFoodName, type UsualPortion } from '../../services/recentFoods';
import { logFoodItems, type MealType } from '../../services/foodLogs';
import { useNotificationStore } from '../../store/notificationStore';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { T, withAlpha, type, spacing, radius, HIT_TARGET, tabularNums } from '../../theme';

type Props = {
  navigation: NativeStackNavigationProp<ScanStackParamList, 'ScanResult'>;
  route: RouteProp<ScanStackParamList, 'ScanResult'>;
};

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

// Reference daily amounts for a 2,000 kcal day.
const MACRO_GDA: Record<string, number> = {
  Protein: 50,
  Carbs:   260,
  Fat:     78,
  Fiber:   25,
  Sugar:   50,
  'Saturated fat': 20,
  Sodium:  2300, // mg
};

const MACRO_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Protein: 'barbell-outline',
  Carbs:   'restaurant-outline',
  Fat:     'water-outline',
  Fiber:   'leaf-outline',
  Sugar:   'cube-outline',
  'Saturated fat': 'flame-outline',
  Sodium:  'egg-outline',
};

function NutrientRow({ label, value, color, unit = 'g' }: { label: string; value: number; color: string; unit?: string }) {
  const gdaPct = Math.round((value / (MACRO_GDA[label] ?? 100)) * 100);
  return (
    <View style={rowStyles.row}>
      <View style={[rowStyles.iconWrap, { backgroundColor: withAlpha(color, 0.14) }]}>
        <Ionicons name={MACRO_ICONS[label] ?? 'nutrition-outline'} size={18} color={color} />
      </View>
      <View style={rowStyles.text}>
        <Text style={rowStyles.macroLabel}>{label}</Text>
        <Text style={rowStyles.gdaLabel}>{gdaPct}% of a 2,000 kcal day</Text>
      </View>
      <Text style={rowStyles.amount}>
        {Math.round(value)}<Text style={rowStyles.unit}> {unit}</Text>
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.divider,
    gap: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 1 },
  macroLabel: { ...type.body, fontWeight: '600', color: T.textPrimary },
  gdaLabel: { ...type.bodySm, color: T.textMuted },
  amount:   { fontSize: 20, fontWeight: '800', lineHeight: 24, color: T.textPrimary, ...tabularNums },
  unit:     { ...type.bodySm, color: T.textSecondary },
});

// Honest confidence: a label and a colour, no fabricated percentages.
type ConfidenceStyle = {
  label: string;
  bg: string;
  fg: string;
  icon: keyof typeof Ionicons.glyphMap;
};
const CONFIDENCE: Record<string, ConfidenceStyle> = {
  high:      { label: 'High confidence', bg: T.successTint, fg: T.success, icon: 'checkmark-circle' },
  very_high: { label: 'High confidence', bg: T.successTint, fg: T.success, icon: 'checkmark-circle' },
  medium:    { label: 'Likely match', bg: T.surface2, fg: T.textSecondary, icon: 'information-circle' },
  low:       { label: 'Low confidence', bg: T.warningTint, fg: T.warning, icon: 'alert-circle' },
};

/** "Was this estimate right?" answers, in the order they are shown. */
type Verdict = 'right' | 'close' | 'wrong';
const VERDICTS: readonly { value: Verdict; label: string }[] = [
  { value: 'right', label: 'Right' },
  { value: 'close', label: 'Close' },
  { value: 'wrong', label: 'Wrong' },
];

/** A usual portion is only worth suggesting when it is clearly different. */
const USUAL_DIFF_THRESHOLD = 0.15;

/** "1.5 katori (270 g)" or, for gram-based portions, "270 g". */
function usualLabel(u: UsualPortion): string {
  if (u.unit === 'g') return `${u.grams} g`;
  return `${u.quantity} ${u.unit} (${u.grams} g)`;
}

/**
 * How many of the final items differ from what the AI proposed, by name or
 * portion. An item with no original of the same name and weight counts as
 * edited, which also covers additions.
 */
function countEdited(original: readonly FoodItem[], final: readonly FoodItem[]): number {
  const seen = new Set(original.map((it) => `${normaliseFoodName(it.name)}|${it.grams}`));
  return final.filter((it) => !seen.has(`${normaliseFoodName(it.name)}|${it.grams}`)).length;
}

export function ScanResultScreen({ navigation, route }: Props) {
  const { imageUri, imageStorageUrl, result, voice } = route.params;
  const { session, fetchProfile } = useAuthStore();
  const { addLog, removeLog } = useFoodLogStore();
  const { isSubscribed, paywallVisible, showPaywall, dismissPaywall } = useSubscriptionGate();
  const [selectedMeal, setSelectedMeal] = useState<MealType>(getMealTypeFromTime());
  const [isSaving, setIsSaving] = useState(false);
  // "Was this estimate right?" Held locally and written with the save, never
  // on its own, so an abandoned scan leaves no row.
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  // Portion memory: the user's most-logged portion per item name, and the
  // names whose suggestion was used.
  const [usualPortions, setUsualPortions] = useState<Record<string, UsualPortion>>({});
  const [usualHidden, setUsualHidden] = useState<Set<string>>(() => new Set());

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
          sodium_mg: result.sodium_mg ?? 0,
          sugar_g: result.sugar_g ?? 0,
          sat_fat_g: result.sat_fat_g ?? 0,
        }],
  );

  // What the AI proposed, frozen, so the saved feedback can say how far the
  // user moved from it.
  const originalItems = useRef<readonly FoodItem[]>(items);

  useEffect(() => {
    const userId = session?.user.id;
    const names = originalItems.current.map((it) => it.name);
    if (!userId || names.length === 0) return;
    let cancelled = false;
    getUsualPortions(userId, names)
      .then((found) => { if (!cancelled) setUsualPortions(found); })
      .catch((err: unknown) => console.warn('[scan-result] usual portions failed', err instanceof Error ? err.message : err));
    return () => { cancelled = true; };
  }, [session?.user.id]);

  /** The usual portion worth offering for an item, or null when none applies. */
  const usualFor = (item: FoodItem): UsualPortion | null => {
    const key = normaliseFoodName(item.name);
    const usual = usualPortions[key];
    if (!usual || usualHidden.has(key) || item.grams <= 0) return null;
    const diff = Math.abs(usual.grams - item.grams) / item.grams;
    return diff > USUAL_DIFF_THRESHOLD ? usual : null;
  };

  /** Apply a usual portion to one item: the same proportional rescale the portion sheet uses. */
  const applyUsual = (index: number, usual: UsualPortion) => {
    Haptics.selectionAsync();
    setItems(items.map((it, i) => {
      if (i !== index) return it;
      // Scale to the exact weight shown on the chip, then keep the household
      // unit it was logged in so the row reads "1.5 katori (270 g)".
      const scaled = rescaleItem(it, usual.grams, 'g');
      return { ...scaled, quantity: usual.quantity, unit: usual.unit };
    }));
    setUsualHidden((prev) => new Set(prev).add(normaliseFoodName(items[index].name)));
  };

  const chooseVerdict = (value: Verdict) => {
    Haptics.selectionAsync();
    setVerdict(value);
  };

  /**
   * Record the verdict alongside the save. Counts only; a failure is logged
   * and otherwise ignored, because feedback must never cost a meal.
   */
  const submitFeedback = async (userId: string, finalItems: readonly FoodItem[], chosen: Verdict) => {
    const original = originalItems.current;
    const { error } = await supabase.from('scan_feedback').insert({
      user_id: userId,
      mode: voice ? 'voice' : 'meal',
      confidence: result.confidence ? String(result.confidence) : null,
      verdict: chosen,
      items_total: finalItems.length,
      items_edited: countEdited(original, finalItems),
      kcal_ai: sumItems(original).calories,
      kcal_final: sumItems(finalItems).calories,
    });
    if (error) console.warn('[scan-result] feedback insert failed', error.message);
  };

  // Explicit hardware-back handling. ScanResult sits inside a nested stack, and
  // relying on the press bubbling correctly is what let it fall through to
  // Android's default (close the app). Back = the previous step, i.e. Retake.
  useAndroidBack(
    React.useCallback(() => {
      if (isSaving) return true;
      navigation.goBack();
      return true;
    }, [isSaving, navigation]),
  );

  const goHome = React.useCallback(() => {
    // Pop the whole Scan stack off the root navigator and land on Home, so
    // the day's updated ring is the first thing seen. Popping the parent
    // unmounts this screen too; otherwise re-opening the camera would show
    // the meal that was just logged.
    navigation
      .getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.navigate('Main', { screen: 'Home' });
  }, [navigation]);

  // Totals are always derived from the edited items, never the original scan.
  const totals = sumItems(items);
  const confidence = CONFIDENCE[String(result.confidence).toLowerCase()] ?? CONFIDENCE.medium;

  /** Undo a just-saved meal: drop the rows locally and on the server. */
  const undoLog = async (ids: string[]) => {
    if (!session?.user.id) return;
    ids.forEach(removeLog);
    const { error } = await supabase
      .from('food_logs')
      .delete()
      .in('id', ids)
      .eq('user_id', session.user.id);
    if (error) {
      console.warn('[scan-result] undo delete failed', error.message);
      Alert.alert("Couldn't undo", 'That meal is still logged. You can delete it from your history.');
      return;
    }
    void fetchProfile();
  };

  const handleSave = async () => {
    if (!session?.user.id) return;
    if (items.length === 0) {
      Alert.alert('Nothing to log', 'Add at least one item before logging this meal.');
      return;
    }
    setIsSaving(true);

    try {
      // One row per item: History, macro charts and export gain per-food
      // granularity. See `logFoodItems`, which every logging path shares.
      const data = await logFoodItems({
        userId: session.user.id,
        items,
        mealType: selectedMeal,
        imageUrl: imageStorageUrl,
        source: { ...result, edited: true },
      });

      if (verdict) {
        void submitFeedback(session.user.id, items, verdict).catch((err: unknown) =>
          console.warn('[scan-result] feedback failed', err instanceof Error ? err.message : err));
      }

      // Increment scan_count
      try {
        await supabase.rpc('increment_scan_count', { user_id: session.user.id });
      } catch {
        // Fallback: direct update
        supabase.from('profiles')
          .update({ scan_count: (useAuthStore.getState().profile?.scan_count ?? 0) + 1 })
          .eq('id', session.user.id);
      }

      data.forEach(addLog);
      await fetchProfile();

      // Logged today: push tonight's streak nudge to tomorrow so it only ever
      // fires on days the user actually hasn't logged.
      const notif = useNotificationStore.getState();
      void notif.refreshStreakReminder(true);
      // First log ever: offer to turn on reminders (self-gates to once).
      void notif.promptForRemindersOnce();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const ids = data.map((row) => row.id);
      toast(`Logged to ${MEAL_LABELS[selectedMeal]} · ${totals.calories} kcal`, {
        action: { label: 'Undo', onPress: () => undoLog(ids) },
      });
      goHome();
    } catch (err) {
      console.warn('[scan-result] save failed', err instanceof Error ? err.message : err);
      Alert.alert("Couldn't save that", 'Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const ctaLabel = `Log meal · ${totals.calories} kcal`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* No navigator header on this screen, so "I don't want to log this"
            needs its own affordance. Retake implies another photo, not leaving. */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={goHome}
            activeOpacity={0.8}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Discard this scan and go home"
          >
            <Ionicons name="close" size={24} color={T.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Check your meal</Text>
          <View style={styles.iconBtn} />
        </View>

        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.foodImage} accessibilityIgnoresInvertColors />
        ) : (
          <VoiceHero
            transcript={voice?.transcript}
            source={voice?.source}
            durationMs={voice?.durationMs}
            onEdit={() => navigation.goBack()}
          />
        )}

        {/* Hero: the number that matters, with how sure we are right beside it. */}
        <View style={styles.hero}>
          <View style={styles.kcalRow}>
            <Text style={styles.kcal}>{totals.calories}</Text>
            <Text style={styles.kcalUnit}>kcal</Text>
          </View>
          <View
            style={[styles.confChip, { backgroundColor: confidence.bg }]}
            accessibilityRole="text"
            accessibilityLabel={`Confidence: ${confidence.label}`}
          >
            <Ionicons name={confidence.icon} size={14} color={confidence.fg} />
            <Text style={[styles.confText, { color: confidence.fg }]}>{confidence.label}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.foodName}>{result.food_name}</Text>

          {/* The portion the estimate rests on is the biggest source of error,
              so say it plainly rather than hiding the assumption. */}
          {(result.portion_g > 0 || !!result.portion_desc) && (
            <View style={styles.portionRow}>
              <Ionicons name="scale-outline" size={14} color={T.textMuted} />
              <Text style={styles.portionText}>
                Based on {result.portion_desc || 'the visible portion'}
                {totals.grams > 0 ? ` · about ${totals.grams} g` : ''}
              </Text>
            </View>
          )}

          {!!result.notes && <Text style={styles.notesText}>{result.notes}</Text>}

          {/* Editable item list: AI proposes, user confirms */}
          <ScanItemsEditor
            items={items}
            onChange={setItems}
            itemFooter={(item, index) => {
              const usual = usualFor(item);
              if (!usual) return null;
              const label = usualLabel(usual);
              return (
                <TouchableOpacity
                  style={styles.usualChip}
                  onPress={() => applyUsual(index, usual)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Use your usual portion of ${label} for ${item.name}`}
                >
                  <Ionicons name="time-outline" size={14} color={T.primary} />
                  <Text style={styles.usualText} numberOfLines={1}>
                    Your usual: {label}
                  </Text>
                  <Text style={styles.usualAction}>· Use</Text>
                </TouchableOpacity>
              );
            }}
          />
          <Text style={styles.hint}>Tap any item to adjust the portion.</Text>

          <Text style={styles.sectionLabel}>Log to</Text>
          <MealTypePicker value={selectedMeal} onChange={setSelectedMeal} />

          {/* Macro rows: Pro feature */}
          <ProGate isSubscribed={isSubscribed} onUpgrade={showPaywall} label="Full nutrition breakdown" borderRadius={radius.md}>
            <View>
              <NutrientRow label="Protein" value={totals.protein_g} color={T.protein} />
              <NutrientRow label="Carbs"   value={totals.carbs_g}   color={T.carbs} />
              <NutrientRow label="Fat"     value={totals.fat_g}     color={T.fat} />
              <NutrientRow label="Fiber"   value={totals.fiber_g}   color={T.fiber} />
              <NutrientRow label="Sugar"   value={totals.sugar_g}   color={T.carbs} />
              <NutrientRow label="Saturated fat" value={totals.sat_fat_g} color={T.fat} />
              <NutrientRow label="Sodium"  value={totals.sodium_mg} color={T.warning} unit="mg" />
            </View>
          </ProGate>
        </View>

        {/* Accuracy feedback. Stays on this screen so saving is never
            interrupted; the answer is written with the save. */}
        <View style={styles.feedback} accessibilityLiveRegion="polite">
          <Text style={styles.feedbackTitle}>
            {verdict ? 'Thanks, that helps us improve.' : 'Was this estimate right?'}
          </Text>
          <View style={styles.feedbackChips}>
            {VERDICTS.map(({ value, label }) => {
              const selected = verdict === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.feedbackChip, selected && styles.feedbackChipSelected]}
                  onPress={() => chooseVerdict(value)}
                  disabled={isSaving}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${label}: the estimate was ${label.toLowerCase()}`}
                >
                  <Text style={[styles.feedbackChipText, selected && styles.feedbackChipTextSelected]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Actions: one primary, one quiet way back to the camera */}
      <View style={styles.footer}>
        <Button
          mode="text"
          onPress={() => navigation.goBack()}
          style={styles.retakeButton}
          contentStyle={styles.buttonContent}
          labelStyle={styles.retakeLabel}
          textColor={T.textSecondary}
          disabled={isSaving}
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
          labelStyle={styles.saveLabel}
          buttonColor={T.primary}
          textColor={T.textOnPrimary}
          // While saving, the spinner takes the icon slot and the label shrinks
          // to a single word so the two never overlap in the narrow footer.
          icon={isSaving ? undefined : 'check'}
        >
          {isSaving ? 'Saving…' : ctaLabel}
        </Button>
      </View>

      <PaywallModal visible={paywallVisible} onDismiss={dismissPaywall} />
    </SafeAreaView>
  );
}

/**
 * Stand-in for the photo on a described log. Shows what we were given: the
 * typed text, the transcript when the API returns one, or else how long the
 * recording was. It never invents words.
 */
function VoiceHero({
  transcript, source, durationMs, onEdit,
}: { transcript?: string; source?: 'spoken' | 'typed'; durationMs?: number; onEdit: () => void }) {
  const hasText = !!transcript?.trim();
  return (
    <View style={styles.voiceHero}>
      <View style={styles.voiceIcon}>
        <Ionicons name={source === 'typed' ? 'create-outline' : 'mic'} size={20} color={T.primary} />
      </View>
      <View style={styles.voiceText}>
        {hasText ? (
          <>
            <Text style={styles.voiceLabel}>{source === 'typed' ? 'You typed' : 'We heard'}</Text>
            <Text style={styles.voiceQuote}>“{transcript!.trim()}”</Text>
          </>
        ) : (
          <>
            <Text style={styles.voiceLabel}>Logged by voice</Text>
            <Text style={styles.voiceQuote}>
              {durationMs ? `From a ${formatDuration(durationMs)} recording` : 'From a recording'}
            </Text>
          </>
        )}
      </View>
      {hasText && (
        <TouchableOpacity
          onPress={onEdit}
          style={styles.voiceEdit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Edit what you said"
        >
          <Text style={styles.voiceEditText}>Edit</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 120 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    minHeight: HIT_TARGET + spacing.sm,
  },
  iconBtn: { width: HIT_TARGET, height: HIT_TARGET, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, ...type.titleSm, textAlign: 'center', color: T.textPrimary },
  foodImage: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 267,
    aspectRatio: 4 / 3,
    maxHeight: 200,
    borderRadius: radius.lg,
    resizeMode: 'cover',
    backgroundColor: T.surface2,
  },
  voiceHero: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginHorizontal: spacing.xl,
    padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1,
    backgroundColor: T.surface, borderColor: T.border,
  },
  voiceIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.primaryTint,
  },
  voiceText: { flex: 1, gap: 2 },
  voiceLabel: { ...type.bodySm, color: T.textMuted },
  voiceQuote: { ...type.body, color: T.textPrimary },
  voiceEdit: { minHeight: HIT_TARGET, justifyContent: 'center', paddingHorizontal: spacing.sm },
  voiceEditText: { ...type.body, fontWeight: '700', color: T.primary },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs + 2 },
  kcal: { ...type.display, color: T.textPrimary },
  kcalUnit: { ...type.titleSm, color: T.textSecondary },
  confChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  confText: { ...type.bodySm, fontWeight: '700' },

  card: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg - 2,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  foodName: { ...type.title, color: T.textPrimary },
  portionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, marginTop: -spacing.sm },
  portionText: { ...type.bodySm, fontWeight: '600', color: T.textSecondary, flex: 1 },
  notesText: { ...type.bodySm, color: T.textMuted, fontStyle: 'italic', marginTop: -spacing.sm },
  hint: { ...type.bodySm, color: T.textMuted, textAlign: 'center', marginTop: -spacing.xs },
  sectionLabel: { ...type.label, color: T.textMuted, marginBottom: -spacing.sm },

  usualChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: HIT_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: T.primaryTint,
  },
  usualText: { ...type.bodySm, fontWeight: '600', color: T.textPrimary, flexShrink: 1 },
  usualAction: { ...type.bodySm, fontWeight: '700', color: T.primary },

  feedback: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  feedbackTitle: { ...type.body, fontWeight: '600', color: T.textPrimary, textAlign: 'center' },
  feedbackChips: { flexDirection: 'row', gap: spacing.sm },
  feedbackChip: {
    flex: 1,
    minHeight: HIT_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  feedbackChipSelected: { backgroundColor: T.primary, borderColor: T.primary },
  feedbackChipText: { ...type.body, fontWeight: '700', color: T.textSecondary },
  feedbackChipTextSelected: { color: T.textOnPrimary },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
    backgroundColor: T.surface,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  retakeButton: { flex: 1 },
  retakeLabel: { ...type.body, fontWeight: '700' },
  saveButton: { flex: 2, borderRadius: radius.md },
  saveLabel: { ...type.body, fontWeight: '800' },
  buttonContent: { height: 52 },
});
