import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, ScrollView, Pressable, TextInput } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { FoodItem } from '../services/api';
import { fetchRecentFoods } from '../services/recentFoods';
import { searchFoods, itemFromDbFood, sourceLabel, MIN_FOOD_QUERY, type FoodDbRow } from '../services/foodSearch';
import { useAuthStore } from '../store/authStore';
import { gramsFor, COMMON_FOODS, itemFromFood } from '../utils/foodItems';
import { T, type, spacing, radius, HIT_TARGET } from '../theme';

interface Props {
  visible: boolean;
  onAdd: (item: FoodItem) => void;
  /** Closes the sheet, told how many foods were added this time round. */
  onDone: (addedCount: number) => void;
}

/**
 * Search-and-pick sheet for adding foods to a meal.
 *
 * Stays open across additions. A thali is four or five things, and closing
 * after every pick meant re-opening the sheet and re-typing the search for each
 * one, so the common case was the slowest.
 */
export function AddItemSheet({ visible, onAdd, onDone }: Props) {
  const { session } = useAuthStore();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<FoodItem[] | null>(null);
  const [dbResults, setDbResults] = useState<FoodDbRow[]>([]);
  const [dbSearching, setDbSearching] = useState(false);
  /** Name to times added in this session, for the row's tick badge. */
  const [added, setAdded] = useState<Record<string, number>>({});

  // A fresh open starts a fresh basket; the counts describe this visit only.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setAdded({});
      setQuery('');
      setDbResults([]);
    }
  }

  const addedTotal = Object.values(added).reduce((sum, n) => sum + n, 0);

  const handlePick = (key: string, item: FoodItem) => {
    setAdded((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
    onAdd(item);
  };

  // Load the user's own history the first time the sheet opens. People repeat
  // meals, so this out-performs any generic food list.
  useEffect(() => {
    if (!visible || recent !== null || !session?.user.id) return;
    let active = true;
    fetchRecentFoods(session.user.id)
      .then((r) => { if (active) setRecent(r); })
      .catch(() => { if (active) setRecent([]); });
    return () => { active = false; };
  }, [visible, recent, session?.user.id]);

  const q = query.trim().toLowerCase();

  // Search the shared food database (IFCT + USDA) as the user types. Debounced
  // so a five-letter word is one query, not five, and guarded against races so
  // a slow early response can't overwrite a newer one.
  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_FOOD_QUERY) { setDbResults([]); setDbSearching(false); return; }
    let active = true;
    setDbSearching(true);
    const handle = setTimeout(() => {
      searchFoods(term)
        .then((rows) => { if (active) setDbResults(rows); })
        .catch(() => { if (active) setDbResults([]); })
        .finally(() => { if (active) setDbSearching(false); });
    }, 280);
    return () => { active = false; clearTimeout(handle); };
  }, [query]);

  const recentMatches = (recent ?? []).filter((f) => f.name.toLowerCase().includes(q));
  const commonMatches = COMMON_FOODS.filter((f) => f.name.toLowerCase().includes(q));
  // The DB already covers most common foods, so hide any DB row whose name is
  // already offered by the (curated, portion-aware) common list above it.
  const commonNames = new Set(commonMatches.map((f) => f.name.toLowerCase()));
  const dbMatches = dbResults.filter((r) => !commonNames.has(r.name.toLowerCase()));
  const nothingFound =
    recentMatches.length === 0 && commonMatches.length === 0 && dbMatches.length === 0 && !dbSearching;

  const close = () => onDone(addedTotal);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Add items</Text>
            {addedTotal > 0 && <Text style={styles.count}>{addedTotal} added</Text>}
          </View>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={17} color={T.textMuted} />
            <TextInput
              style={styles.search}
              placeholder="Search your foods"
              placeholderTextColor={T.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search foods"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={17} color={T.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {recent === null && (
              <View style={styles.loadingRow}>
                <ActivityIndicator animating size={14} color={T.primary} />
                <Text style={styles.rowMeta}>Loading your foods</Text>
              </View>
            )}
            {recentMatches.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Your recent foods</Text>
                {recentMatches.map((f, i) => (
                  <AddRow
                    key={`recent-${f.name}-${i}`}
                    icon="time-outline"
                    name={f.name}
                    meta={`${f.quantity} ${f.unit} · ${f.calories} kcal`}
                    count={added[`recent-${f.name}`] ?? 0}
                    onPress={() => handlePick(`recent-${f.name}`, f)}
                  />
                ))}
              </>
            )}

            {commonMatches.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Common foods</Text>
                {commonMatches.map((f) => (
                  <AddRow
                    key={`common-${f.name}`}
                    icon="nutrition-outline"
                    name={f.name}
                    meta={`1 ${f.unit} · ${Math.round((f.kcal * gramsFor(1, f.unit)) / 100)} kcal`}
                    count={added[`common-${f.name}`] ?? 0}
                    onPress={() => handlePick(`common-${f.name}`, itemFromFood(f, 1, f.unit))}
                  />
                ))}
              </>
            )}

            {dbMatches.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Food database</Text>
                {dbMatches.map((r) => (
                  <AddRow
                    key={`db-${r.id}`}
                    icon="server-outline"
                    name={r.name}
                    meta={`${Math.round(r.energy_kcal)} kcal per 100 g · ${sourceLabel(r.source)}`}
                    count={added[`db-${r.id}`] ?? 0}
                    onPress={() => handlePick(`db-${r.id}`, itemFromDbFood(r))}
                  />
                ))}
              </>
            )}

            {dbSearching && dbMatches.length === 0 && q.length >= MIN_FOOD_QUERY && (
              <View style={styles.loadingRow}>
                <ActivityIndicator animating size={14} color={T.primary} />
                <Text style={styles.rowMeta}>Searching foods</Text>
              </View>
            )}

            {nothingFound && recent !== null && (
              <Text style={styles.empty}>
                No match for “{query.trim()}”. Try a simpler word like “dal” or “rice”.
              </Text>
            )}
          </ScrollView>
          {addedTotal > 0 ? (
            <TouchableOpacity style={styles.doneBtn} onPress={close} activeOpacity={0.85} accessibilityRole="button">
              <Ionicons name="checkmark" size={17} color={T.textOnPrimary} />
              <Text style={styles.doneText}>
                Done · {addedTotal} item{addedTotal === 1 ? '' : 's'} added
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => onDone(0)} activeOpacity={0.7} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function AddRow({
  icon, name, meta, count, onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  name: string;
  meta: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.addRow}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Add ${name} again, added ${count}` : `Add ${name}`}
    >
      <Ionicons name={icon} size={16} color={T.textMuted} />
      <View style={styles.addRowText}>
        <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{meta}</Text>
      </View>
      <AddedBadge count={count} />
    </TouchableOpacity>
  );
}

/** Trailing control on an add row: a plain "+", or a tick with a repeat count. */
function AddedBadge({ count }: { count: number }) {
  if (count === 0) return <Ionicons name="add" size={20} color={T.primary} />;
  return (
    <View style={styles.addedBadge}>
      <Ionicons name="checkmark" size={13} color={T.textOnPrimary} />
      {count > 1 && <Text style={styles.addedBadgeCount}>×{count}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: T.overlay },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm,
    gap: spacing.sm + 2,
    maxHeight: '85%',
  },
  grabber: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: T.grabber, marginBottom: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { ...type.title, color: T.textPrimary },
  count: { ...type.bodySm, fontWeight: '700', color: T.primary },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.lg - 2,
    height: HIT_TARGET + 2,
    borderRadius: radius.md,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  search: { flex: 1, ...type.body, color: T.textPrimary, padding: 0 },
  list: { maxHeight: 400 },

  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2,
    minHeight: HIT_TARGET + 8,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: T.divider,
  },
  addRowText: { flex: 1, gap: 2 },
  rowName: { ...type.body, fontWeight: '700', color: T.textPrimary },
  rowMeta: { ...type.bodySm, color: T.textSecondary },
  sectionLabel: { ...type.label, color: T.textMuted, marginTop: spacing.lg - 2, marginBottom: spacing.xs },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg - 2 },
  empty: { ...type.bodySm, color: T.textMuted, textAlign: 'center', paddingVertical: spacing.lg },

  addedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 7,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: T.primary,
  },
  addedBadgeCount: { fontSize: 13, fontWeight: '800', color: T.textOnPrimary },

  cancelBtn: { alignItems: 'center', justifyContent: 'center', minHeight: HIT_TARGET, paddingVertical: spacing.md },
  cancelText: { ...type.body, fontWeight: '700', color: T.textMuted },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: T.primary,
    marginTop: spacing.sm + 2,
  },
  doneText: { ...type.body, fontWeight: '800', color: T.textOnPrimary },
});
