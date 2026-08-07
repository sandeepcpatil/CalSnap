import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import type { MealType } from '../services/foodLogs';
import { T } from '../theme';

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

/** Breakfast / Lunch / Dinner / Snack selector — one row of chips. */
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
  row: { flexDirection: 'row', gap: 6 },
  chip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: 'center',
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  chipActive: { backgroundColor: T.primaryTint, borderColor: 'rgba(133,211,218,0.45)' },
  chipText: { fontSize: 12.5, fontWeight: '700', color: T.textSecondary },
  chipTextActive: { color: T.primary },
});
