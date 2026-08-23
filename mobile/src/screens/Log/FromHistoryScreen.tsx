import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { useNotificationStore } from '../../store/notificationStore';
import { fetchLoggableFoods, type LoggableFood } from '../../services/recentFoods';
import { logFoodItems, type MealType } from '../../services/foodLogs';
import { getMealTypeFromTime } from '../../utils/nutrition';
import { PortionSheet } from '../../components/PortionSheet';
import { MealTypePicker } from '../../components/MealTypePicker';
import { fetchSavedMeals, touchSavedMeal, type SavedMeal } from '../../services/savedMeals';
import { searchFoods, itemFromDbFood, sourceLabel, MIN_FOOD_QUERY, type FoodDbRow } from '../../services/foodSearch';
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
 * Re-log foods you've eaten before, or log a saved meal.
 *
 * Nothing logs on the first tap. Picks land in a cart, where you set the
 * portions, remove mistakes and choose the meal (breakfast / lunch / …) once
 * for the whole thing — then log it in one go. No camera, no AI, no scan quota,
 * because the nutrition is already known.
 */
export function FromHistoryScreen({ navigation }: Props) {
  const { session } = useAuthStore();
  const addLog = useFoodLogStore((s) => s.addLog);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [frequent, setFrequent] = useState<LoggableFood[]>([]);
  const [recent, setRecent] = useState<LoggableFood[]>([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('foods');
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  // Ranked results from the shared IFCT + USDA food database.
  const [dbResults, setDbResults] = useState<FoodDbRow[]>([]);
  const [dbSearching, setDbSearching] = useState(false);
  /** Bumped to force a reload after the meal builder saves something. */
  const [reloadKey, setReloadKey] = useState(0);

  // ── The cart — the review step before anything is logged ──────────────────
  const [cart, setCart] = useState<FoodItem[]>([]);
  const [cartMeal, setCartMeal] = useState<MealType>(getMealTypeFromTime());
  const [cartOpen, setCartOpen] = useState(false);
  /** Index of the cart item being re-portioned, or null. */
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [logging, setLogging] = useState(false);

  // FindFood is the first route of a nested stack, so its own navigator has
  // nothing to pop and the press would otherwise fall through to Android's
  // default (close the app). Also lets back dismiss the cart instead of
  // abandoning what you were assembling.
  useAndroidBack(
    useCallback(() => {
      if (cartOpen) { setCartOpen(false); return true; }
      navigation.goBack();
      return true;
    }, [cartOpen, navigation]),
  );

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

  const addToCart = useCallback((items: FoodItem | FoodItem[]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart((prev) => [...prev, ...(Array.isArray(items) ? items : [items])]);
  }, []);

  const removeFromCart = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Saved meals track their real usage for the "log this often" ranking. We
  // remember which ones fed the cart so `last_used_at` is only bumped on an
  // actual log, not on adding-then-cancelling.
  const [pendingMealIds, setPendingMealIds] = useState<string[]>([]);

  const logCart = useCallback(async () => {
    if (!userId || cart.length === 0) return;
    setLogging(true);
    try {
      const rows = await logFoodItems({
        userId,
        items: cart,
        mealType: cartMeal,
        source: { origin: 're-log' },
      });
      rows.forEach(addLog);
      pendingMealIds.forEach(touchSavedMeal);
      const notif = useNotificationStore.getState();
      void notif.refreshStreakReminder(true);
      // First log ever → offer to turn on reminders (self-gates to once).
      void notif.promptForRemindersOnce();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log that. Please try again.');
      setLogging(false);
    }
  }, [userId, cart, cartMeal, pendingMealIds, addLog, navigation]);

  // Search the shared food database (IFCT + USDA) as the user types — only on
  // the foods tab. Debounced so a word is one query, not one-per-keystroke, and
  // guarded against races so a slow early response can't overwrite a newer one.
  useEffect(() => {
    const term = query.trim();
    if (tab !== 'foods' || term.length < MIN_FOOD_QUERY) {
      setDbResults([]);
      setDbSearching(false);
      return;
    }
    let active = true;
    setDbSearching(true);
    const handle = setTimeout(() => {
      searchFoods(term)
        .then((rows) => { if (active) setDbResults(rows); })
        .catch(() => { if (active) setDbResults([]); })
        .finally(() => { if (active) setDbSearching(false); });
    }, 280);
    return () => { active = false; clearTimeout(handle); };
  }, [query, tab]);

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
  const cartTotals = useMemo(() => sumItems(cart), [cart]);

  const renderRow = (food: LoggableFood, subtitle: string) => (
    <TouchableOpacity
      key={food.item.name}
      style={styles.row}
      onPress={() => addToCart(food.item)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Add ${food.item.name} to your meal`}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>{food.item.name}</Text>
        <Text style={styles.rowSub}>{food.item.calories} kcal · {subtitle}</Text>
      </View>
      <View style={styles.addBtn}>
        <Ionicons name="add" size={20} color={T.textOnPrimary} />
      </View>
    </TouchableOpacity>
  );

  const renderDbRow = (row: FoodDbRow) => (
    <TouchableOpacity
      key={`db-${row.id}`}
      style={styles.row}
      onPress={() => addToCart(itemFromDbFood(row))}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Add ${row.name} to your meal`}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>{row.name}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {Math.round(row.energy_kcal)} kcal / 100 g · {sourceLabel(row.source)}
        </Text>
      </View>
      <View style={styles.addBtn}>
        <Ionicons name="add" size={20} color={T.textOnPrimary} />
      </View>
    </TouchableOpacity>
  );

  const renderMealRow = (meal: SavedMeal) => {
    const totals = sumItems(meal.items);
    return (
      <View key={meal.id} style={styles.row}>
        <TouchableOpacity
          style={styles.rowText}
          onPress={() => navigation.navigate('CreateMeal', { meal })}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Edit the meal ${meal.name}`}
        >
          <Text style={styles.rowName} numberOfLines={1}>{meal.name}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {totals.calories} kcal · {meal.items.map((i) => i.name).join(' · ')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { addToCart(meal.items); setPendingMealIds((p) => [...p, meal.id]); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Add ${meal.name} to your meal`}
        >
          <Ionicons name="add" size={20} color={T.textOnPrimary} />
        </TouchableOpacity>
      </View>
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
          placeholder={tab === 'meals' ? 'Search your meals' : 'Search foods & history'}
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
            results.length === 0 && dbResults.length === 0 && !dbSearching ? (
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyText}>No match for “{query}”.</Text>
              </View>
            ) : (
              <>
                {results.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>From your history</Text>
                    <View style={styles.card}>
                      {results.map((f) => renderRow(f, relativeDay(f.lastLoggedAt)))}
                    </View>
                  </>
                )}

                <Text style={styles.sectionLabel}>From the food database</Text>
                {dbResults.length > 0 ? (
                  <View style={styles.card}>
                    {dbResults.map((r) => renderDbRow(r))}
                  </View>
                ) : dbSearching ? (
                  <View style={styles.dbLoading}>
                    <ActivityIndicator size="small" color={T.primary} />
                    <Text style={styles.dbLoadingText}>Searching database…</Text>
                  </View>
                ) : (
                  <Text style={styles.dbEmptyText}>No database match for “{query}”.</Text>
                )}
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

          {/* Room so the last row isn't hidden behind the cart bar. */}
          {cart.length > 0 && <View style={{ height: 76 }} />}
        </ScrollView>
      )}

      {/* ── Cart bar — tap to review before logging ── */}
      {cart.length > 0 && !cartOpen && (
        <TouchableOpacity
          style={styles.cartBar}
          onPress={() => setCartOpen(true)}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`Review your meal, ${cart.length} items, ${cartTotals.calories} kcal`}
        >
          <View style={styles.cartBarBadge}>
            <Text style={styles.cartBarBadgeText}>{cart.length}</Text>
          </View>
          <Text style={styles.cartBarText}>
            {cart.length} item{cart.length === 1 ? '' : 's'} · {cartTotals.calories} kcal
          </Text>
          <Text style={styles.cartBarCta}>Review</Text>
          <Ionicons name="chevron-up" size={18} color={T.textOnPrimary} />
        </TouchableOpacity>
      )}

      {/* ── Cart panel — the review/edit/log step (plain overlay, so the
            PortionSheet modal can still open above it) ── */}
      {cartOpen && (
        <View style={styles.cartScrim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCartOpen(false)} />
          <SafeAreaView edges={['bottom']} style={styles.cartPanel}>
            <View style={styles.cartGrab} />
            <View style={styles.cartHead}>
              <Text style={styles.cartTitle}>Your meal</Text>
              <TouchableOpacity onPress={() => setCartOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-down" size={22} color={T.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.cartLabel}>Add to</Text>
            <MealTypePicker value={cartMeal} onChange={setCartMeal} />

            <ScrollView style={styles.cartList} keyboardShouldPersistTaps="handled">
              {cart.map((it, i) => (
                <View key={`${it.name}-${i}`} style={styles.cartItem}>
                  <TouchableOpacity
                    style={styles.cartItemMain}
                    onPress={() => setEditIndex(i)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${it.name}, ${it.quantity} ${it.unit}`}
                  >
                    <Text style={styles.cartItemName} numberOfLines={1}>{it.name}</Text>
                    <Text style={styles.cartItemMeta}>
                      {it.quantity} {it.unit} · {it.calories} kcal
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeFromCart(i)}
                    style={styles.cartRemove}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${it.name}`}
                  >
                    <Ionicons name="close" size={18} color={T.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.logBtn, logging && styles.logBtnDisabled]}
              onPress={logCart}
              disabled={logging}
              activeOpacity={0.88}
            >
              {logging ? (
                <ActivityIndicator size={16} color={T.textOnPrimary} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color={T.textOnPrimary} />
                  <Text style={styles.logBtnText}>
                    Log {cart.length} item{cart.length === 1 ? '' : 's'} · {cartTotals.calories} kcal
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      )}

      {/* Re-portion a cart item. Renders above the cart panel. */}
      <PortionSheet
        visible={editIndex !== null}
        item={editIndex !== null ? cart[editIndex] : null}
        confirmLabel="Update"
        onCancel={() => setEditIndex(null)}
        onConfirm={(item) => {
          setCart((prev) => prev.map((it, i) => (i === editIndex ? item : it)));
          setEditIndex(null);
        }}
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

  dbLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 4 },
  dbLoadingText: { fontSize: 13, color: T.textMuted, fontWeight: '600' },
  dbEmptyText: { fontSize: 13, color: T.textMuted, paddingVertical: 10, paddingHorizontal: 4 },

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

  /* Cart bar */
  cartBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: T.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  cartBarBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0,54,58,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBarBadgeText: { fontSize: 13, fontWeight: '800', color: T.textOnPrimary },
  cartBarText: { flex: 1, fontSize: 14.5, fontWeight: '800', color: T.textOnPrimary },
  cartBarCta: { fontSize: 14, fontWeight: '800', color: T.textOnPrimary, opacity: 0.9 },

  /* Cart panel */
  cartScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: T.overlay, justifyContent: 'flex-end', zIndex: 20 },
  cartPanel: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
    maxHeight: '80%',
  },
  cartGrab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: T.surfaceOffset, marginBottom: 4 },
  cartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartTitle: { fontSize: 18, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.3 },
  cartLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: T.textMuted,
    marginTop: 2,
  },
  cartList: { marginTop: 4 },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.divider,
  },
  cartItemMain: { flex: 1, gap: 2 },
  cartItemName: { fontSize: 14.5, fontWeight: '700', color: T.textPrimary },
  cartItemMeta: { fontSize: 12, fontWeight: '600', color: T.textMuted },
  cartRemove: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 15,
    backgroundColor: T.primary,
    marginTop: 4,
  },
  logBtnDisabled: { opacity: 0.6 },
  logBtnText: { fontSize: 15, fontWeight: '800', color: T.textOnPrimary, letterSpacing: 0.2 },
});
