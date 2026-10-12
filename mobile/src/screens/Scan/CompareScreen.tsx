import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ScanStackParamList } from '../../navigation/ScanNavigator';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { LabelNutrition } from '../../services/api';
import { useCompareStore, type CompareItem, COMPARE_MAX } from '../../store/compareStore';
import { ModalHeader } from '../../components/ModalHeader';
import { ScoreChip } from '../../components/ScoreChip';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { T, type, spacing, radius, HIT_TARGET, tabularNums } from '../../theme';

type Props = {
  navigation: NativeStackNavigationProp<ScanStackParamList, 'Compare'>;
};

/** One row of the table: which per-100 g value, and which direction is better. */
interface MetricRow {
  key: keyof LabelNutrition;
  label: string;
  unit: string;
  /** 'low' means less is better (sugar); 'high' means more is better (fibre). */
  better: 'low' | 'high';
  /** Decimal places shown. */
  dp: number;
}

const ROWS: readonly MetricRow[] = [
  { key: 'energy_kcal', label: 'Energy',        unit: 'kcal', better: 'low',  dp: 0 },
  { key: 'sugar_g',     label: 'Sugar',         unit: 'g',    better: 'low',  dp: 1 },
  { key: 'sat_fat_g',   label: 'Saturated fat', unit: 'g',    better: 'low',  dp: 1 },
  { key: 'sodium_mg',   label: 'Sodium',        unit: 'mg',   better: 'low',  dp: 0 },
  { key: 'fiber_g',     label: 'Fibre',         unit: 'g',    better: 'high', dp: 1 },
  { key: 'protein_g',   label: 'Protein',       unit: 'g',    better: 'high', dp: 1 },
];

/** Width of the left-hand label column. The product columns share the rest. */
const LABEL_COL = 84;

function formatValue(v: number, dp: number): string {
  if (!Number.isFinite(v)) return '–';
  return dp === 0 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(dp);
}

/**
 * For one metric across the columns, which column index is best and which is
 * worst. Both are null when every value is the same: nothing to highlight.
 */
function rank(values: number[], better: 'low' | 'high'): { best: number | null; worst: number | null } {
  if (values.length < 2) return { best: null, worst: null };
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return { best: null, worst: null };
  const bestVal = better === 'low' ? min : max;
  const worstVal = better === 'low' ? max : min;
  return { best: values.indexOf(bestVal), worst: values.indexOf(worstVal) };
}

// ── Screen ───────────────────────────────────────────────────────────────────
export function CompareScreen({ navigation }: Props) {
  const items = useCompareStore((s) => s.items);
  const remove = useCompareStore((s) => s.remove);
  const clear = useCompareStore((s) => s.clear);

  useAndroidBack(
    React.useCallback(() => {
      navigation.goBack();
      return true;
    }, [navigation]),
  );

  /** Back to the camera in barcode mode: set the root's mode, then pop. */
  const scanAnother = () => {
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.setParams({ mode: 'barcode' });
    navigation.popToTop();
  };

  const scores = items.map((i) => i.result.health.score);
  const topScore = scores.length > 0 ? Math.max(...scores) : 0;
  const scoresDiffer = scores.length > 1 && Math.min(...scores) !== topScore;
  const anyBeverage = items.some((i) => i.result.is_beverage);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ModalHeader
        title="Compare"
        variant="back"
        onClose={() => navigation.goBack()}
        actionLabel="Clear all"
        onAction={clear}
        actionDisabled={items.length === 0}
      />

      {items.length < 2 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="git-compare-outline" size={30} color={T.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {items.length === 1 ? 'One product in compare' : 'Nothing to compare yet'}
          </Text>
          <Text style={styles.emptyText}>Scan another label or barcode to compare.</Text>
          {items.length === 1 && (
            <Text style={styles.emptyKept} numberOfLines={2}>
              {`Kept: ${items[0].result.brand ? `${items[0].result.brand} ` : ''}${items[0].result.product_name}`}
            </Text>
          )}
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={scanAnother}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Scan a barcode"
          >
            <Ionicons name="barcode-outline" size={18} color={T.textOnPrimary} />
            <Text style={styles.emptyBtnText}>Scan a barcode</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.caption}>
            {`Per 100 ${anyBeverage ? 'g or ml' : 'g'}. ${items.length} of ${COMPARE_MAX} products.`}
          </Text>

          <View style={styles.table}>
            {/* Header: name, brand, score, best pick, remove */}
            <View style={styles.headerRow}>
              <View style={styles.labelCol} />
              {items.map((item) => (
                <ProductHeader
                  key={item.key}
                  item={item}
                  bestPick={scoresDiffer && item.result.health.score === topScore}
                  onRemove={() => remove(item.key)}
                />
              ))}
            </View>

            {/* Metric rows */}
            {ROWS.map((row) => {
              const values = items.map((i) => Number(i.result.per_100g[row.key]));
              const { best, worst } = rank(values, row.better);
              return (
                <View key={row.key} style={styles.row}>
                  <View style={styles.labelCol}>
                    <Text style={styles.rowLabel} numberOfLines={2}>{row.label}</Text>
                    <Text style={styles.rowUnit}>{row.unit}</Text>
                  </View>
                  {values.map((v, idx) => {
                    const isBest = idx === best;
                    const isWorst = idx === worst;
                    return (
                      <View
                        key={items[idx].key}
                        style={[styles.cell, isBest && styles.cellBest, isWorst && styles.cellWorst]}
                        accessible
                        accessibilityLabel={`${items[idx].result.product_name}, ${row.label} ${formatValue(v, row.dp)} ${row.unit}${isBest ? ', best' : isWorst ? ', worst' : ''}`}
                      >
                        <Text style={[styles.cellValue, isBest && styles.cellValueBest, isWorst && styles.cellValueWorst]}>
                          {formatValue(v, row.dp)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: T.successTint }]} />
              <Text style={styles.legendText}>Best in row</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: T.warningTint }]} />
              <Text style={styles.legendText}>Worst in row</Text>
            </View>
          </View>

          {items.length < COMPARE_MAX && (
            <TouchableOpacity
              style={styles.addMoreBtn}
              onPress={scanAnother}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Scan another product to add to compare"
            >
              <Ionicons name="add" size={18} color={T.primary} />
              <Text style={styles.addMoreText}>Add another product</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.disclaimer}>
            Scores use the CalVue Nutri-Score-based rules. General guidance, not medical advice.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Column header ────────────────────────────────────────────────────────────
function ProductHeader({
  item, bestPick, onRemove,
}: { item: CompareItem; bestPick: boolean; onRemove: () => void }) {
  const { result } = item;
  return (
    <View style={styles.cell}>
      <Text style={styles.productName} numberOfLines={2}>{result.product_name}</Text>
      <Text style={styles.productBrand} numberOfLines={1}>{result.brand || ' '}</Text>
      <ScoreChip score={result.health.score} />
      <Text style={[styles.bestPick, !bestPick && styles.bestPickHidden]} accessibilityElementsHidden={!bestPick}>
        Best pick
      </Text>
      <TouchableOpacity
        onPress={onRemove}
        style={styles.removeBtn}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${result.product_name} from compare`}
      >
        <Ionicons name="close-circle-outline" size={20} color={T.textMuted} />
        <Text style={styles.removeText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing['4xl'], gap: spacing.md },
  caption: { ...type.bodySm, color: T.textSecondary },

  table: {
    backgroundColor: T.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: T.border,
    overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'stretch', borderTopWidth: 1, borderTopColor: T.divider },
  labelCol: { width: LABEL_COL, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm, justifyContent: 'center' },
  rowLabel: { ...type.bodySm, fontWeight: '700', color: T.textSecondary },
  rowUnit: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: T.textMuted },

  cell: {
    flex: 1, paddingHorizontal: spacing.xs + 2, paddingVertical: spacing.sm,
    alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    borderLeftWidth: 1, borderLeftColor: T.divider,
  },
  cellBest: { backgroundColor: T.successTint },
  cellWorst: { backgroundColor: T.warningTint },
  cellValue: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: T.textPrimary, ...tabularNums },
  cellValueBest: { color: T.success },
  cellValueWorst: { color: T.warning },

  productName: { fontSize: 13, lineHeight: 17, fontWeight: '700', color: T.textPrimary, textAlign: 'center', minHeight: 34 },
  productBrand: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: T.textSecondary, textAlign: 'center' },
  bestPick: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: T.success },
  bestPickHidden: { opacity: 0 },
  removeBtn: { minHeight: HIT_TARGET, minWidth: HIT_TARGET, alignItems: 'center', justifyContent: 'center', gap: 2 },
  removeText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: T.textMuted },

  legend: { flexDirection: 'row', gap: spacing.lg, paddingHorizontal: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendSwatch: { width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: T.border },
  legendText: { ...type.bodySm, color: T.textSecondary },

  addMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    minHeight: HIT_TARGET + 4, borderRadius: radius.md, borderWidth: 1, borderColor: T.primaryBorder,
    backgroundColor: T.primaryTint,
  },
  addMoreText: { ...type.body, fontWeight: '700', color: T.primary },
  disclaimer: { ...type.bodySm, color: T.textSecondary, textAlign: 'center', paddingHorizontal: spacing.md },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['2xl'] + 4, gap: spacing.md, paddingBottom: spacing['4xl'] },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.primaryTint, borderWidth: 1, borderColor: T.primaryBorder, marginBottom: spacing.xs,
  },
  emptyTitle: { ...type.title, color: T.textPrimary, textAlign: 'center' },
  emptyText: { ...type.body, color: T.textSecondary, textAlign: 'center' },
  emptyKept: { ...type.bodySm, color: T.textMuted, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    height: 52, borderRadius: radius.md, backgroundColor: T.primary, alignSelf: 'stretch', marginTop: spacing.sm,
  },
  emptyBtnText: { ...type.body, fontWeight: '800', color: T.textOnPrimary },
});
