import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { FoodLog } from '../store/foodLogStore';
import { useTheme } from '../hooks/useTheme';
import { T } from '../theme';

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
    <View style={[styles.container, { backgroundColor: T.surface, borderColor: T.border }]}>
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
        <View style={[styles.entries, { borderTopColor: T.divider }]}>
          {logs.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textMuted }]}>No food logged yet</Text>
          ) : (
            groupByScan(logs).map((group) =>
              group.length === 1 ? (
                <FoodLogCard key={group[0].id} log={group[0]} accentColor={accentColor} />
              ) : (
                <ScannedMealGroup key={group[0].meal_id} logs={group} accentColor={accentColor} />
              ),
            )
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Rows from one multi-item scan share a `meal_id`. Grouping them lets the photo
 * render once instead of repeating identically for every item.
 * Ungrouped rows (manual entries, legacy logs) each become their own group.
 */
function groupByScan(logs: FoodLog[]): FoodLog[][] {
  const groups: FoodLog[][] = [];
  const byId = new Map<string, FoodLog[]>();
  for (const log of logs) {
    if (!log.meal_id) {
      groups.push([log]);
      continue;
    }
    const existing = byId.get(log.meal_id);
    if (existing) {
      existing.push(log);
    } else {
      const arr = [log];
      byId.set(log.meal_id, arr);
      groups.push(arr);
    }
  }
  return groups;
}

/**
 * One scan that produced several foods: a single photo + total, with each item
 * listed beneath. Items stay visible — Home is today's diary, so hiding them
 * behind a tap (as History does) would cost more than the tidiness gains.
 */
function ScannedMealGroup({ logs, accentColor }: { logs: FoodLog[]; accentColor: string }) {
  const { theme } = useTheme();
  const total = logs.reduce((s, l) => s + (l.calories || 0), 0);
  const image = logs.find((l) => l.image_url)?.image_url ?? null;

  return (
    <View style={[styles.card, { borderTopColor: T.divider, alignItems: 'flex-start' }]}>
      {image ? (
        <Image source={{ uri: image }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder, { backgroundColor: T.divider }]}>
          <Ionicons name="image-outline" size={22} color={theme.textMuted} />
        </View>
      )}
      <View style={styles.cardInfo}>
        <View style={styles.cardTop}>
          <Text style={[styles.foodName, { color: theme.textPrimary }]} numberOfLines={1}>
            {logs.length} items
          </Text>
          <Text style={[styles.kcal, { color: accentColor }]}>{total} kcal</Text>
        </View>
        <View style={styles.groupItems}>
          {logs.map((log) => (
            <View key={log.id} style={styles.groupRow}>
              <Text style={[styles.groupName, { color: theme.textSecondary }]} numberOfLines={1}>
                {log.food_name}
              </Text>
              <Text style={[styles.groupKcal, { color: theme.textMuted }]}>{log.calories}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function FoodLogCard({ log, accentColor }: { log: FoodLog; accentColor: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { borderTopColor: T.divider }]}>
      {log.image_url ? (
        <Image source={{ uri: log.image_url }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder, { backgroundColor: T.divider }]}>
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

  /* Multi-item scan: one photo, items listed beneath */
  groupItems: { gap: 5, marginTop: 2 },
  groupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  groupName: { flex: 1, fontSize: 13, fontWeight: '500' },
  groupKcal: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
