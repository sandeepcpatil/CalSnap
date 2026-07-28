import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, ScrollView, Pressable, TextInput } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { FoodItem } from '../services/api';
import { fetchRecentFoods } from '../services/recentFoods';
import { useAuthStore } from '../store/authStore';
import { UNITS, rescaleItem, gramsFor, COMMON_FOODS, itemFromFood } from '../utils/foodItems';
import { T } from '../theme';

interface Props {
  items: FoodItem[];
  onChange: (items: FoodItem[]) => void;
}

const QTY_STEPS = [0.5, 1, 1.5, 2, 3];

/**
 * Per-item editor for a scanned meal. The AI proposes the items; the user
 * confirms. Editing one item never affects the others, so a wrong estimate for
 * the rice can't corrupt a correct one for the dal.
 */
export function ScanItemsEditor({ items, onChange }: Props) {
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
        <Text style={styles.head}>ITEMS DETECTED</Text>
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
        <Text style={styles.addText}>Add anything we missed</Text>
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

                <Text style={styles.fieldLabel}>QUANTITY</Text>
                <View style={styles.chipRow}>
                  {QTY_STEPS.map((q) => (
                    <TouchableOpacity
                      key={q}
                      style={[styles.chip, editing.quantity === q && styles.chipActive]}
                      onPress={() => updateItem(editIndex, q, editing.unit)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, editing.quantity === q && styles.chipTextActive]}>
                        {formatQty(q)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>UNIT</Text>
                <View style={styles.chipRow}>
                  {UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.chip, editing.unit === u && styles.chipActive]}
                      onPress={() => updateItem(editIndex, editing.quantity, u)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, editing.unit === u && styles.chipTextActive]}>{u}</Text>
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
        onClose={() => setAddOpen(false)}
        onAdd={(item) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange([...items, item]);
          setAddOpen(false);
        }}
      />
    </View>
  );
}

// ── Add item ─────────────────────────────────────────────────────────────────

function AddItemSheet({
  visible, onClose, onAdd,
}: { visible: boolean; onClose: () => void; onAdd: (item: FoodItem) => void }) {
  const { session } = useAuthStore();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<FoodItem[] | null>(null);

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
  const recentMatches = (recent ?? []).filter((f) => f.name.toLowerCase().includes(q));
  const commonMatches = COMMON_FOODS.filter((f) => f.name.toLowerCase().includes(q));
  const nothingFound = recentMatches.length === 0 && commonMatches.length === 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { maxHeight: '85%' }]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Add item</Text>
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
                    onPress={() => onAdd(f)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="time-outline" size={16} color={T.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{f.name}</Text>
                      <Text style={styles.rowMeta}>
                        {f.quantity} {f.unit} · {f.calories} kcal
                      </Text>
                    </View>
                    <Ionicons name="add" size={20} color={T.primary} />
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
                    onPress={() => onAdd(itemFromFood(f, 1, f.unit))}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="nutrition-outline" size={16} color={T.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{f.name}</Text>
                      <Text style={styles.rowMeta}>
                        1 {f.unit} · {Math.round((f.kcal * gramsFor(1, f.unit)) / 100)} kcal
                      </Text>
                    </View>
                    <Ionicons name="add" size={20} color={T.primary} />
                  </TouchableOpacity>
                ))}
              </>
            )}

            {nothingFound && recent !== null && (
              <Text style={styles.empty}>
                No match for “{query.trim()}”. Try a simpler word like “dal” or “rice”.
              </Text>
            )}
          </ScrollView>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
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
  sheetSub: { fontSize: 13, color: T.textSecondary, marginTop: -4 },

  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: T.textMuted, marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
});
