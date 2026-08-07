import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, ScrollView, Pressable, TextInput } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { FoodItem } from '../services/api';
import { fetchRecentFoods } from '../services/recentFoods';
import { searchFoods, itemFromDbFood, sourceLabel, MIN_FOOD_QUERY, type FoodDbRow } from '../services/foodSearch';
import { useAuthStore } from '../store/authStore';
import { UNITS, rescaleItem, gramsFor, stepFor, COMMON_FOODS, itemFromFood } from '../utils/foodItems';
import { T } from '../theme';

interface Props {
  items: FoodItem[];
  onChange: (items: FoodItem[]) => void;
  /** Section heading. The scan result says "detected"; a meal builder doesn't. */
  heading?: string;
  /** Copy on the add button, for the same reason. */
  addLabel?: string;
}

/**
 * Per-item editor for a scanned meal. The AI proposes the items; the user
 * confirms. Editing one item never affects the others, so a wrong estimate for
 * the rice can't corrupt a correct one for the dal.
 */
export function ScanItemsEditor({ items, onChange, heading = 'ITEMS DETECTED', addLabel = 'Add anything we missed' }: Props) {
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const editing = editIndex !== null ? items[editIndex] : null;

  const updateItem = (index: number, quantity: number, unit: string) => {
    onChange(items.map((it, i) => (i === index ? rescaleItem(it, quantity, unit) : it)));
  };

  const removeItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(items.filter((_, i) => i !== index));
    setEditIndex(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={styles.head}>{heading}</Text>
        <Text style={styles.headCount}>{items.length}</Text>
      </View>

      {items.map((item, i) => (
        <TouchableOpacity
          key={`${item.name}-${i}`}
          style={styles.row}
          onPress={() => setEditIndex(i)}
          activeOpacity={0.75}
        >
          <View style={styles.rowMain}>
            <View style={styles.rowNameLine}>
              <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
              {item.source === 'database' && (
                <Ionicons name="checkmark-circle" size={13} color={T.success} />
              )}
            </View>
            <Text style={styles.rowMeta}>
              {formatQty(item.quantity)} {item.unit}{item.unit !== 'g' ? ` · ${item.grams}g` : ''}
              {'  ·  '}P {item.protein_g}g · C {item.carbs_g}g · F {item.fat_g}g
            </Text>
          </View>
          <Text style={styles.rowKcal}>{item.calories}</Text>
          <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
        </TouchableOpacity>
      ))}

      {items.length === 0 && (
        <Text style={styles.empty}>No items — add what you ate below.</Text>
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => setAddOpen(true)} activeOpacity={0.8}>
        <Ionicons name="add-circle-outline" size={18} color={T.primary} />
        <Text style={styles.addText}>{addLabel}</Text>
      </TouchableOpacity>

      {/* ── Edit sheet ─────────────────────────────────────────────────────── */}
      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => setEditIndex(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditIndex(null)} />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.grabber} />
            {editing && editIndex !== null && (
              <>
                {/* Editable name — the AI does misidentify foods (paneer vs
                    tofu), and deleting + re-adding loses the estimate. */}
                <Text style={styles.fieldLabel}>ITEM</Text>
                <TextInput
                  style={styles.nameInput}
                  value={editing.name}
                  onChangeText={(name) =>
                    onChange(items.map((it, i) => (i === editIndex ? { ...it, name } : it)))
                  }
                  placeholder="Food name"
                  placeholderTextColor={T.textMuted}
                  selectTextOnFocus
                />
                <Text style={styles.sheetSub}>
                  {editing.calories} kcal · {editing.grams}g
                </Text>

                {/* With "g" the quantity IS the weight, so multiplier chips
                    (0.5–3) would mean "1 gram of dal". Type the grams instead. */}
                {editing.unit === 'g' ? (
                  <>
                    <Text style={styles.fieldLabel}>WEIGHT (GRAMS)</Text>
                    <TextInput
                      style={styles.nameInput}
                      value={String(editing.quantity)}
                      onChangeText={(v) => {
                        const grams = Math.max(0, parseInt(v.replace(/[^0-9]/g, ''), 10) || 0);
                        updateItem(editIndex, grams, 'g');
                      }}
                      keyboardType="number-pad"
                      selectTextOnFocus
                      placeholder="180"
                      placeholderTextColor={T.textMuted}
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>QUANTITY</Text>
                    {/* A stepper, not fixed chips — you can't know in advance
                        whether someone ate 2 boiled eggs or 5. The number is
                        editable too, so large counts don't need many taps. */}
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => {
                          const step = stepFor(editing.unit);
                          const next = Math.max(step, Math.round((editing.quantity - step) * 100) / 100);
                          updateItem(editIndex, next, editing.unit);
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel="Decrease quantity"
                      >
                        <Ionicons name="remove" size={22} color={T.primary} />
                      </TouchableOpacity>

                      <TextInput
                        style={styles.stepValue}
                        value={formatQty(editing.quantity)}
                        onChangeText={(v) => {
                          // Allow a decimal point for half servings.
                          const n = parseFloat(v.replace(/[^0-9.]/g, ''));
                          updateItem(editIndex, Number.isFinite(n) && n > 0 ? n : 0, editing.unit);
                        }}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                        textAlign="center"
                      />

                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => {
                          const step = stepFor(editing.unit);
                          updateItem(editIndex, Math.round((editing.quantity + step) * 100) / 100, editing.unit);
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel="Increase quantity"
                      >
                        <Ionicons name="add" size={22} color={T.primary} />
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                <Text style={styles.fieldLabel}>UNIT</Text>
                <View style={styles.chipRow}>
                  {UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.chip, editing.unit === u && styles.chipActive]}
                      onPress={() =>
                        // Switching to grams: carry the current weight across,
                        // so "1 katori" becomes "180 g", not "1 g".
                        updateItem(editIndex, u === 'g' ? editing.grams : editing.quantity, u)
                      }
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, editing.unit === u && styles.chipTextActive]}>
                        {u === 'g' ? 'grams' : u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.sheetActions}>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => removeItem(editIndex)} activeOpacity={0.8}>
                    <Ionicons name="trash-outline" size={18} color={T.error} />
                    <Text style={styles.deleteText}>Remove</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.doneBtn} onPress={() => setEditIndex(null)} activeOpacity={0.85}>
                    <Text style={styles.doneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Add item sheet ─────────────────────────────────────────────────── */}
      <AddItemSheet
        visible={addOpen}
        onAdd={(item) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange([...items, item]);
        }}
        onDone={(addedCount) => {
          setAddOpen(false);
          // Picking a food and setting its amount is one intent, so a single
          // addition goes straight to the portion editor. Several additions
          // don't — there'd be no way to say which one you meant, and the rows
          // are one tap away in the list behind.
          // `items` already includes the addition by the time Done is tapped,
          // so the new row is the last index — not `items.length`.
          if (addedCount === 1) setEditIndex(items.length - 1);
        }}
      />
    </View>
  );
}

// ── Add item ─────────────────────────────────────────────────────────────────

interface AddItemSheetProps {
  visible: boolean;
  onAdd: (item: FoodItem) => void;
  /** Closes the sheet, told how many foods were added this time round. */
  onDone: (addedCount: number) => void;
}

/**
 * Stays open across additions. A thali is four or five things, and closing
 * after every pick meant re-opening the sheet and re-typing the search for each
 * one — so the common case was the slowest.
 */
function AddItemSheet({ visible, onAdd, onDone }: AddItemSheetProps) {
  const { session } = useAuthStore();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<FoodItem[] | null>(null);
  const [dbResults, setDbResults] = useState<FoodDbRow[]>([]);
  const [dbSearching, setDbSearching] = useState(false);
  /** Name → times added in this session, for the row's "✓ ×2" badge. */
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

  const handlePick = (name: string, item: FoodItem) => {
    setAdded((prev) => ({ ...prev, [name]: (prev[name] ?? 0) + 1 }));
    onAdd(item);
  };

  // Load the user's own history the first time the sheet opens — people repeat
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
  // already offered by the (curated, portion-aware) COMMON list above it.
  const commonNames = new Set(commonMatches.map((f) => f.name.toLowerCase()));
  const dbMatches = dbResults.filter((r) => !commonNames.has(r.name.toLowerCase()));
  const nothingFound =
    recentMatches.length === 0 && commonMatches.length === 0 && dbMatches.length === 0 && !dbSearching;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onDone(addedTotal)}>
      <Pressable style={styles.backdrop} onPress={() => onDone(addedTotal)} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { maxHeight: '85%' }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle}>Add items</Text>
            {addedTotal > 0 && (
              <Text style={styles.sheetCount}>
                {addedTotal} added
              </Text>
            )}
          </View>
          <TextInput
            style={styles.search}
            placeholder="Search your foods…"
            placeholderTextColor={T.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
            {/* ── Your history — same portion you logged last time ── */}
            {recent === null && (
              <View style={styles.loadingRow}>
                <ActivityIndicator animating size={14} color={T.primary} />
                <Text style={styles.rowMeta}>Loading your foods…</Text>
              </View>
            )}
            {recentMatches.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>YOUR RECENT FOODS</Text>
                {recentMatches.map((f, i) => (
                  <TouchableOpacity
                    key={`recent-${f.name}-${i}`}
                    style={styles.addRow}
                    onPress={() => handlePick(`recent-${f.name}`, f)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="time-outline" size={16} color={T.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{f.name}</Text>
                      <Text style={styles.rowMeta}>
                        {f.quantity} {f.unit} · {f.calories} kcal
                      </Text>
                    </View>
                    <AddedBadge count={added[`recent-${f.name}`] ?? 0} />
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* ── Bundled catalogue — instant, works offline ── */}
            {commonMatches.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>COMMON FOODS</Text>
                {commonMatches.map((f) => (
                  <TouchableOpacity
                    key={`common-${f.name}`}
                    style={styles.addRow}
                    onPress={() => handlePick(`common-${f.name}`, itemFromFood(f, 1, f.unit))}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="nutrition-outline" size={16} color={T.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{f.name}</Text>
                      <Text style={styles.rowMeta}>
                        1 {f.unit} · {Math.round((f.kcal * gramsFor(1, f.unit)) / 100)} kcal
                      </Text>
                    </View>
                    <AddedBadge count={added[`common-${f.name}`] ?? 0} />
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* ── Food database — IFCT + USDA, searched as you type ── */}
            {dbMatches.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>FOOD DATABASE</Text>
                {dbMatches.map((r) => (
                  <TouchableOpacity
                    key={`db-${r.id}`}
                    style={styles.addRow}
                    onPress={() => handlePick(`db-${r.id}`, itemFromDbFood(r))}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="server-outline" size={16} color={T.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{r.name}</Text>
                      <Text style={styles.rowMeta}>
                        {Math.round(r.energy_kcal)} kcal / 100 g · {sourceLabel(r.source)}
                      </Text>
                    </View>
                    <AddedBadge count={added[`db-${r.id}`] ?? 0} />
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Searching the DB, and nothing local to show yet. */}
            {dbSearching && dbMatches.length === 0 && q.length >= MIN_FOOD_QUERY && (
              <View style={styles.loadingRow}>
                <ActivityIndicator animating size={14} color={T.primary} />
                <Text style={styles.rowMeta}>Searching foods…</Text>
              </View>
            )}

            {nothingFound && recent !== null && (
              <Text style={styles.empty}>
                No match for “{query.trim()}”. Try a simpler word like “dal” or “rice”.
              </Text>
            )}
          </ScrollView>
          {addedTotal > 0 ? (
            <TouchableOpacity
              style={styles.doneAddBtn}
              onPress={() => onDone(addedTotal)}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={17} color={T.textOnPrimary} />
              <Text style={styles.doneAddText}>
                Done · {addedTotal} item{addedTotal === 1 ? '' : 's'} added
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => onDone(0)} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </View>
    </Modal>
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

const formatQty = (q: number): string => (Number.isInteger(q) ? `${q}` : `${q}`);

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  head: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: T.textMuted },
  headCount: { fontSize: 12, fontWeight: '800', color: T.primary },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: T.surface2, borderRadius: 14,
    borderWidth: 1, borderColor: T.border,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  rowMain: { flex: 1, gap: 3 },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowName: { fontSize: 15, fontWeight: '700', color: T.textPrimary },
  rowMeta: { fontSize: 12, color: T.textSecondary },
  rowKcal: { fontSize: 16, fontWeight: '800', color: T.textPrimary, fontVariant: ['tabular-nums'] },

  empty: { fontSize: 13, color: T.textMuted, textAlign: 'center', paddingVertical: 16 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: T.border, borderStyle: 'dashed',
  },
  addText: { fontSize: 14, fontWeight: '700', color: T.primary },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, gap: 10,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: T.border, marginBottom: 8 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: T.textPrimary },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sheetCount: { fontSize: 13, fontWeight: '700', color: T.primary },
  addedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 7,
    height: 24,
    borderRadius: 12,
    backgroundColor: T.primary,
  },
  addedBadgeCount: { fontSize: 11, fontWeight: '800', color: T.textOnPrimary },
  sheetSub: { fontSize: 13, color: T.textSecondary, marginTop: -4 },

  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: T.textMuted, marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: T.surface2, borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepValue: {
    flex: 1, height: 48, borderRadius: 12,
    backgroundColor: T.surface2, borderWidth: 1, borderColor: T.border,
    color: T.textPrimary, fontSize: 20, fontWeight: '800',
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    backgroundColor: T.surface2, borderWidth: 1, borderColor: T.border,
  },
  chipActive: { backgroundColor: T.primaryTint, borderColor: T.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: T.textSecondary },
  chipTextActive: { color: T.primary },

  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: T.border,
  },
  deleteText: { fontSize: 14, fontWeight: '700', color: T.error },
  doneBtn: {
    flex: 2, height: 48, borderRadius: 14, backgroundColor: T.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  doneText: { fontSize: 15, fontWeight: '800', color: T.textOnPrimary },

  search: {
    backgroundColor: T.surface2, borderRadius: 12,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: T.textPrimary, fontSize: 15,
  },
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.divider,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1,
    color: T.textMuted, marginTop: 14, marginBottom: 4,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
  nameInput: {
    backgroundColor: T.surface2, borderRadius: 12,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: T.textPrimary, fontSize: 17, fontWeight: '700',
  },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { fontSize: 15, fontWeight: '700', color: T.textMuted },
  doneAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: T.primary,
    marginTop: 10,
  },
  doneAddText: { fontSize: 15, fontWeight: '800', color: T.textOnPrimary, letterSpacing: 0.2 },
});
