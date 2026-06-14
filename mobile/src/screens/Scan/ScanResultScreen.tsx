import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Text, Button, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { ScanStackParamList } from '../../navigation/ScanNavigator';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { getMealTypeFromTime } from '../../utils/nutrition';
import { MacroBar } from '../../components/MacroBar';

type Props = {
  navigation: NativeStackNavigationProp<ScanStackParamList, 'ScanResult'>;
  route: RouteProp<ScanStackParamList, 'ScanResult'>;
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_LABELS: Record<string, string> = {
  breakfast: '🌅 Breakfast',
  lunch: '☀️ Lunch',
  dinner: '🌙 Dinner',
  snack: '🍎 Snack',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: '#4caf50',
  medium: '#ff9800',
  low: '#ef5350',
};

export function ScanResultScreen({ navigation, route }: Props) {
  const { imageUri, imageStorageUrl, result } = route.params;
  const { session, fetchProfile } = useAuthStore();
  const { addLog } = useFoodLogStore();
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
      await supabase.rpc('increment_scan_count', { user_id: session.user.id }).catch(() => {
        // Fallback: direct update
        supabase.from('profiles')
          .update({ scan_count: (useAuthStore.getState().profile?.scan_count ?? 0) + 1 })
          .eq('id', session.user.id);
      });

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Food image */}
        <Image source={{ uri: imageUri }} style={styles.foodImage} />

        {/* Result card */}
        <View style={styles.card}>
          {/* Confidence badge */}
          <View style={styles.badgeRow}>
            <View style={[styles.confidenceBadge, { backgroundColor: CONFIDENCE_COLORS[result.confidence] + '20' }]}>
              <Text variant="labelSmall" style={[styles.confidenceText, { color: CONFIDENCE_COLORS[result.confidence] }]}>
                {result.confidence.toUpperCase()} CONFIDENCE
              </Text>
            </View>
          </View>

          {/* Food name & calories */}
          <Text variant="headlineMedium" style={styles.foodName}>{result.food_name}</Text>
          <Text variant="displaySmall" style={styles.calories}>
            {result.calories} <Text variant="titleLarge" style={styles.kcalUnit}>kcal</Text>
          </Text>

          {/* Macro bars */}
          <View style={styles.macros}>
            <MacroBar label="Protein" current={result.protein_g} goal={Math.max(result.protein_g, 1)} color="#4caf50" unit="g" />
            <MacroBar label="Carbs" current={result.carbs_g} goal={Math.max(result.carbs_g, 1)} color="#ff9800" unit="g" />
            <MacroBar label="Fat" current={result.fat_g} goal={Math.max(result.fat_g, 1)} color="#ffc107" unit="g" />
            <MacroBar label="Fiber" current={result.fiber_g} goal={Math.max(result.fiber_g, 1)} color="#29b6f6" unit="g" />
          </View>

          {/* Notes */}
          {result.notes && (
            <View style={styles.notes}>
              <Text variant="labelMedium" style={styles.notesLabel}>AI Notes</Text>
              <Text variant="bodySmall" style={styles.notesText}>{result.notes}</Text>
            </View>
          )}

          {/* Meal type selector */}
          <Text variant="labelLarge" style={styles.mealLabel}>Add to meal</Text>
          <View style={styles.mealChips}>
            {MEAL_TYPES.map((meal) => (
              <Chip
                key={meal}
                selected={selectedMeal === meal}
                onPress={() => setSelectedMeal(meal)}
                selectedColor="#01696f"
                style={[styles.mealChip, selectedMeal === meal && styles.mealChipSelected]}
                compact
              >
                {MEAL_LABELS[meal]}
              </Chip>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.footer}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.retakeButton}
          contentStyle={styles.buttonContent}
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
        >
          Save
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fffe' },
  scroll: { paddingBottom: 120 },
  foodImage: { width: '100%', height: 280, resizeMode: 'cover' },
  card: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  badgeRow: { flexDirection: 'row' },
  confidenceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  confidenceText: { fontWeight: '700', letterSpacing: 0.5 },
  foodName: { color: '#212121', fontWeight: '700', lineHeight: 32 },
  calories: { color: '#01696f', fontWeight: '800' },
  kcalUnit: { color: '#90a4ae', fontWeight: '400' },
  macros: { gap: 10 },
  notes: { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12, gap: 4 },
  notesLabel: { color: '#546e7a', fontWeight: '700' },
  notesText: { color: '#78909c' },
  mealLabel: { color: '#37474f', fontWeight: '600' },
  mealChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealChip: { backgroundColor: '#f5f5f5' },
  mealChipSelected: { backgroundColor: '#e0f2f1' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  retakeButton: { flex: 1, borderColor: '#01696f' },
  saveButton: { flex: 2, borderRadius: 12, backgroundColor: '#01696f' },
  buttonContent: { height: 52 },
});
