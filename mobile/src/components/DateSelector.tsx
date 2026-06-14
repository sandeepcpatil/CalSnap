import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDisplay(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = addDays(today, -1);

  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';

  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function DateSelector({ selectedDate, onDateChange }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const isToday = selectedDate === today;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => onDateChange(addDays(selectedDate, -1))} style={styles.arrow}>
        <Ionicons name="chevron-back" size={20} color="#546e7a" />
      </TouchableOpacity>

      <Text variant="titleMedium" style={styles.date}>{formatDisplay(selectedDate)}</Text>

      <TouchableOpacity
        onPress={() => !isToday && onDateChange(addDays(selectedDate, 1))}
        style={[styles.arrow, isToday && styles.arrowDisabled]}
        disabled={isToday}
      >
        <Ionicons name="chevron-forward" size={20} color={isToday ? '#e0e0e0' : '#546e7a'} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
  },
  arrow: { padding: 8 },
  arrowDisabled: { opacity: 0.4 },
  date: { color: '#37474f', fontWeight: '600', minWidth: 100, textAlign: 'center' },
});
