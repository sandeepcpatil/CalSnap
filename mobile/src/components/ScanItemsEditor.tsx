import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { FoodItem } from '../services/api';
import { T, type, spacing, radius, HIT_TARGET, tabularNums } from '../theme';
import { PortionSheet } from './PortionSheet';
import { AddItemSheet } from './AddItemSheet';

interface Props {
  items: FoodItem[];
  onChange: (items: FoodItem[]) => void;
  /** Section heading. The scan result says "detected"; a meal builder doesn't. */
  heading?: string;
  /** Copy on the add button, for the same reason. */
  addLabel?: string;
}

/** Long enough for the add sheet's slide-out to finish before another sheet opens. */
const SHEET_CLOSE_MS = 350;

const formatQty = (q: number): string => `${q}`;

/** "1 katori (180 g)" or, for gram-based items, "180 g". */
function portionLine(item: FoodItem): string {
  if (item.unit === 'g') return `${item.grams} g`;
  return `${formatQty(item.quantity)} ${item.unit} (${item.grams} g)`;
}

/**
 * Per-item editor for a scanned meal. The AI proposes the items; the user
 * confirms. Editing one item never affects the others, so a wrong estimate for
 * the rice can't corrupt a correct one for the dal.
 *
 * Portion edits go through the shared `PortionSheet`, so a portion behaves the
 * same whether the food came from the camera, history or a saved meal.
 */
export function ScanItemsEditor({ items, onChange, heading = 'Items detected', addLabel = 'Add anything we missed' }: Props) {
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const openEditTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (openEditTimer.current) clearTimeout(openEditTimer.current); }, []);

  const editing = editIndex !== null ? items[editIndex] ?? null : null;

  const removeItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(items.filter((_, i) => i !== index));
    setEditIndex(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={styles.head}>{heading}</Text>
        <Text style={styles.headCount}>{items.length}</Text>
      </View>

      {items.map((item, i) => (
        <TouchableOpacity
          key={`${item.name}-${i}`}
          style={styles.row}
          onPress={() => setEditIndex(i)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Adjust ${item.name}, ${portionLine(item)}, ${item.calories} kilocalories`}
        >
          <View style={styles.rowMain}>
            <View style={styles.rowNameLine}>
              <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
              {item.source === 'database' && (
                <Ionicons name="checkmark-circle" size={13} color={T.success} />
              )}
            </View>
            <Text style={styles.rowMeta}>{portionLine(item)}</Text>
            <Text style={styles.rowMeta}>
              {item.protein_g} g protein · {item.carbs_g} g carbs · {item.fat_g} g fat
            </Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.rowKcal}>
              {item.calories}<Text style={styles.rowKcalUnit}> kcal</Text>
            </Text>
            <View style={styles.adjust}>
              <Text style={styles.adjustText}>Adjust</Text>
              <Ionicons name="chevron-forward" size={14} color={T.primary} />
            </View>
          </View>
        </TouchableOpacity>
      ))}

      {items.length === 0 && (
        <Text style={styles.empty}>No items yet. Add what you ate below.</Text>
      )}

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setAddOpen(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={addLabel}
      >
        <Ionicons name="add-circle-outline" size={18} color={T.primary} />
        <Text style={styles.addText}>{addLabel}</Text>
      </TouchableOpacity>

      {/* Portion editor. Shared with the cart and saved meals. */}
      <PortionSheet
        visible={editing !== null}
        item={editing}
        confirmLabel="Update"
        editableName
        onRemove={editIndex !== null ? () => removeItem(editIndex) : undefined}
        onCancel={() => setEditIndex(null)}
        onConfirm={(updated) => {
          onChange(items.map((it, i) => (i === editIndex ? updated : it)));
          setEditIndex(null);
        }}
      />

      <AddItemSheet
        visible={addOpen}
        onAdd={(item) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange([...items, item]);
        }}
        onDone={(addedCount) => {
          setAddOpen(false);
          // Picking a food and setting its amount is one intent, so a single
          // addition goes straight to the portion editor. Several additions
          // don't: there'd be no way to say which one you meant, and the rows
          // are one tap away in the list behind.
          // `items` already includes the addition by the time Done is tapped,
          // so the new row is the last index. The editor opens only after the
          // add sheet has fully closed, never on top of it.
          if (addedCount === 1) {
            const index = items.length - 1;
            if (openEditTimer.current) clearTimeout(openEditTimer.current);
            openEditTimer.current = setTimeout(() => setEditIndex(index), SHEET_CLOSE_MS);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  head: { ...type.label, color: T.textMuted },
  headCount: { ...type.label, color: T.primary },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2,
    minHeight: HIT_TARGET,
    backgroundColor: T.surface2, borderRadius: radius.md,
    borderWidth: 1, borderColor: T.border,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg - 2,
  },
  rowMain: { flex: 1, gap: 2 },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 1 },
  rowName: { ...type.body, fontWeight: '700', color: T.textPrimary, flexShrink: 1 },
  rowMeta: { ...type.bodySm, color: T.textSecondary },
  rowRight: { alignItems: 'flex-end', gap: spacing.xs },
  rowKcal: { fontSize: 16, fontWeight: '800', color: T.textPrimary, ...tabularNums },
  rowKcalUnit: { ...type.bodySm, color: T.textSecondary },
  adjust: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  adjustText: { ...type.bodySm, fontWeight: '700', color: T.primary },

  empty: { ...type.bodySm, color: T.textMuted, textAlign: 'center', paddingVertical: spacing.lg },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    minHeight: HIT_TARGET,
    paddingVertical: spacing.lg - 2, borderRadius: radius.md,
    borderWidth: 1, borderColor: T.border, borderStyle: 'dashed',
  },
  addText: { ...type.body, fontWeight: '700', color: T.primary },
});
