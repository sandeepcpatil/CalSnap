import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { ScanStackParamList } from '../../navigation/ScanNavigator';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { getMealTypeFromTime } from '../../utils/nutrition';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  navigation: NativeStackNavigationProp<ScanStackParamList, 'ScanResult'>;
  route: RouteProp<ScanStackParamList, 'ScanResult'>;
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

// maxValues used to normalise the bar fill width to a realistic upper bound
const MACRO_MAX: Record<string, number> = {
  Protein: 80,
  Carbs: 120,
  Fat: 60,
  Fiber: 20,
};

function NutrientCard({ label, value, color, barColor }: { label: string; value: number; color: string; barColor?: string }) {
  const { theme } = useTheme();
  const max = MACRO_MAX[label] ?? 100;
  const fillPct = Math.min(value / max, 1);
  return (
    <View style={[macroStyles.card, { borderColor: theme.borderColor, backgroundColor: theme.surface }]}>
      <View style={macroStyles.cardTop}>
        <Text style={[macroStyles.cardLabel, { color: theme.textSecondary }]}>{label}</Text>
        <View style={[macroStyles.dot, { backgroundColor: barColor ?? color }]} />
      </View>
      <View style={macroStyles.valueRow}>
        <Text style={[macroStyles.cardValue, { color }]}>{Math.round(value)}</Text>
        <Text style={[macroStyles.cardUnit, { color: theme.textSecondary }]}>g</Text>
      </View>
      <View style={[macroStyles.bar, { backgroundColor: theme.surface2 }]}>
        <View style={[macroStyles.barFill, { backgroundColor: barColor ?? color, width: `${Math.round(fillPct * 100)}%` }]} />
      </View>
    </View>
  );
}

const macroStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    justifyContent: 'space-between',
    minHeight: 110,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { fontSize: 12, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  cardValue: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  cardUnit: { fontSize: 13, fontWeight: '500' },
  bar: { height: 5, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
});

export function ScanResultScreen({ navigation, route }: Props) {
  const { imageUri, imageStorageUrl, result } = route.params;
  const { session, fetchProfile } = useAuthStore();
  const { addLog } = useFoodLogStore();
  const { theme } = useTheme();
  const [selectedMeal, setSelectedMeal] = useState<typeof MEAL_TYPES[number]>(getMealTypeFromTime());
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!session?.user.id) return;
    setIsSaving(true);

    try {
      const { data, error } = await supabase
        .from('food_logs')
        .insert({
          user_id: session.user.id,
          image_url: imageStorageUrl,
          food_name: result.food_name,
          calories: result.calories,
          protein_g: result.protein_g,
          carbs_g: result.carbs_g,
          fat_g: result.fat_g,
          fiber_g: result.fiber_g,
          meal_type: selectedMeal,
          raw_ai_response: result,
          logged_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Increment scan_count
      try {
        await supabase.rpc('increment_scan_count', { user_id: session.user.id });
      } catch {
        // Fallback: direct update
        supabase.from('profiles')
          .update({ scan_count: (useAuthStore.getState().profile?.scan_count ?? 0) + 1 })
          .eq('id', session.user.id);
      }

      addLog(data);
      await fetchProfile();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.getParent()?.navigate('Home');
    } catch (err: any) {
      Alert.alert('Save failed', err.message ?? 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero image with AI badge */}
        <View style={styles.heroWrap}>
          <Image source={{ uri: imageUri }} style={styles.foodImage} />
          <View style={[styles.aiBadge, { backgroundColor: theme.primary + 'E6' }]}>
            <Text style={styles.aiBadgeText}>✓ {result.confidence.toUpperCase()} MATCH</Text>
          </View>
        </View>

        {/* Result card */}
        <View style={[styles.card, { backgroundColor: theme.surface, shadowColor: theme.primary }]}>

          {/* Name + calories row */}
          <View style={styles.nameRow}>
            <Text style={[styles.foodName, { color: theme.textPrimary }]}>{result.food_name}</Text>
            <View style={styles.calBlock}>
              <Text style={[styles.calories, { color: theme.primary }]}>{result.calories}</Text>
              <Text style={[styles.kcalUnit, { color: theme.textSecondary }]}>kcal</Text>
            </View>
          </View>

          {/* Meal type chips */}
          <View style={styles.mealChips}>
            {MEAL_TYPES.map((meal) => (
              <TouchableOpacity
                key={meal}
                onPress={() => setSelectedMeal(meal)}
                style={[
                  styles.mealChip,
                  { borderColor: theme.borderColor },
                  selectedMeal === meal && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.mealChipLabel,
                  { color: theme.textSecondary },
                  selectedMeal === meal && { color: '#fff' },
                ]}>
                  {MEAL_LABELS[meal]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 2×2 Macro grid */}
          <View style={styles.macroGrid}>
            <NutrientCard label="Protein" value={result.protein_g} color={theme.protein} />
            <NutrientCard label="Carbs" value={result.carbs_g} color={theme.carbs} barColor={theme.carbs} />
            <NutrientCard label="Fat" value={result.fat_g} color={theme.fat} />
            <NutrientCard label="Fiber" value={result.fiber_g} color={theme.textSecondary} />
          </View>
        </View>
      </ScrollView>

      {/* Action buttons */}
      <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.borderColor }]}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={[styles.retakeButton, { borderColor: theme.primary }]}
          contentStyle={styles.buttonContent}
          textColor={theme.primary}
        >
          Retake
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving}
          style={styles.saveButton}
          contentStyle={styles.buttonContent}
          buttonColor={theme.primary}
        >
          Log This Meal
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },
  heroWrap: { position: 'relative' },
  foodImage: { width: '100%', aspectRatio: 1, resizeMode: 'cover' },
  aiBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  card: {
    margin: 16,
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  foodName: { flex: 1, fontSize: 22, fontWeight: '800', lineHeight: 28 },
  calBlock: { alignItems: 'flex-end' },
  calories: { fontSize: 40, fontWeight: '800', lineHeight: 44, letterSpacing: -1 },
  kcalUnit: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  mealChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  mealChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 50,
    borderWidth: 1,
  },
  mealChipLabel: { fontSize: 13, fontWeight: '700' },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mealLabel: { fontWeight: '600' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  retakeButton: { flex: 1 },
  saveButton: { flex: 2, borderRadius: 12 },
  buttonContent: { height: 52 },
});
