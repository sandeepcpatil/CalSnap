import React, { useEffect, useMemo, useState } from 'react';
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
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { ScanStackParamList } from '../../navigation/ScanNavigator';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { getBarcodeAlternatives, type BarcodeAlternative, type FoodItem } from '../../services/api';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { useCompareStore, isInCompare } from '../../store/compareStore';
import { toast } from '../../store/toastStore';
import { getMealTypeFromTime } from '../../utils/nutrition';
import { rescaleItem } from '../../utils/foodItems';
import { logFoodItems, type MealType } from '../../services/foodLogs';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import { PaywallModal } from '../Paywall/PaywallModal';
import { ProGate } from '../../components/ProGate';
import { MealTypePicker } from '../../components/MealTypePicker';
import { PortionSheet } from '../../components/PortionSheet';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { ScoreChip } from '../../components/ScoreChip';
import { T, scoreColor, type, spacing, radius, HIT_TARGET, tabularNums } from '../../theme';

type Props = {
  navigation: NativeStackNavigationProp<ScanStackParamList, 'LabelResult'>;
  route: RouteProp<ScanStackParamList, 'LabelResult'>;
};

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

/** The three bands the ring uses, named the way the caption names them. */
const SCORE_BANDS = [
  { min: 76, range: '76 and above', label: 'A healthy choice' },
  { min: 56, range: '56 to 75', label: 'Okay in moderation' },
  { min: 0, range: 'Below 56', label: 'Consider an alternative' },
] as const;

// ── Score ring ───────────────────────────────────────────────────────────────
const RING_SIZE = 148;
const RING_STROKE = 12;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_R;

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const color = scoreColor(score);
  const offset = RING_CIRC * (1 - score / 100);
  return (
    <View style={styles.ringWrap} accessibilityRole="image" accessibilityLabel={`Health score ${score} out of 100, grade ${grade}`}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
          stroke={T.border} strokeWidth={RING_STROKE} fill="none"
        />
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
          stroke={color} strokeWidth={RING_STROKE} fill="none"
          strokeDasharray={`${RING_CIRC}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <Text style={[styles.ringScore, { color }]}>{score}</Text>
        <Text style={styles.ringOutOf}>out of 100</Text>
      </View>
      <View style={[styles.gradeChip, { backgroundColor: color }]}>
        <Text style={styles.gradeChipText}>{grade}</Text>
      </View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export function LabelResultScreen({ navigation, route }: Props) {
  const { imageUri, imageStorageUrl, result, barcode } = route.params;
  const { session, fetchProfile } = useAuthStore();
  const { addLog, removeLog } = useFoodLogStore();
  const { isSubscribed, paywallVisible, showPaywall, dismissPaywall } = useSubscriptionGate();
  const [isSaving, setIsSaving] = useState(false);
  const [mealType, setMealType] = useState<MealType>(getMealTypeFromTime());
  const [portionOpen, setPortionOpen] = useState(false);

  // ── Better swap ────────────────────────────────────────────────────────────
  // Barcode lookups only: a label scan has no category to search in. The
  // request is silent; nothing renders unless there is something to show.
  const [swaps, setSwaps] = useState<BarcodeAlternative[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const accessToken = session?.access_token;
  useEffect(() => {
    if (!barcode || !accessToken) return;
    const controller = new AbortController();
    setSwapLoading(true);
    getBarcodeAlternatives(barcode, accessToken, controller.signal)
      .then((r) => {
        if (controller.signal.aborted) return;
        setSwaps(Array.isArray(r.alternatives) ? r.alternatives : []);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn('[label-result] alternatives failed', err?.code ?? err?.statusCode ?? 'unknown');
        setSwaps([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSwapLoading(false);
      });
    return () => controller.abort();
  }, [barcode, accessToken]);

  // ── Compare tray ───────────────────────────────────────────────────────────
  const compareItems = useCompareStore((s) => s.items);
  const addToCompare = useCompareStore((s) => s.add);
  const inCompare = isInCompare(compareItems, result, barcode);
  const compareCount = compareItems.length;

  const handleAddToCompare = () => {
    const outcome = addToCompare({ barcode, result, imageUri });
    if (outcome === 'added') {
      Haptics.selectionAsync();
      toast(compareItems.length + 1 >= 2 ? 'Added. Ready to compare.' : 'Added to compare. Scan one more.');
    } else if (outcome === 'full') {
      toast('Compare holds three products. Remove one first.');
    }
  };

  const openSwap = (swap: BarcodeAlternative) => {
    const img = swap.image_url ?? '';
    navigation.push('LabelResult', {
      imageUri: img,
      imageStorageUrl: img,
      result: swap.result,
      barcode: swap.barcode,
    });
  };

  // Same nested-stack reason as ScanResult: handle back explicitly rather than
  // relying on it bubbling out of the inner navigator.
  useAndroidBack(
    React.useCallback(() => {
      if (isSaving) return true;
      if (portionOpen) { setPortionOpen(false); return true; }
      navigation.goBack();
      return true;
    }, [isSaving, portionOpen, navigation]),
  );

  const { health, per_100g } = result;
  const productName = result.brand ? `${result.brand} ${result.product_name}` : result.product_name;
  // Start from one serving when the pack states one; otherwise 100 g. The user
  // adjusts from there in the portion sheet before anything is logged.
  const startGrams = result.serving_g > 0 ? Math.round(result.serving_g) : 100;
  const servingLabel = result.serving_g > 0 ? `${startGrams} g serving` : '100 g';

  const startItem = useMemo<FoodItem>(() => {
    const per100: FoodItem = {
      name: productName,
      quantity: 100,
      unit: 'g',
      grams: 100,
      calories: Math.round(per_100g.energy_kcal),
      protein_g: per_100g.protein_g,
      carbs_g: per_100g.carbs_g,
      fat_g: per_100g.total_fat_g,
      fiber_g: per_100g.fiber_g,
      // Real values off the label / barcode, no estimation needed here.
      sodium_mg: per_100g.sodium_mg,
      sugar_g: per_100g.sugar_g,
      sat_fat_g: per_100g.sat_fat_g,
      source: 'database',
    };
    return rescaleItem(per100, startGrams, 'g');
  }, [productName, per_100g, startGrams]);

  const goHome = () => {
    // Pop the whole Scan stack off the root navigator and land on Home, so
    // the day's updated ring is the first thing seen. Popping the parent
    // unmounts this screen too; otherwise re-opening the camera would show
    // the product that was just logged.
    navigation
      .getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.navigate('Main', { screen: 'Home' });
  };

  const undoLog = async (ids: string[]) => {
    if (!session?.user.id) return;
    ids.forEach(removeLog);
    const { error } = await supabase
      .from('food_logs')
      .delete()
      .in('id', ids)
      .eq('user_id', session.user.id);
    if (error) {
      console.warn('[label-result] undo delete failed', error.message);
      Alert.alert("Couldn't undo", 'That item is still logged. You can delete it from your history.');
      return;
    }
    void fetchProfile();
  };

  const handleLog = async (item: FoodItem) => {
    if (!session?.user.id) return;
    setIsSaving(true);
    try {
      const rows = await logFoodItems({
        userId: session.user.id,
        items: [item],
        mealType,
        imageUrl: imageStorageUrl,
        source: { ...result },
      });
      rows.forEach(addLog);
      await fetchProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPortionOpen(false);
      const ids = rows.map((r) => r.id);
      toast(`Logged to ${MEAL_LABELS[mealType]} · ${item.calories} kcal`, {
        action: { label: 'Undo', onPress: () => undoLog(ids) },
      });
      goHome();
    } catch (err) {
      console.warn('[label-result] save failed', err instanceof Error ? err.message : err);
      Alert.alert("Couldn't save that", 'Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const NUTRITION_ROWS: { label: string; value: string; sub?: boolean }[] = [
    { label: 'Energy',        value: `${Math.round(per_100g.energy_kcal)} kcal` },
    { label: 'Protein',       value: `${per_100g.protein_g} g` },
    { label: 'Carbohydrates', value: `${per_100g.carbs_g} g` },
    { label: 'of which sugars', value: `${per_100g.sugar_g} g`, sub: true },
    { label: 'Fat',           value: `${per_100g.total_fat_g} g` },
    { label: 'of which saturates', value: `${per_100g.sat_fat_g} g`, sub: true },
    { label: 'Fibre',         value: `${per_100g.fiber_g} g` },
    { label: 'Sodium',        value: `${Math.round(per_100g.sodium_mg)} mg` },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Back to the scanner"
        >
          <Ionicons name="arrow-back" size={22} color={T.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Health score</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Product row */}
        <View style={styles.productRow}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.productImg} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.productImg, styles.productImgFallback]}>
              <Ionicons name="fast-food-outline" size={26} color={T.textMuted} />
            </View>
          )}
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>{result.product_name}</Text>
            {!!result.brand && <Text style={styles.productBrand}>{result.brand}</Text>}
            <View style={styles.tagRow}>
              {result.is_beverage && (
                <View style={styles.tag}><Text style={styles.tagText}>Beverage</Text></View>
              )}
              <View style={styles.tag}><Text style={styles.tagText}>Per {servingLabel}</Text></View>
            </View>
          </View>
        </View>

        {/* Score */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreCardHeader}>
            <Text style={styles.scoreCardEyebrow}>CalVue score</Text>
            <TouchableOpacity
              onPress={handleAddToCompare}
              disabled={inCompare}
              style={[styles.compareBtn, inCompare && styles.compareBtnDone]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={inCompare ? 'Already in compare' : 'Add this product to compare'}
              accessibilityState={{ disabled: inCompare }}
            >
              <Ionicons
                name={inCompare ? 'checkmark' : 'git-compare-outline'}
                size={16}
                color={inCompare ? T.textMuted : T.primary}
              />
              <Text style={[styles.compareBtnText, inCompare && styles.compareBtnTextDone]}>
                {inCompare ? 'In compare' : 'Add to compare'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScoreRing score={health.score} grade={health.grade} />
          <Text style={styles.scoreCaption}>
            {health.score >= 76 ? 'A healthy choice'
              : health.score >= 56 ? 'Okay in moderation'
              : 'Consider a healthier alternative'}
          </Text>
          {!!health.summary && (
            <Text style={styles.scoreSummary}>{health.summary}</Text>
          )}
          {result.confidence !== 'high' && (
            <View style={styles.confidenceRow}>
              <Ionicons name="alert-circle" size={16} color={T.warning} />
              <Text style={styles.confidenceNote}>
                The label was only partly readable. Double-check the values against the pack.
              </Text>
            </View>
          )}

          {/* How the bands work, in the ring's own colours. */}
          <View style={styles.bands}>
            <Text style={styles.bandsTitle}>How this is scored</Text>
            {SCORE_BANDS.map((band) => (
              <View key={band.range} style={styles.bandRow}>
                <View style={[styles.bandDot, { backgroundColor: scoreColor(band.min) }]} />
                <Text style={[styles.bandRange, { color: scoreColor(band.min) }]}>{band.range}</Text>
                <Text style={styles.bandLabel}>{band.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Better swap: only for barcode lookups, and only when there is one. */}
        {swapLoading && swaps.length === 0 && (
          <Text style={styles.swapLoading} accessibilityLiveRegion="polite">Looking for a better swap</Text>
        )}
        {swaps.length > 0 && (
          <View style={styles.swapCard}>
            <Text style={styles.swapTitle}>Better swap</Text>
            <Text style={styles.swapSub}>Same aisle, higher score.</Text>
            {swaps.map((swap) => {
              const gain = swap.result.health.score - health.score;
              const name = swap.result.product_name;
              return (
                <TouchableOpacity
                  key={swap.barcode}
                  style={styles.swapRow}
                  onPress={() => openSwap(swap)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`${swap.result.brand ? `${swap.result.brand} ` : ''}${name}, health score ${swap.result.health.score}, ${gain} points higher. Open`}
                >
                  {swap.image_url ? (
                    <Image source={{ uri: swap.image_url }} style={styles.swapImg} accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={[styles.swapImg, styles.productImgFallback]}>
                      <Ionicons name="fast-food-outline" size={18} color={T.textMuted} />
                    </View>
                  )}
                  <View style={styles.swapInfo}>
                    <Text style={styles.swapName} numberOfLines={2}>{name}</Text>
                    {!!swap.result.brand && (
                      <Text style={styles.swapBrand} numberOfLines={1}>{swap.result.brand}</Text>
                    )}
                  </View>
                  <View style={styles.swapScoreCol}>
                    <ScoreChip score={swap.result.health.score} />
                    <Text style={[styles.swapGain, { color: scoreColor(swap.result.health.score) }]}>
                      {`+${gain} points`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Breakdown: Pro feature */}
        <ProGate isSubscribed={isSubscribed} onUpgrade={showPaywall} label="Full health breakdown" borderRadius={radius.lg}>
          <View style={styles.breakdownCard}>
            {health.positives.length > 0 && (
              <View style={styles.factList}>
                {health.positives.map((p) => (
                  <View key={p} style={styles.factRow}>
                    <Ionicons name="checkmark-circle" size={18} color={T.success} />
                    <Text style={styles.factText}>{p}</Text>
                  </View>
                ))}
              </View>
            )}
            {health.negatives.length > 0 && (
              <View style={styles.factList}>
                {health.negatives.map((n) => (
                  <View key={n} style={styles.factRow}>
                    <Ionicons name="alert-circle" size={18} color={T.error} />
                    <Text style={styles.factText}>{n}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.divider} />
            <Text style={styles.tableTitle}>Nutrition per 100 {result.is_beverage ? 'ml' : 'g'}</Text>
            {NUTRITION_ROWS.map((row) => (
              <View key={row.label} style={styles.nutRow}>
                <Text style={[styles.nutLabel, row.sub && styles.nutSubLabel]}>{row.label}</Text>
                <Text style={styles.nutValue}>{row.value}</Text>
              </View>
            ))}

            {result.ingredients.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.tableTitle}>Ingredients</Text>
                <Text style={styles.ingredientsText}>{result.ingredients.join(', ')}</Text>
              </>
            )}
          </View>
        </ProGate>

        <Text style={styles.disclaimer}>
          The CalVue score is computed from the label using Nutri-Score-based rules. It is general guidance, not medical advice.
        </Text>

        <View style={[styles.footerSpacer, compareCount > 0 && styles.footerSpacerTall]} />
      </ScrollView>

      {/* Footer actions */}
      <View style={styles.footer}>
        {/* Compare tray: a slim strip that becomes the way into the table. */}
        {compareCount >= 2 ? (
          <TouchableOpacity
            style={styles.compareBar}
            onPress={() => navigation.navigate('Compare')}
            activeOpacity={0.8}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel={`Compare ${compareCount} products`}
          >
            <Ionicons name="git-compare-outline" size={18} color={T.primary} />
            <Text style={styles.compareBarText}>{`Compare ${compareCount} products`}</Text>
            <Ionicons name="chevron-forward" size={18} color={T.primary} />
          </TouchableOpacity>
        ) : compareCount === 1 ? (
          <View style={styles.compareBar} accessible accessibilityLabel="One product in compare. Add one more to compare">
            <Ionicons name="git-compare-outline" size={18} color={T.textMuted} />
            <Text style={[styles.compareBarText, styles.compareBarTextMuted]}>Add one more to compare</Text>
          </View>
        ) : null}

        <Text style={styles.footerLabel}>Log to</Text>
        <MealTypePicker value={mealType} onChange={setMealType} />
        <View style={styles.footerRow}>
          <Button
            mode="text"
            onPress={() => navigation.goBack()}
            style={styles.doneBtn}
            contentStyle={styles.btnContent}
            labelStyle={styles.btnLabel}
            textColor={T.textSecondary}
            disabled={isSaving}
          >
            Scan another
          </Button>
          <Button
            mode="contained"
            onPress={() => setPortionOpen(true)}
            loading={isSaving}
            disabled={isSaving}
            style={styles.logBtn}
            contentStyle={styles.btnContent}
            labelStyle={styles.btnLabel}
            buttonColor={T.primary}
            textColor={T.textOnPrimary}
            icon={isSaving ? undefined : 'plus'}
          >
            {isSaving ? 'Saving…' : `Log ${servingLabel}`}
          </Button>
        </View>
      </View>

      {/* Amount is confirmed here, pre-filled with the serving size or 100 g. */}
      <PortionSheet
        visible={portionOpen}
        item={portionOpen ? startItem : null}
        confirmLabel="Log"
        busy={isSaving}
        onCancel={() => setPortionOpen(false)}
        onConfirm={handleLog}
      />

      <PaywallModal visible={paywallVisible} onDismiss={dismissPaywall} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn: { width: HIT_TARGET, height: HIT_TARGET, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...type.titleSm, color: T.textPrimary },

  scroll: { paddingHorizontal: spacing.xl, gap: spacing.lg },

  productRow: { flexDirection: 'row', gap: spacing.lg - 2, alignItems: 'center' },
  productImg: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: T.surface },
  productImgFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border },
  productInfo: { flex: 1, gap: 3 },
  productName: { ...type.titleSm, color: T.textPrimary },
  productBrand: { ...type.bodySm, color: T.textSecondary, fontWeight: '600' },
  tagRow: { flexDirection: 'row', gap: spacing.xs + 2, marginTop: 3, flexWrap: 'wrap' },
  tag: {
    backgroundColor: T.divider, borderRadius: radius.sm - 4,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: T.border,
  },
  tagText: { ...type.label, letterSpacing: 0.4, textTransform: 'none', color: T.textMuted },

  scoreCard: {
    backgroundColor: T.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: T.border,
    alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, gap: spacing.md,
  },
  scoreCardHeader: {
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  scoreCardEyebrow: { ...type.label, color: T.textMuted },
  compareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2,
    minHeight: HIT_TARGET, paddingHorizontal: spacing.md,
    borderRadius: radius.pill, borderWidth: 1, borderColor: T.primaryBorder, backgroundColor: T.primaryTint,
  },
  compareBtnDone: { borderColor: T.border, backgroundColor: T.divider },
  compareBtnText: { ...type.bodySm, fontWeight: '700', color: T.primary },
  compareBtnTextDone: { color: T.textMuted },

  swapLoading: { ...type.bodySm, color: T.textMuted, textAlign: 'center' },
  swapCard: {
    backgroundColor: T.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: T.border,
    padding: spacing.lg + 2, gap: spacing.sm,
  },
  swapTitle: { ...type.titleSm, color: T.textPrimary },
  swapSub: { ...type.bodySm, color: T.textSecondary, marginTop: -spacing.xs, marginBottom: spacing.xs },
  swapRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    minHeight: HIT_TARGET + spacing.md, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: T.divider,
  },
  swapImg: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: T.divider },
  swapInfo: { flex: 1, gap: 2 },
  swapName: { ...type.body, fontWeight: '700', color: T.textPrimary },
  swapBrand: { ...type.bodySm, color: T.textSecondary },
  swapScoreCol: { alignItems: 'flex-end', gap: 2 },
  swapGain: { ...type.caption, fontSize: 12, lineHeight: 16, ...tabularNums },
  ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringScore: { ...type.display },
  ringOutOf: { ...type.bodySm, color: T.textMuted },
  gradeChip: {
    position: 'absolute', bottom: 2, alignSelf: 'center',
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: T.bg,
  },
  gradeChipText: { fontSize: 16, fontWeight: '800', color: T.textOnPrimary },
  scoreCaption: { ...type.body, fontWeight: '700', color: T.textPrimary },
  scoreSummary: { ...type.bodySm, color: T.textSecondary, textAlign: 'center' },
  confidenceRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.sm, backgroundColor: T.warningTint,
    alignSelf: 'stretch',
  },
  confidenceNote: { flex: 1, ...type.bodySm, color: T.warning },

  bands: {
    alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.xs,
    paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: T.divider,
  },
  bandsTitle: { ...type.bodySm, fontWeight: '700', color: T.textSecondary, marginBottom: 2 },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bandDot: { width: 10, height: 10, borderRadius: 5 },
  bandRange: { ...type.bodySm, fontWeight: '700', minWidth: 96, ...tabularNums },
  bandLabel: { flex: 1, ...type.bodySm, color: T.textSecondary },

  breakdownCard: {
    backgroundColor: T.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: T.border,
    padding: spacing.lg + 2, gap: spacing.sm,
  },
  factList: { gap: spacing.sm, marginBottom: spacing.xs },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  factText: { flex: 1, ...type.body, color: T.textPrimary },

  divider: { height: 1, backgroundColor: T.divider, marginVertical: spacing.sm },
  tableTitle: { ...type.label, color: T.textMuted, marginBottom: spacing.xs + 2 },
  nutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  nutLabel: { ...type.body, color: T.textSecondary, fontWeight: '600' },
  nutSubLabel: { paddingLeft: spacing.lg - 2, fontWeight: '500', color: T.textMuted },
  nutValue: { ...type.body, color: T.textPrimary, fontWeight: '700', ...tabularNums },
  ingredientsText: { ...type.bodySm, color: T.textSecondary },

  disclaimer: { ...type.bodySm, color: T.textSecondary, textAlign: 'center', paddingHorizontal: spacing.md },
  footerSpacer: { height: 180 },
  footerSpacerTall: { height: 180 + HIT_TARGET + spacing.sm },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    gap: spacing.sm + 2,
    padding: spacing.lg, paddingBottom: spacing['3xl'],
    backgroundColor: T.bg,
    borderTopWidth: 1, borderTopColor: T.border,
  },
  compareBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    minHeight: HIT_TARGET, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: T.border, backgroundColor: T.surface,
  },
  compareBarText: { flex: 1, ...type.bodySm, fontWeight: '700', color: T.primary },
  compareBarTextMuted: { color: T.textSecondary },
  footerLabel: { ...type.label, color: T.textMuted },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  doneBtn: { flex: 1 },
  logBtn: { flex: 2, borderRadius: radius.md },
  btnContent: { height: 52 },
  btnLabel: { ...type.body, fontWeight: '800' },
});
