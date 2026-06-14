import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { FoodLog } from '../store/foodLogStore';

interface Props {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  logs: FoodLog[];
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: '🌅 Breakfast',
  lunch: '☀️ Lunch',
  dinner: '🌙 Dinner',
  snack: '🍎 Snack',
};

export function MealSection({ mealType, logs }: Props) {
  const [expanded, setExpanded] = useState(true);
  const totalCals = logs.reduce((s, l) => s + (l.calories || 0), 0);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} style={styles.header} activeOpacity={0.7}>
        <Text variant="titleSmall" style={styles.title}>{MEAL_LABELS[mealType]}</Text>
        <View style={styles.headerRight}>
          {totalCals > 0 && (
            <Text variant="labelMedium" style={styles.totalCals}>{totalCals} kcal</Text>
          )}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#90a4ae" />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.entries}>
          {logs.length === 0 ? (
            <Text variant="bodySmall" style={styles.empty}>No food logged yet</Text>
          ) : (
            logs.map((log) => <FoodLogCard key={log.id} log={log} />)
          )}
        </View>
      )}
    </View>
  );
}

function FoodLogCard({ log }: { log: FoodLog }) {
  return (
    <View style={styles.card}>
      {log.image_url ? (
        <Image source={{ uri: log.image_url }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Text style={{ fontSize: 20 }}>🍽️</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text variant="titleSmall" style={styles.foodName} numberOfLines={1}>{log.food_name}</Text>
        <Text variant="bodySmall" style={styles.macros}>
          {log.calories} kcal · P {Math.round(log.protein_g)}g · C {Math.round(log.carbs_g)}g · F {Math.round(log.fat_g)}g
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  title: { color: '#37474f', fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalCals: { color: '#01696f', fontWeight: '600' },
  entries: { padding: 10, gap: 8 },
  empty: { color: '#bdbdbd', textAlign: 'center', paddingVertical: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 4 },
  thumbnail: { width: 44, height: 44, borderRadius: 10 },
  thumbnailPlaceholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1 },
  foodName: { color: '#37474f', fontWeight: '600' },
  macros: { color: '#90a4ae', marginTop: 2 },
});
