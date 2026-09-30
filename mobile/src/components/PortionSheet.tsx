import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { FoodItem } from '../services/api';
import { UNITS, rescaleItem, stepFor } from '../utils/foodItems';
import { T, type, spacing, radius, HIT_TARGET, tabularNums } from '../theme';

interface Props {
  visible: boolean;
  /** The food to adjust, at its current portion. Null closes the sheet. */
  item: FoodItem | null;
  /** Label for the confirm button: "Add to meal", "Update", etc. */
  confirmLabel?: string;
  busy?: boolean;
  /** Show "logged before" under the name. Only for foods that came from history. */
  loggedBefore?: boolean;
  /** Let the name be corrected in place (the AI does misidentify foods). */
  editableName?: boolean;
  /** When set, a Remove action is shown. */
  onRemove?: () => void;
  onCancel: () => void;
  onConfirm: (item: FoodItem) => void;
}

/**
 * Adjust a portion.
 *
 * Deliberately does *not* decide the meal type or trigger the log; that lives
 * in the cart, so it's chosen once for the whole meal rather than per item.
 * This sheet only re-scales, via `rescaleItem`, which holds the food's density
 * constant so "1 katori" to "2 katori" doubles the calories rather than
 * re-guessing them.
 */
export function PortionSheet({
  visible,
  item,
  confirmLabel = 'Add to meal',
  busy,
  loggedBefore = false,
  editableName = false,
  onRemove,
  onCancel,
  onConfirm,
}: Props) {
  const [draft, setDraft] = useState<FoodItem | null>(item);
  const [gramsText, setGramsText] = useState('');
  const [qtyText, setQtyText] = useState('');
  // Re-seed whenever a different food is opened; `item` is the identity here.
  const [seed, setSeed] = useState<FoodItem | null>(item);

  if (item !== seed) {
    setSeed(item);
    setDraft(item);
    setGramsText(item ? String(item.grams) : '');
    setQtyText(item ? String(item.quantity) : '');
  }

  if (!draft) return null;

  const isGrams = draft.unit === 'g';
  const step = stepFor(draft.unit);

  const apply = (updated: FoodItem) => {
    setDraft(updated);
    setGramsText(String(updated.grams));
    setQtyText(String(updated.quantity));
  };

  const bump = (delta: number) => {
    const next = Math.max(step, Math.round((draft.quantity + delta) * 100) / 100);
    Haptics.selectionAsync();
    apply(rescaleItem(draft, next, draft.unit));
  };

  const changeUnit = (unit: string) => {
    if (unit === draft.unit) return;
    Haptics.selectionAsync();
    // Switching *to* grams carries the current weight over, so "1 katori"
    // becomes "180 g" rather than a nonsensical "1 g".
    const quantity = unit === 'g' ? Math.max(1, draft.grams) : 1;
    apply(rescaleItem(draft, quantity, unit));
  };

  const commitGrams = () => {
    const parsed = Number(gramsText);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setGramsText(String(draft.grams));
      return;
    }
    apply(rescaleItem(draft, Math.round(parsed), 'g'));
  };

  const commitQty = () => {
    const parsed = parseFloat(qtyText);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setQtyText(String(draft.quantity));
      return;
    }
    apply(rescaleItem(draft, Math.round(parsed * 100) / 100, draft.unit));
  };

  const subtitle = loggedBefore ? `${draft.grams} g · logged before` : `${draft.grams} g`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          {editableName ? (
            <TextInput
              style={styles.nameInput}
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
              placeholder="Food name"
              placeholderTextColor={T.textMuted}
              selectTextOnFocus
              accessibilityLabel="Food name"
            />
          ) : (
            <Text style={styles.name} numberOfLines={2}>{draft.name}</Text>
          )}
          <Text style={styles.sub}>{subtitle}</Text>

          <Text style={styles.label}>How much</Text>

          {isGrams ? (
            <View style={styles.gramsRow}>
              <TextInput
                value={gramsText}
                onChangeText={(t) => setGramsText(t.replace(/[^0-9]/g, ''))}
                onBlur={commitGrams}
                onSubmitEditing={commitGrams}
                keyboardType="number-pad"
                returnKeyType="done"
                maxLength={4}
                style={styles.gramsInput}
                accessibilityLabel="Weight in grams"
              />
              <Text style={styles.gramsUnit}>grams</Text>
            </View>
          ) : (
            <View style={styles.stepper}>
              <TouchableOpacity
                onPress={() => bump(-step)}
                style={styles.stepBtn}
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
              >
                <Ionicons name="remove" size={20} color={T.textPrimary} />
              </TouchableOpacity>
              {/* Editable so large counts don't need many taps. */}
              <TextInput
                value={qtyText}
                onChangeText={(t) => setQtyText(t.replace(/[^0-9.]/g, ''))}
                onBlur={commitQty}
                onSubmitEditing={commitQty}
                keyboardType="decimal-pad"
                returnKeyType="done"
                maxLength={5}
                style={styles.stepValue}
                textAlign="center"
                accessibilityLabel="Quantity"
              />
              <TouchableOpacity
                onPress={() => bump(step)}
                style={styles.stepBtn}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
              >
                <Ionicons name="add" size={20} color={T.textPrimary} />
              </TouchableOpacity>
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {UNITS.map((u) => {
              const active = u === draft.unit;
              return (
                <TouchableOpacity
                  key={u}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => changeUnit(u)}
                  hitSlop={{ top: 6, bottom: 6 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={u === 'g' ? 'grams' : u}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {u === 'g' ? 'grams' : u}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.macros}>
            <Macro value={`${draft.calories}`} label="kcal" color={T.primary} big />
            <Macro value={`${draft.protein_g} g`} label="Protein" color={T.protein} />
            <Macro value={`${draft.carbs_g} g`} label="Carbs" color={T.carbs} />
            <Macro value={`${draft.fat_g} g`} label="Fat" color={T.fat} />
          </View>

          <View style={styles.actions}>
            {onRemove && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={onRemove}
                disabled={busy}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Remove this item"
              >
                <Ionicons name="trash-outline" size={18} color={T.error} />
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.cta, busy && styles.ctaDisabled]}
              onPress={() => onConfirm(draft)}
              disabled={busy}
              activeOpacity={0.88}
              accessibilityRole="button"
            >
              <Ionicons name="checkmark" size={18} color={T.textOnPrimary} />
              <Text style={styles.ctaText}>{confirmLabel} · {draft.calories} kcal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Macro({ value, label, color, big }: { value: string; label: string; color: string; big?: boolean }) {
  return (
    <View style={styles.macro}>
      <Text style={[styles.macroValue, { color }, big && styles.macroValueBig]}>{value}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing['2xl'] + 4,
    gap: spacing.sm + 2,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.grabber,
    marginBottom: spacing.sm,
  },
  name: { ...type.title, color: T.textPrimary },
  nameInput: {
    ...type.titleSm,
    color: T.textPrimary,
    backgroundColor: T.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: spacing.lg - 2,
    paddingVertical: spacing.md,
  },
  sub: { ...type.bodySm, color: T.textMuted, marginTop: -4 },

  label: { ...type.label, color: T.textMuted, marginTop: spacing.sm },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, alignSelf: 'flex-start' },
  stepBtn: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: HIT_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  stepValue: {
    fontSize: 24,
    fontWeight: '800',
    color: T.textPrimary,
    minWidth: 72,
    height: HIT_TARGET,
    paddingVertical: 0,
    ...tabularNums,
  },

  gramsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  gramsInput: {
    fontSize: 26,
    fontWeight: '800',
    color: T.textPrimary,
    minWidth: 90,
    paddingVertical: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: T.primary,
    ...tabularNums,
  },
  gramsUnit: { ...type.body, fontWeight: '700', color: T.textSecondary, paddingBottom: spacing.sm },

  chipRow: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg - 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  chipActive: { backgroundColor: T.primary, borderColor: T.primary },
  chipText: { ...type.bodySm, fontWeight: '700', color: T.textSecondary },
  chipTextActive: { color: T.textOnPrimary },

  macros: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: T.divider,
  },
  macro: { gap: 2 },
  macroValue: { fontSize: 16, fontWeight: '800', ...tabularNums },
  macroValueBig: { fontSize: 26, letterSpacing: -0.8 },
  macroLabel: { ...type.label, color: T.textMuted },

  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm + 2 },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.border,
  },
  removeText: { ...type.body, fontWeight: '700', color: T.error },
  cta: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: T.primary,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: { ...type.body, fontWeight: '800', color: T.textOnPrimary },
});
