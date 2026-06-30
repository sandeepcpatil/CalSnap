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
import { useAuthStore } from '../store/authStore';

const C = {
  bg:           '#101415',
  glass:        'rgba(15,23,42,0.80)',
  glassBorder:  'rgba(255,255,255,0.08)',
  primary:      '#85d3da',
  secondary:    '#bdf4ff',
  tertiary:     '#c0c1ff',
  onSurface:    '#e0e3e5',
  onSurfaceVar: '#bec8c9',
  outline:      '#889393',
  outlineVar:   '#3f4949',
  error:        '#ffb4ab',
  inputBg:      'rgba(255,255,255,0.05)',
};

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

type Gender = 'male' | 'female' | 'other';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type BodyGoal = 'lose_weight' | 'maintain' | 'gain_muscle';

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary',   label: 'Sedentary' },
  { value: 'light',       label: 'Light' },
  { value: 'moderate',    label: 'Moderate' },
  { value: 'active',      label: 'Active' },
  { value: 'very_active', label: 'Very Active' },
];

const GOAL_OPTIONS: { value: BodyGoal; label: string; icon: string }[] = [
  { value: 'lose_weight',  label: 'Lose Weight',  icon: 'trending-down-outline' },
  { value: 'maintain',     label: 'Maintain',     icon: 'swap-horizontal-outline' },
  { value: 'gain_muscle',  label: 'Gain Muscle',  icon: 'trending-up-outline' },
];

export function EditProfileModal({ visible, onDismiss }: Props) {
  const { profile, updateProfile } = useAuthStore();
  const [saving, setSaving] = useState(false);

  const [name,       setName]       = useState('');
  const [age,        setAge]        = useState('');
  const [weightKg,   setWeightKg]   = useState('');
  const [heightCm,   setHeightCm]   = useState('');
  const [gender,     setGender]     = useState<Gender | null>(null);
  const [activity,   setActivity]   = useState<ActivityLevel | null>(null);
  const [bodyGoal,   setBodyGoal]   = useState<BodyGoal | null>(null);
  const [calGoal,    setCalGoal]    = useState('');
  const [protGoal,   setProtGoal]   = useState('');

  // Populate from current profile whenever modal opens
  useEffect(() => {
    if (visible && profile) {
      setName(profile.name ?? '');
      setAge(profile.age != null ? String(profile.age) : '');
      setWeightKg(profile.weight_kg != null ? String(profile.weight_kg) : '');
      setHeightCm(profile.height_cm != null ? String(profile.height_cm) : '');
      setGender(profile.gender ?? null);
      setActivity(profile.activity_level ?? null);
      setBodyGoal(profile.body_goal ?? null);
      setCalGoal(profile.daily_calorie_goal != null ? String(profile.daily_calorie_goal) : '');
      setProtGoal(profile.daily_protein_goal != null ? String(profile.daily_protein_goal) : '');
    }
  }, [visible, profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        name:                name.trim() || null,
        age:                 age ? parseInt(age, 10) : null,
        weight_kg:           weightKg ? parseFloat(weightKg) : null,
        height_cm:           heightCm ? parseFloat(heightCm) : null,
        gender:              gender,
        activity_level:      activity,
        body_goal:           bodyGoal,
        daily_calorie_goal:  calGoal  ? parseInt(calGoal, 10)  : null,
        daily_protein_goal:  protGoal ? parseInt(protGoal, 10) : null,
      });
      onDismiss();
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onDismiss}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.root}>

          {/* Header */}
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onDismiss} style={styles.backBtn} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={22} color={C.primary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={handleSave}
                style={styles.saveBtn}
                activeOpacity={0.8}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── Basic Info ── */}
            <Text style={styles.sectionLabel}>BASIC INFO</Text>
            <View style={styles.card}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Display Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={C.outline}
                  autoCapitalize="words"
                />
              </View>

              <View style={[styles.field, styles.fieldBorder]}>
                <Text style={styles.fieldLabel}>Age</Text>
                <TextInput
                  style={styles.input}
                  value={age}
                  onChangeText={setAge}
                  placeholder="e.g. 25"
                  placeholderTextColor={C.outline}
                  keyboardType="number-pad"
                />
              </View>

              <View style={[styles.fieldRow, styles.fieldBorder]}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.input}
                    value={weightKg}
                    onChangeText={setWeightKg}
                    placeholder="e.g. 70"
                    placeholderTextColor={C.outline}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.fieldHalf, { borderLeftWidth: 1, borderLeftColor: C.glassBorder, paddingLeft: 16 }]}>
                  <Text style={styles.fieldLabel}>Height (cm)</Text>
                  <TextInput
                    style={styles.input}
                    value={heightCm}
                    onChangeText={setHeightCm}
                    placeholder="e.g. 175"
                    placeholderTextColor={C.outline}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>

            {/* ── Gender ── */}
            <Text style={styles.sectionLabel}>GENDER</Text>
            <View style={styles.chipRow}>
              {(['male', 'female', 'other'] as Gender[]).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, gender === g && styles.chipActive]}
                  onPress={() => setGender(g)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Activity Level ── */}
            <Text style={styles.sectionLabel}>ACTIVITY LEVEL</Text>
            <View style={styles.chipRow}>
              {ACTIVITY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, activity === opt.value && styles.chipActive]}
                  onPress={() => setActivity(opt.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, activity === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Goal ── */}
            <Text style={styles.sectionLabel}>BODY GOAL</Text>
            <View style={styles.goalRow}>
              {GOAL_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.goalCard, bodyGoal === opt.value && styles.goalCardActive]}
                  onPress={() => setBodyGoal(opt.value)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={20}
                    color={bodyGoal === opt.value ? C.primary : C.outline}
                  />
                  <Text style={[styles.goalText, bodyGoal === opt.value && { color: C.primary }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Nutrition Targets ── */}
            <Text style={styles.sectionLabel}>DAILY TARGETS</Text>
            <View style={styles.card}>
              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Calories (kcal)</Text>
                  <TextInput
                    style={styles.input}
                    value={calGoal}
                    onChangeText={setCalGoal}
                    placeholder="e.g. 2000"
                    placeholderTextColor={C.outline}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[styles.fieldHalf, { borderLeftWidth: 1, borderLeftColor: C.glassBorder, paddingLeft: 16 }]}>
                  <Text style={styles.fieldLabel}>Protein (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={protGoal}
                    onChangeText={setProtGoal}
                    placeholder="e.g. 150"
                    placeholderTextColor={C.outline}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  headerSafe: { backgroundColor: 'rgba(16,20,21,0.95)', borderBottomWidth: 1, borderBottomColor: C.glassBorder },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(133,211,218,0.10)' },
  headerTitle:{ fontSize: 17, fontWeight: '700', color: C.onSurface, letterSpacing: 0.3 },
  saveBtn:    { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.primary, borderRadius: 20 },
  saveBtnText:{ fontSize: 14, fontWeight: '700', color: '#00363a' },

  scroll:   { flex: 1 },
  content:  { paddingHorizontal: 20, paddingTop: 20, gap: 10 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.outline,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginTop: 6, marginBottom: 2,
  },

  card: {
    backgroundColor: C.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
    overflow: 'hidden',
  },
  field: { padding: 16, gap: 6 },
  fieldBorder: { borderTopWidth: 1, borderTopColor: C.glassBorder },
  fieldRow: { flexDirection: 'row', padding: 16, gap: 0 },
  fieldHalf: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.outline, letterSpacing: 0.8, textTransform: 'uppercase' },
  input: {
    fontSize: 16,
    color: C.onSurface,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.outlineVar,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  chipActive: { backgroundColor: 'rgba(133,211,218,0.15)', borderColor: C.primary },
  chipText: { fontSize: 14, color: C.outline, fontWeight: '600' },
  chipTextActive: { color: C.primary },

  goalRow: { flexDirection: 'row', gap: 10 },
  goalCard: {
    flex: 1, alignItems: 'center', gap: 6,
    paddingVertical: 14,
    backgroundColor: C.glass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  goalCardActive: { backgroundColor: 'rgba(133,211,218,0.10)', borderColor: C.primary },
  goalText: { fontSize: 11, fontWeight: '700', color: C.outline, textAlign: 'center' },
});
