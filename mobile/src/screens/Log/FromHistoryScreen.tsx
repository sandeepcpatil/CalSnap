import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { useNotificationStore } from '../../store/notificationStore';
import { fetchLoggableFoods, type LoggableFood } from '../../services/recentFoods';
import { logFoodItems, type MealType } from '../../services/foodLogs';
import { getMealTypeFromTime } from '../../utils/nutrition';
import { PortionSheet } from '../../components/PortionSheet';
import { fetchSavedMeals, touchSavedMeal, type SavedMeal } from '../../services/savedMeals';
import { sumItems } from '../../utils/foodItems';
import type { FoodItem } from '../../services/api';
import { T } from '../../theme';

interface Props {
  navigation: {
    goBack: () => void;
    navigate: (screen: 'CreateMeal', params?: { meal?: SavedMeal }) => void;
    addListener: (event: 'focus', cb: () => void) => () => void;
  };
}

/** The two things behind this screen: single past foods, and named combos. */
type Tab = 'foods' | 'meals';

/** "yesterday", "2 days ago", "3 Aug" — short enough to sit on one line. */
function relativeDay(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(then)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Re-log something you've eaten before.
 *
 * This is the fastest path in the app: one tap, no camera, no AI call — and
 * critically no scan quota, because the nutrition is already known. For anyone
 * eating the same dal and rice most nights this beats photographing it.
 */
export function FromHistoryScreen({ navigation }: Props) {
  const { session } = useAuthStore();
  const addLog = useFoodLogStore((s) => s.addLog);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [frequent, setFrequent] = useState<LoggableFood[]>([]);
  const [recent, setRecent] = useState<LoggableFood[]>([]);
  const [query, setQuery] = useState('');
  const [busyName, setBusyName] = useState<string | null>(null);
  const [sheetItem, setSheetItem] = useState<FoodItem | null>(null);
  const [tab, setTab] = useState<Tab>('foods');
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  /** Bumped to force a reload after the meal builder saves something. */
  const [reloadKey, setReloadKey] = useState(0);

  const userId = session?.user.id;

  useEffect(() => {
    let cancelled = false;
    if (!userId) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [history, saved] = await Promise.all([
          fetchLoggableFoods(userId),
          fetchSavedMeals(userId),
        ]);
        if (cancelled) return;
        setFrequent(history.frequent);
        setRecent(history.recent);
        setMeals(saved);
      } catch {
        if (!cancelled) setError("Couldn't load your history. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, reloadKey]);

  // The builder is a separate screen, so its result only shows up when we come
  // back into focus.
  useEffect(() => navigation.addListener('focus', () => setReloadKey((k) => k + 1)), [navigation]);

  const commitLog = useCallback(
    async (item: FoodItem, mealType: MealType) => {
      if (!userId) return;
      setBusyName(item.name);
      try {
        const rows = await logFoodItems({
          userId,
          items: [item],
          mealType,
          source: { origin: 're-log', edited: true },
        });
        rows.forEach(addLog);
        useNotificationStore.getState().refreshStreakReminder(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSheetItem(null);
        navigation.goBack();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not log that. Please try again.');
      } finally {
        setBusyName(null);
      }
    },
    [userId, addLog, navigation],
  );

  const logSavedMeal = useCallback(
    async (meal: SavedMeal) => {
      if (!userId) return;
      setBusyName(meal.id);
      try {
        const rows = await logFoodItems({
          userId,
          items: meal.items,
          mealType: getMealTypeFromTime(),
          source: { origin: 'saved-meal', saved_meal_name: meal.name },
        });
        rows.forEach(addLog);
        touchSavedMeal(meal.id);
        useNotificationStore.getState().refreshStreakReminder(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.goBack();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not log that. Please try again.');
      } finally {
        setBusyName(null);
      }
    },
    [userId, addLog, navigation],
  );

  // Searching collapses the two sections into one flat result list — a split
  // between "frequent" and "recent" is noise once you've typed a name.
  const q = query.trim().toLowerCase();
  const results = useMemo(
    () => (q ? recent.filter((f) => f.item.name.toLowerCase().includes(q)) : []),
    [q, recent],
  );
  const mealResults = useMemo(
    () => (q ? meals.filter((m) => m.name.toLowerCase().includes(q)) : meals),
    [q, meals],
  );

  const renderRow = (food: LoggableFood, subtitle: string) => (
    <TouchableOpacity
      key={food.item.name}
      style={styles.row}
      onPress={() => setSheetItem(food.item)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${food.item.name}. Tap to adjust the portion before logging.`}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>{food.item.name}</Text>
        <Text style={styles.rowSub}>{food.item.calories} kcal · {subtitle}</Text>
      </View>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => commitLog(food.item, getMealTypeFromTime())}
        disabled={busyName === food.item.name}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Log ${food.item.name} now`}
      >
        {busyName === food.item.name ? (
          <ActivityIndicator size={14} color={T.textOnPrimary} />
        ) : (
          <Ionicons name="add" size={20} color={T.textOnPrimary} />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderMealRow = (meal: SavedMeal) => {
    const totals = sumItems(meal.items);
    return (
      <TouchableOpacity
        key={meal.id}
        style={styles.row}
        onPress={() => navigation.navigate('CreateMeal', { meal })}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${meal.name}. Tap to edit this meal.`}
      >
        <View style={styles.rowText}>
          <Text style={styles.rowName} numberOfLines={1}>{meal.name}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {totals.calories} kcal · {meal.items.map((i) => i.name).join(' · ')}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => logSavedMeal(meal)}
          disabled={busyName === meal.id}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Log ${meal.name} now`}
        >
          {busyName === meal.id ? (
            <ActivityIndicator size={14} color={T.textOnPrimary} />
          ) : (
            <Ionicons name="add" size={20} color={T.textOnPrimary} />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={navigation.goBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={T.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find a food</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={17} color={T.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={tab === 'meals' ? 'Search your meals' : 'Search your foods'}
          placeholderTextColor={T.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={17} color={T.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Recent foods and saved meals answer the same question — "I know what I
          ate, don't make me photograph it" — so they share one entry point
          rather than competing for a tile in the hub. */}
      <View style={styles.segmented}>
        {([['foods', 'Recent'], ['meals', 'My Meals']] as const).map(([key, label]) => {
          const active = tab === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => { Haptics.selectionAsync(); setTab(key); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={T.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={T.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {tab === 'meals' ? (
            <>
              {mealResults.length === 0 ? (
                <View style={styles.emptyBlock}>
                  <Ionicons name="albums-outline" size={30} color={T.textMuted} />
                  <Text style={styles.emptyTitle}>
                    {q ? 'No meal by that name' : 'No saved meals yet'}
                  </Text>
                  <Text style={styles.emptyText}>
                    Save a combo you eat often — "my usual breakfast" — and log the
                    whole thing in one tap.
                  </Text>
                </View>
              ) : (
                <View style={styles.card}>
                  {mealResults.map((m) => renderMealRow(m))}
                </View>
              )}

              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => navigation.navigate('CreateMeal')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Create a meal"
              >
                <Ionicons name="add-circle-outline" size={20} color={T.primary} />
                <View style={styles.createText}>
                  <Text style={styles.createTitle}>Create a meal</Text>
                  <Text style={styles.createSub}>Combine foods you eat together</Text>
                </View>
              </TouchableOpacity>
            </>
          ) : recent.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Ionicons name="time-outline" size={30} color={T.textMuted} />
              <Text style={styles.emptyTitle}>Nothing to re-log yet</Text>
              <Text style={styles.emptyText}>
                Scan a few meals first — they'll show up here for one-tap logging.
              </Text>
            </View>
          ) : q ? (
            results.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyText}>No match for “{query}”.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionLabel}>{results.length} match{results.length === 1 ? '' : 'es'}</Text>
                <View style={styles.card}>
                  {results.map((f) => renderRow(f, relativeDay(f.lastLoggedAt)))}
                </View>
              </>
            )
          ) : (
            <>
              {frequent.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>You log this often</Text>
                  <View style={styles.card}>
                    {frequent.map((f) => renderRow(f, `${f.count}× this month`))}
                  </View>
                </>
              )}

              <Text style={styles.sectionLabel}>Recent</Text>
              <View style={styles.card}>
                {recent.slice(0, 25).map((f) => renderRow(f, relativeDay(f.lastLoggedAt)))}
              </View>
            </>
          )}

          <View style={styles.note}>
            <Ionicons name="checkmark-circle" size={15} color={T.success} />
            <Text style={styles.noteText}>
              {tab === 'meals' ? 'Saved meals never use a scan.' : 'Re-logging never uses a scan.'}
            </Text>
          </View>
        </ScrollView>
      )}

      <PortionSheet
        visible={sheetItem !== null}
        item={sheetItem}
        defaultMeal={getMealTypeFromTime()}
        busy={busyName !== null}
        onCancel={() => setSheetItem(null)}
        onConfirm={commitLog}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.2 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 14,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: T.textPrimary, padding: 0 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,158,148,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,158,148,0.30)',
  },
  errorText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: T.error },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyBlock: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 24 },

  segmented: {
    flexDirection: 'row',
    gap: 4,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 4,
    borderRadius: 13,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  segmentActive: { backgroundColor: T.primary },
  segmentText: { fontSize: 13, fontWeight: '700', color: T.textSecondary },
  segmentTextActive: { color: T.textOnPrimary },

  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: T.primaryTint,
    borderWidth: 1,
    borderColor: 'rgba(133,211,218,0.35)',
    marginTop: 4,
  },
  createText: { flex: 1, gap: 2 },
  createTitle: { fontSize: 14.5, fontWeight: '800', color: T.textPrimary },
  createSub: { fontSize: 12, fontWeight: '600', color: T.textMuted },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: T.textPrimary },
  emptyText: { fontSize: 13.5, color: T.textMuted, textAlign: 'center', lineHeight: 20 },

  scroll: { padding: 16, gap: 10, paddingBottom: 32 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: T.textMuted,
    marginTop: 6,
  },

  card: {
    borderRadius: 16,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.divider,
  },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 14.5, fontWeight: '700', color: T.textPrimary },
  rowSub: { fontSize: 12, fontWeight: '600', color: T.textMuted },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primary,
  },

  note: { flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'center', marginTop: 8 },
  noteText: { fontSize: 12, fontWeight: '600', color: T.textMuted },
});
