import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { FoodLog } from '../store/foodLogStore';
import { useTheme } from '../hooks/useTheme';

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

const MEAL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'cafe-outline',
  lunch: 'fast-food-outline',
  dinner: 'restaurant-outline',
  snack: 'nutrition-outline',
};

const MEAL_TIMES: Record<string, string> = {
  breakfast: '8:00 AM',
  lunch: '12:30 PM',
  dinner: '7:00 PM',
  snack: '3:30 PM',
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
  } catch {
    return '';
  }
}

export function MealSection({ mealType, logs }: Props) {
  const [expanded, setExpanded] = useState(true);
  const totalCals = logs.reduce((s, l) => s + (l.calories || 0), 0);
  const { theme } = useTheme();
  const accentColor = theme.meal[mealType];
  const firstTime = logs.length > 0 ? formatTime(logs[0].logged_at) : MEAL_TIMES[mealType];

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(15,23,42,0.80)', borderColor: 'rgba(255,255,255,0.08)' }]}>
      {/* Header */}
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        style={styles.header}
        activeOpacity={0.75}
      >
        <View style={[styles.iconBox, { backgroundColor: accentColor + '22' }]}>
          <Ionicons name={MEAL_ICONS[mealType]} size={22} color={accentColor} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{MEAL_LABELS[mealType]}</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {firstTime}{totalCals > 0 ? `  ·  ${totalCals} kcal` : ''}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.entries, { borderTopColor: 'rgba(255,255,255,0.06)' }]}>
          {logs.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textMuted }]}>No food logged yet</Text>
          ) : (
            logs.map((log) => <FoodLogCard key={log.id} log={log} accentColor={accentColor} />)
          )}
        </View>
      )}
    </View>
  );
}

function FoodLogCard({ log, accentColor }: { log: FoodLog; accentColor: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { borderTopColor: 'rgba(255,255,255,0.06)' }]}>
      {log.image_url ? (
        <Image source={{ uri: log.image_url }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
          <Ionicons name="image-outline" size={22} color={theme.textMuted} />
        </View>
      )}
      <View style={styles.cardInfo}>
        <View style={styles.cardTop}>
          <Text style={[styles.foodName, { color: theme.textPrimary }]} numberOfLines={1}>{log.food_name}</Text>
          <Text style={[styles.kcal, { color: accentColor }]}>{log.calories} kcal</Text>
        </View>
        <Text style={[styles.macroLine, { color: theme.textMuted }]}>
          P {Math.round(log.protein_g)}g  ·  C {Math.round(log.carbs_g)}g  ·  F {Math.round(log.fat_g)}g
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleBlock: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500' },
  entries: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    gap: 0,
    borderTopWidth: 1,
  },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  thumbnail: { width: 52, height: 52, borderRadius: 10 },
  thumbnailPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foodName: { flex: 1, fontSize: 14, fontWeight: '700', marginRight: 8 },
  kcal: { fontSize: 13, fontWeight: '700' },
  macroLine: { fontSize: 12, fontWeight: '500' },
});
