import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { FoodLog } from '../store/foodLogStore';
import { useAppTheme } from '../context/ThemeContext';

interface Props {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  logs: FoodLog[];
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export function MealSection({ mealType, logs }: Props) {
  const [expanded, setExpanded] = useState(true);
  const totalCals = logs.reduce((s, l) => s + (l.calories || 0), 0);
  const { theme } = useAppTheme();
  const accentColor = theme.meal[mealType];

  return (
    <View style={styles.container}>
      {/* Glass card header */}
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        style={[styles.header, { backgroundColor: accentColor + '0D' }]}
        activeOpacity={0.75}
      >
        <View style={styles.titleRow}>
          <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
          <Text style={styles.title}>{MEAL_LABELS[mealType]}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#3f4949"
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.entries}>
          {logs.length === 0 ? (
            <Text style={styles.empty}>No food logged yet</Text>
          ) : (
            logs.map((log) => <FoodLogCard key={log.id} log={log} accentColor={accentColor} />)
          )}
        </View>
      )}
    </View>
  );
}

function FoodLogCard({ log, accentColor }: { log: FoodLog; accentColor: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.card, { borderTopColor: theme.surfaceTrack }]}>
      {log.image_url ? (
        <Image source={{ uri: log.image_url }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder, { backgroundColor: theme.surfaceTrack }]}>
          <Text style={styles.placeholderEmoji}>🍽️</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <View style={styles.cardTop}>
          <Text style={[styles.foodName, { color: theme.onSurface }]} numberOfLines={1}>{log.food_name}</Text>
          <Text style={[styles.kcal, { color: theme.onSurfaceVariant }]}>{log.calories} kcal</Text>
        </View>
        <View style={styles.macroPills}>
          <Text style={[styles.pill, { backgroundColor: theme.protein + '1A', color: theme.proteinText }]}>P: {Math.round(log.protein_g)}g</Text>
          <Text style={[styles.pill, { backgroundColor: theme.carbs + '1A', color: theme.carbsText }]}>C: {Math.round(log.carbs_g)}g</Text>
          <Text style={[styles.pill, { backgroundColor: theme.fat + '1A', color: theme.fatText }]}>F: {Math.round(log.fat_g)}g</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E5E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accentBar: { width: 5, height: 28, borderRadius: 50 },
  title: { fontSize: 18, fontWeight: '700', color: '#181c1d' },
  entries: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4, gap: 10 },
  empty: { color: '#bec8c9', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
  },
  thumbnail: { width: 56, height: 56, borderRadius: 12 },
  thumbnailPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  placeholderEmoji: { fontSize: 26 },
  cardInfo: { flex: 1, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foodName: { flex: 1, fontSize: 14, fontWeight: '700', marginRight: 8 },
  kcal: { fontSize: 14, fontWeight: '700' },
  macroPills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    overflow: 'hidden',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
