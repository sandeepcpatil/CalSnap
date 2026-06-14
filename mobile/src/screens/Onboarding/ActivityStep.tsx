import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { useAuthStore } from '../../store/authStore';
import { OnboardingProgress } from '../../components/OnboardingProgress';

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type Props = { navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Activity'> };

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; description: string; emoji: string }[] = [
  { value: 'sedentary', label: 'Sedentary', description: 'Little to no exercise', emoji: '🛋️' },
  { value: 'light', label: 'Lightly active', description: 'Light exercise 1–3 days/week', emoji: '🚶' },
  { value: 'moderate', label: 'Moderately active', description: 'Moderate exercise 3–5 days/week', emoji: '🏃' },
  { value: 'active', label: 'Very active', description: 'Hard exercise 6–7 days/week', emoji: '🏋️' },
  { value: 'very_active', label: 'Extra active', description: 'Very hard exercise + physical job', emoji: '⚡' },
];

export function ActivityStep({ navigation }: Props) {
  const [selected, setSelected] = useState<ActivityLevel | null>(null);

  const handleNext = () => {
    if (!selected) return;
    useAuthStore.getState().updateProfile({ activity_level: selected });
    navigation.navigate('Goal');
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgress step={3} total={5} />

      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>Activity level 🏃</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>How active are you day-to-day?</Text>

        <View style={styles.options}>
          {ACTIVITY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setSelected(opt.value)}
              style={[styles.option, selected === opt.value && styles.optionSelected]}
              activeOpacity={0.7}
            >
              <Text style={styles.optionEmoji}>{opt.emoji}</Text>
              <View style={styles.optionText}>
                <Text variant="titleSmall" style={[styles.optionLabel, selected === opt.value && styles.optionLabelSelected]}>
                  {opt.label}
                </Text>
                <Text variant="bodySmall" style={styles.optionDesc}>{opt.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Button mode="outlined" onPress={() => navigation.goBack()} style={styles.backButton}>Back</Button>
        <Button
          mode="contained"
          onPress={handleNext}
          disabled={!selected}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Continue
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fffe' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { color: '#01696f', fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#546e7a', marginBottom: 24 },
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    gap: 12,
  },
  optionSelected: { borderColor: '#01696f', backgroundColor: '#e0f2f1' },
  optionEmoji: { fontSize: 24, width: 32, textAlign: 'center' },
  optionText: { flex: 1 },
  optionLabel: { color: '#37474f', fontWeight: '600' },
  optionLabelSelected: { color: '#01696f' },
  optionDesc: { color: '#90a4ae', marginTop: 2 },
  footer: { padding: 24, flexDirection: 'row', gap: 12 },
  backButton: { flex: 1, borderColor: '#01696f' },
  button: { flex: 2, borderRadius: 12, backgroundColor: '#01696f' },
  buttonContent: { height: 52 },
});
