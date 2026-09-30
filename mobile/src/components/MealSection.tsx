import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { FoodLog, useFoodLogStore } from '../store/foodLogStore';
import { toast } from '../store/toastStore';
import { T, spacing, radius, type, withAlpha, tabularNums } from '../theme';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface Props {
  mealType: MealType;
  logs: FoodLog[];
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

const MEAL_ICONS: Record<MealType, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'cafe-outline',
  lunch: 'fast-food-outline',
  dinner: 'restaurant-outline',
  snack: 'nutrition-outline',
};

const MEAL_ACCENTS: Record<MealType, string> = {
  breakfast: T.mealBreakfast,
  lunch: T.mealLunch,
  dinner: T.mealDinner,
  snack: T.mealSnack,
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

function itemsLabel(n: number): string {
  return `${n} ${n === 1 ? 'item' : 'items'}`;
}

/**
 * Long-press → confirm → optimistic remove with a 6 s undo. The server delete
 * only runs once the toast has expired (see `deleteLogWithUndo`), so "Undo"
 * is a real restore rather than a re-insert of a row that is already gone.
 */
function confirmDelete(logs: FoodLog[]) {
  const name = logs.length === 1 ? logs[0].food_name : itemsLabel(logs.length);
  Alert.alert(
    `Delete ${name}?`,
    logs.length === 1 ? 'This removes it from today’s log.' : 'This removes all of them from today’s log.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const { deleteLogWithUndo, restoreLog } = useFoodLogStore.getState();
          const removed = logs
            .map((l) => deleteLogWithUndo(l.id))
            .filter((l): l is FoodLog => l !== null);
          if (removed.length === 0) return;
          toast(`Removed ${name}`, {
            action: {
              label: 'Undo',
              onPress: () => removed.forEach((l) => restoreLog(l.id)),
            },
          });
        },
      },
    ],
  );
}

export function MealSection({ mealType, logs }: Props) {
  const [expanded, setExpanded] = useState(true);
  const totalCals = logs.reduce((s, l) => s + (l.calories || 0), 0);
  const accentColor = MEAL_ACCENTS[mealType];
  const isEmpty = logs.length === 0;

  // An empty meal is one quiet line: no chevron, no fabricated time, no body.
  if (isEmpty) {
    return (
      <View style={[styles.container, styles.emptyRow]}>
        <View style={[styles.iconBox, styles.iconBoxSm, { backgroundColor: withAlpha(accentColor, 0.13) }]}>
          <Ionicons name={MEAL_ICONS[mealType]} size={18} color={accentColor} />
        </View>
        <Text style={styles.emptyTitle}>{MEAL_LABELS[mealType]}</Text>
        <Text style={styles.emptyHint}>Nothing yet</Text>
      </View>
    );
  }

  const firstTime = formatTime(logs[0].logged_at);

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        style={styles.header}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${MEAL_LABELS[mealType]}, ${itemsLabel(logs.length)}, ${totalCals} kilocalories`}
        accessibilityState={{ expanded }}
      >
        <View style={[styles.iconBox, { backgroundColor: withAlpha(accentColor, 0.13) }]}>
          <Ionicons name={MEAL_ICONS[mealType]} size={22} color={accentColor} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{MEAL_LABELS[mealType]}</Text>
          <Text style={styles.subtitle}>
            {firstTime}{totalCals > 0 ? `  ·  ${totalCals} kcal` : ''}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={T.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.entries}>
          {groupByScan(logs).map((group) =>
            group.length === 1 ? (
              <FoodLogCard key={group[0].id} log={group[0]} accentColor={accentColor} />
            ) : (
              <ScannedMealGroup key={group[0].meal_id} logs={group} accentColor={accentColor} />
            ),
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

function Thumbnail({ uri }: { uri: string | null }) {
  return uri ? (
    <Image source={{ uri }} style={styles.thumbnail} accessibilityIgnoresInvertColors />
  ) : (
    <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
      <Ionicons name="image-outline" size={22} color={T.textMuted} />
    </View>
  );
}

/**
 * One scan that produced several foods: a single photo + total, with each item
 * listed beneath. Items stay visible — Home is today's diary, so hiding them
 * behind a tap (as History does) would cost more than the tidiness gains.
 */
function ScannedMealGroup({ logs, accentColor }: { logs: FoodLog[]; accentColor: string }) {
  const total = logs.reduce((s, l) => s + (l.calories || 0), 0);
  const image = logs.find((l) => l.image_url)?.image_url ?? null;

  return (
    <TouchableOpacity
      style={[styles.card, { alignItems: 'flex-start' }]}
      onLongPress={() => confirmDelete(logs)}
      delayLongPress={400}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${itemsLabel(logs.length)}, ${total} kilocalories`}
      accessibilityHint="Long press to delete"
    >
      <Thumbnail uri={image} />
      <View style={styles.cardInfo}>
        <View style={styles.cardTop}>
          <Text style={styles.foodName} numberOfLines={1}>
            {itemsLabel(logs.length)}
          </Text>
          <Text style={[styles.kcal, { color: accentColor }]}>{total} kcal</Text>
        </View>
        <View style={styles.groupItems}>
          {logs.map((log) => (
            <View key={log.id} style={styles.groupRow}>
              <Text style={styles.groupName} numberOfLines={1}>
                {log.food_name}
              </Text>
              <Text style={styles.groupKcal}>{log.calories} kcal</Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function FoodLogCard({ log, accentColor }: { log: FoodLog; accentColor: string }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onLongPress={() => confirmDelete([log])}
      delayLongPress={400}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${log.food_name}, ${log.calories} kilocalories`}
      accessibilityHint="Long press to delete"
    >
      <Thumbnail uri={log.image_url} />
      <View style={styles.cardInfo}>
        <View style={styles.cardTop}>
          <Text style={styles.foodName} numberOfLines={1}>{log.food_name}</Text>
          <Text style={[styles.kcal, { color: accentColor }]}>{log.calories} kcal</Text>
        </View>
        <Text style={styles.macroLine}>
          P {Math.round(log.protein_g)}g  ·  C {Math.round(log.carbs_g)}g  ·  F {Math.round(log.fat_g)}g
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: T.surface,
    borderColor: T.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBoxSm: { width: 32, height: 32 },
  titleBlock: { flex: 1, gap: 2 },
  title: { ...type.body, fontSize: 16, fontWeight: '700', color: T.textPrimary },
  subtitle: { ...type.bodySm, fontSize: 12, color: T.textMuted, ...tabularNums },

  /* Collapsed one-line row for a meal with nothing in it */
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  emptyTitle: { ...type.body, flex: 1, fontWeight: '600', color: T.textSecondary },
  emptyHint: { ...type.bodySm, color: T.textMuted },

  entries: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
    gap: 0,
    borderTopWidth: 1,
    borderTopColor: T.divider,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: T.divider,
  },
  thumbnail: { width: 52, height: 52, borderRadius: radius.sm },
  thumbnailPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: T.divider },
  cardInfo: { flex: 1, gap: spacing.xs },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foodName: { ...type.body, flex: 1, fontSize: 14, fontWeight: '700', color: T.textPrimary, marginRight: spacing.sm },
  kcal: { ...type.bodySm, fontWeight: '700', ...tabularNums },
  macroLine: { ...type.bodySm, fontSize: 12, color: T.textMuted, ...tabularNums },

  /* Multi-item scan: one photo, items listed beneath */
  groupItems: { gap: 5, marginTop: 2 },
  groupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  groupName: { ...type.bodySm, flex: 1, color: T.textSecondary },
  groupKcal: { ...type.bodySm, fontWeight: '600', color: T.textMuted, ...tabularNums },
});
