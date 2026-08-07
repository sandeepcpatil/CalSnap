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
import { T } from '../theme';

interface Props {
  visible: boolean;
  /** The food to adjust, at its current portion. Null closes the sheet. */
  item: FoodItem | null;
  /** Label for the confirm button — "Add to meal", "Update", etc. */
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (item: FoodItem) => void;
}

/**
 * Adjust a portion.
 *
 * Deliberately does *not* decide the meal type or trigger the log — that lives
 * in the cart, so it's chosen once for the whole meal rather than per item.
 * This sheet only re-scales, via `rescaleItem`, which holds the food's density
 * constant so "1 katori" → "2 katori" doubles the calories rather than
 * re-guessing them.
 */
export function PortionSheet({ visible, item, confirmLabel = 'Add to meal', busy, onCancel, onConfirm }: Props) {
  const [draft, setDraft] = useState<FoodItem | null>(item);
  const [gramsText, setGramsText] = useState('');
  // Re-seed whenever a different food is opened; `item` is the identity here.
  const [seed, setSeed] = useState<FoodItem | null>(item);

  if (item !== seed) {
    setSeed(item);
    setDraft(item);
    setGramsText(item ? String(item.grams) : '');
  }

  if (!draft) return null;

  const isGrams = draft.unit === 'g';
  const step = stepFor(draft.unit);

  const bump = (delta: number) => {
    const next = Math.max(step, Math.round((draft.quantity + delta) * 100) / 100);
    Haptics.selectionAsync();
    const updated = rescaleItem(draft, next, draft.unit);
    setDraft(updated);
    setGramsText(String(updated.grams));
  };

  const changeUnit = (unit: string) => {
    if (unit === draft.unit) return;
    Haptics.selectionAsync();
    // Switching *to* grams carries the current weight over, so "1 katori"
    // becomes "180 g" rather than a nonsensical "1 g".
    const quantity = unit === 'g' ? Math.max(1, draft.grams) : 1;
    const updated = rescaleItem(draft, quantity, unit);
    setDraft(updated);
    setGramsText(String(updated.grams));
  };

  const commitGrams = () => {
    const parsed = Number(gramsText);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setGramsText(String(draft.grams));
      return;
    }
    setDraft(rescaleItem(draft, Math.round(parsed), 'g'));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <Text style={styles.name} numberOfLines={2}>{draft.name}</Text>
          <Text style={styles.sub}>{draft.grams} g · logged before</Text>

          <Text style={styles.label}>How much?</Text>

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
              <Text style={styles.stepValue}>{draft.quantity}</Text>
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
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {u === 'g' ? 'grams' : u}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.macros}>
            <Macro value={`${draft.calories}`} label="KCAL" color={T.primary} big />
            <Macro value={`${draft.protein_g}g`} label="PRO" color={T.protein} />
            <Macro value={`${draft.carbs_g}g`} label="CARB" color={T.carbs} />
            <Macro value={`${draft.fat_g}g`} label="FAT" color={T.fat} />
          </View>

          <TouchableOpacity
            style={[styles.cta, busy && styles.ctaDisabled]}
            onPress={() => onConfirm(draft)}
            disabled={busy}
            activeOpacity={0.88}
          >
            <Ionicons name="checkmark" size={18} color={T.textOnPrimary} />
            <Text style={styles.ctaText}>{confirmLabel} · {draft.calories} kcal</Text>
          </TouchableOpacity>
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
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.surfaceOffset,
    marginBottom: 8,
  },
  name: { fontSize: 19, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.3 },
  sub: { fontSize: 12.5, fontWeight: '600', color: T.textMuted, marginTop: -4 },

  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: T.textMuted,
    marginTop: 8,
  },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 18, alignSelf: 'flex-start' },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  stepValue: { fontSize: 24, fontWeight: '800', color: T.textPrimary, minWidth: 48, textAlign: 'center' },

  gramsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  gramsInput: {
    fontSize: 26,
    fontWeight: '800',
    color: T.textPrimary,
    minWidth: 90,
    paddingVertical: 4,
    borderBottomWidth: 2,
    borderBottomColor: T.primary,
  },
  gramsUnit: { fontSize: 14, fontWeight: '700', color: T.textSecondary, paddingBottom: 8 },

  chipRow: { gap: 8, paddingVertical: 4, paddingRight: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 50,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  chipActive: { backgroundColor: T.primary, borderColor: T.primary },
  chipText: { fontSize: 12.5, fontWeight: '700', color: T.textSecondary },
  chipTextActive: { color: T.textOnPrimary },

  macros: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 20,
    paddingVertical: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: T.divider,
  },
  macro: { gap: 2 },
  macroValue: { fontSize: 16, fontWeight: '800' },
  macroValueBig: { fontSize: 26, letterSpacing: -0.8 },
  macroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: T.textMuted },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 15,
    backgroundColor: T.primary,
    marginTop: 10,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: { fontSize: 15, fontWeight: '800', color: T.textOnPrimary, letterSpacing: 0.2 },
});
