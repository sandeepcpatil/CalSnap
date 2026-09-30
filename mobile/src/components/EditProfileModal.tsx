import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, type Profile } from '../store/authStore';
import { ModalHeader } from './ModalHeader';
import { T, spacing, radius, HIT_TARGET } from '../theme';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

type Gender = 'male' | 'female' | 'other';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type BodyGoal = 'lose_weight' | 'maintain' | 'gain_muscle';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary',   label: 'Sedentary' },
  { value: 'light',       label: 'Light' },
  { value: 'moderate',    label: 'Moderate' },
  { value: 'active',      label: 'Active' },
  { value: 'very_active', label: 'Very active' },
];

const GOAL_OPTIONS: { value: BodyGoal; label: string; icon: IconName }[] = [
  { value: 'lose_weight',  label: 'Lose weight',  icon: 'trending-down-outline' },
  { value: 'maintain',     label: 'Maintain',     icon: 'swap-horizontal-outline' },
  { value: 'gain_muscle',  label: 'Gain muscle',  icon: 'trending-up-outline' },
];

interface Limit {
  min: number;
  max: number;
  integer: boolean;
  hint: string;
}

/** Plausible human ranges. Anything outside is a typo, not a value to store. */
const LIMITS = {
  age:      { min: 10,  max: 120,  integer: true,  hint: 'Enter an age between 10 and 120' },
  weight:   { min: 20,  max: 300,  integer: false, hint: 'Enter a weight between 20 and 300 kg' },
  height:   { min: 100, max: 250,  integer: false, hint: 'Enter a height between 100 and 250 cm' },
  calories: { min: 800, max: 6000, integer: true,  hint: 'Enter a goal between 800 and 6,000 kcal' },
  protein:  { min: 10,  max: 500,  integer: true,  hint: 'Enter a goal between 10 and 500 g' },
} satisfies Record<string, Limit>;

interface FormState {
  name: string;
  age: string;
  weightKg: string;
  heightCm: string;
  gender: Gender | null;
  activity: ActivityLevel | null;
  bodyGoal: BodyGoal | null;
  calGoal: string;
  protGoal: string;
}

const EMPTY_FORM: FormState = {
  name: '', age: '', weightKg: '', heightCm: '',
  gender: null, activity: null, bodyGoal: null,
  calGoal: '', protGoal: '',
};

function formFromProfile(p: Profile | null): FormState {
  if (!p) return EMPTY_FORM;
  return {
    name: p.name ?? '',
    age: p.age != null ? String(p.age) : '',
    weightKg: p.weight_kg != null ? String(p.weight_kg) : '',
    heightCm: p.height_cm != null ? String(p.height_cm) : '',
    gender: p.gender ?? null,
    activity: p.activity_level ?? null,
    bodyGoal: p.body_goal ?? null,
    calGoal: p.daily_calorie_goal != null ? String(p.daily_calorie_goal) : '',
    protGoal: p.daily_protein_goal != null ? String(p.daily_protein_goal) : '',
  };
}

/** The typed number when it is inside the limit, else null. */
function parseLimited(text: string, lim: Limit): number | null {
  if (!text.trim()) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < lim.min || n > lim.max) return null;
  if (lim.integer && !Number.isInteger(n)) return null;
  return lim.integer ? n : Math.round(n * 10) / 10;
}

/**
 * Inline error for a numeric field. An emptied field that used to have a value
 * is an error too: we never write null over something the user already set.
 */
function fieldError(text: string, lim: Limit, hadValue: boolean): string | null {
  if (!text.trim()) return hadValue ? lim.hint : null;
  return parseLimited(text, lim) == null ? lim.hint : null;
}

const sameForm = (a: FormState, b: FormState) =>
  (Object.keys(a) as (keyof FormState)[]).every((k) => a[k] === b[k]);

export function EditProfileModal({ visible, onDismiss }: Props) {
  const { profile, updateProfile } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [initial, setInitial] = useState<FormState>(EMPTY_FORM);

  // Snapshot the profile whenever the modal opens; "dirty" is measured
  // against this snapshot, not against the live store.
  useEffect(() => {
    if (visible) {
      const snapshot = formFromProfile(profile);
      setForm(snapshot);
      setInitial(snapshot);
    }
    // Re-snapshotting on every profile change would wipe in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const errors = {
    name: profile?.name && !form.name.trim() ? 'Enter a name' : null,
    age: fieldError(form.age, LIMITS.age, profile?.age != null),
    weightKg: fieldError(form.weightKg, LIMITS.weight, profile?.weight_kg != null),
    heightCm: fieldError(form.heightCm, LIMITS.height, profile?.height_cm != null),
    calGoal: fieldError(form.calGoal, LIMITS.calories, profile?.daily_calorie_goal != null),
    protGoal: fieldError(form.protGoal, LIMITS.protein, profile?.daily_protein_goal != null),
  };
  const valid = Object.values(errors).every((e) => e == null);
  const dirty = !sameForm(form, initial);
  const canSave = valid && dirty && !saving;

  const requestClose = () => {
    if (saving) return;
    if (!dirty) { onDismiss(); return; }
    Alert.alert('Discard changes?', 'Your edits have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onDismiss },
    ]);
  };

  const handleSave = async () => {
    if (!canSave) return;

    // Only changed fields travel, so an untouched field can never be nulled.
    const updates: Partial<Profile> = {};
    if (form.name !== initial.name) updates.name = form.name.trim() || null;
    if (form.age !== initial.age) updates.age = parseLimited(form.age, LIMITS.age);
    if (form.weightKg !== initial.weightKg) updates.weight_kg = parseLimited(form.weightKg, LIMITS.weight);
    if (form.heightCm !== initial.heightCm) updates.height_cm = parseLimited(form.heightCm, LIMITS.height);
    if (form.gender !== initial.gender) updates.gender = form.gender;
    if (form.activity !== initial.activity) updates.activity_level = form.activity;
    if (form.bodyGoal !== initial.bodyGoal) updates.body_goal = form.bodyGoal;
    if (form.calGoal !== initial.calGoal) updates.daily_calorie_goal = parseLimited(form.calGoal, LIMITS.calories);
    if (form.protGoal !== initial.protGoal) updates.daily_protein_goal = parseLimited(form.protGoal, LIMITS.protein);

    setSaving(true);
    try {
      await updateProfile(updates);
      // The store swallows write errors, so confirm the values actually landed.
      const after = useAuthStore.getState().profile;
      const applied =
        after != null &&
        (Object.keys(updates) as (keyof Profile)[]).every((k) => {
          const stored = after[k];
          const wanted = updates[k];
          if (typeof wanted === 'number') return Number(stored) === wanted;
          return (stored ?? null) === (wanted ?? null);
        });
      if (!applied) throw new Error('profile update was not applied');
      onDismiss();
    } catch (err) {
      console.warn('[profile] save failed', err);
      Alert.alert("Couldn't save", 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={requestClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.root}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <ModalHeader
              title="Edit profile"
              onClose={requestClose}
              actionLabel={saving ? 'Saving…' : 'Save'}
              onAction={handleSave}
              actionDisabled={!canSave}
            />
          </SafeAreaView>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>Basic info</Text>
            <View style={styles.card}>
              <Field
                label="Display name"
                value={form.name}
                onChange={(t) => set('name', t)}
                placeholder="Your name"
                autoCapitalize="words"
                error={errors.name}
              />
              <Field
                label="Age"
                value={form.age}
                onChange={(t) => set('age', t.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 25"
                keyboardType="number-pad"
                unit="years"
                error={errors.age}
                divider
              />
              <View style={[styles.fieldRow, styles.fieldBorder]}>
                <Field
                  label="Weight"
                  value={form.weightKg}
                  onChange={(t) => set('weightKg', t.replace(/[^0-9.]/g, ''))}
                  placeholder="e.g. 70"
                  keyboardType="decimal-pad"
                  unit="kg"
                  error={errors.weightKg}
                  half
                />
                <Field
                  label="Height"
                  value={form.heightCm}
                  onChange={(t) => set('heightCm', t.replace(/[^0-9.]/g, ''))}
                  placeholder="e.g. 175"
                  keyboardType="decimal-pad"
                  unit="cm"
                  error={errors.heightCm}
                  half
                  halfRight
                />
              </View>
            </View>

            <Text style={styles.sectionLabel}>Gender</Text>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((g) => (
                <Chip key={g.value} label={g.label} selected={form.gender === g.value} onPress={() => set('gender', g.value)} />
              ))}
            </View>

            <Text style={styles.sectionLabel}>Activity level</Text>
            <View style={styles.chipRow}>
              {ACTIVITY_OPTIONS.map((opt) => (
                <Chip key={opt.value} label={opt.label} selected={form.activity === opt.value} onPress={() => set('activity', opt.value)} />
              ))}
            </View>

            <Text style={styles.sectionLabel}>Body goal</Text>
            <View style={styles.goalRow}>
              {GOAL_OPTIONS.map((opt) => {
                const selected = form.bodyGoal === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.goalCard, selected && styles.goalCardActive]}
                    onPress={() => set('bodyGoal', opt.value)}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, checked: selected }}
                    accessibilityLabel={opt.label}
                  >
                    <Ionicons name={opt.icon} size={20} color={selected ? T.primary : T.textMuted} />
                    <Text style={[styles.goalText, selected && { color: T.primary }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Daily targets</Text>
            <View style={styles.card}>
              <View style={styles.fieldRow}>
                <Field
                  label="Calories"
                  value={form.calGoal}
                  onChange={(t) => set('calGoal', t.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 2000"
                  keyboardType="number-pad"
                  unit="kcal"
                  error={errors.calGoal}
                  half
                />
                <Field
                  label="Protein"
                  value={form.protGoal}
                  onChange={(t) => set('protGoal', t.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 150"
                  keyboardType="number-pad"
                  unit="g"
                  error={errors.protGoal}
                  half
                  halfRight
                />
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  autoCapitalize?: 'none' | 'words';
  unit?: string;
  error?: string | null;
  divider?: boolean;
  half?: boolean;
  halfRight?: boolean;
}

function Field({ label, value, onChange, placeholder, keyboardType = 'default', autoCapitalize = 'none', unit, error, divider, half, halfRight }: FieldProps) {
  return (
    <View style={[half ? styles.fieldHalf : styles.field, divider && styles.fieldBorder, halfRight && styles.fieldHalfRight]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={T.textMuted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          accessibilityLabel={unit ? `${label} in ${unit}` : label}
        />
        {unit ? <Text style={styles.inputUnit}>{unit}</Text> : null}
      </View>
      {error ? <Text style={styles.helperError}>{error}</Text> : null}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: T.bg },
  headerSafe: { backgroundColor: T.bg },

  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.sm },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: T.textMuted, marginTop: spacing.sm, marginBottom: 2 },

  card: {
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
  },
  field: { padding: spacing.lg, gap: 6 },
  fieldBorder: { borderTopWidth: 1, borderTopColor: T.divider },
  fieldRow: { flexDirection: 'row', padding: spacing.lg, gap: 0 },
  fieldHalf: { flex: 1, gap: 6 },
  fieldHalfRight: { borderLeftWidth: 1, borderLeftColor: T.divider, paddingLeft: spacing.lg, marginLeft: spacing.lg },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: T.textMuted },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  inputRowError: { borderBottomColor: T.error },
  input: {
    flex: 1,
    fontSize: 16,
    color: T.textPrimary,
    paddingVertical: 8,
    minHeight: HIT_TARGET - 4,
  },
  inputUnit: { fontSize: 13, fontWeight: '600', color: T.textSecondary },
  helperError: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: T.error },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: T.primaryTint, borderColor: T.primaryBorder },
  chipText: { fontSize: 14, color: T.textSecondary, fontWeight: '600' },
  chipTextActive: { color: T.primary },

  goalRow: { flexDirection: 'row', gap: spacing.sm },
  goalCard: {
    flex: 1, alignItems: 'center', gap: 6,
    paddingVertical: spacing.md,
    minHeight: HIT_TARGET + spacing.lg,
    backgroundColor: T.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.border,
  },
  goalCardActive: { backgroundColor: T.primaryTint, borderColor: T.primaryBorder },
  goalText: { fontSize: 12, fontWeight: '700', color: T.textMuted, textAlign: 'center' },
});
