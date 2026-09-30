import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import type { MealType } from '../services/foodLogs';
import { T, type, spacing, radius, HIT_TARGET } from '../theme';

const MEALS: readonly { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snack' },
];

interface Props {
  value: MealType;
  onChange: (meal: MealType) => void;
}

/** Breakfast / Lunch / Dinner / Snack selector, one row of chips. */
export function MealTypePicker({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {MEALS.map((m) => {
        const active = m.key === value;
        return (
          <TouchableOpacity
            key={m.key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => { Haptics.selectionAsync(); onChange(m.key); }}
            accessibilityRole="button"
            accessibilityLabel={m.label}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs + 2 },
  chip: {
    flex: 1,
    minHeight: HIT_TARGET,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  chipActive: { backgroundColor: T.primaryTint, borderColor: T.primaryBorder },
  chipText: { ...type.bodySm, fontWeight: '700', color: T.textSecondary },
  chipTextActive: { color: T.primary },
});
