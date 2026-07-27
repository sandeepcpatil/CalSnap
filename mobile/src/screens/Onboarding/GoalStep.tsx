import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { useAuthStore } from '../../store/authStore';
import { OnboardingProgress } from '../../components/OnboardingProgress';
import { T } from '../../theme';

type BodyGoal = 'lose_weight' | 'maintain' | 'gain_muscle';
type Props = { navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Goal'> };

const GOALS: { value: BodyGoal; label: string; description: string; emoji: string }[] = [
  { value: 'lose_weight', label: 'Lose Weight', description: '500 kcal deficit — steady fat loss', emoji: '🔥' },
  { value: 'maintain', label: 'Maintain Weight', description: 'Stay at your current weight', emoji: '⚖️' },
  { value: 'gain_muscle', label: 'Build Muscle', description: '300 kcal surplus — lean muscle gain', emoji: '💪' },
];

export function GoalStep({ navigation }: Props) {
  const [selected, setSelected] = useState<BodyGoal | null>(null);

  const handleNext = () => {
    if (!selected) return;
    useAuthStore.getState().updateProfile({ body_goal: selected });
    navigation.navigate('Summary');
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgress step={4} total={5} />

      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>Your goal 🎯</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>What would you like to achieve?</Text>

        <View style={styles.options}>
          {GOALS.map((goal) => (
            <TouchableOpacity
              key={goal.value}
              onPress={() => setSelected(goal.value)}
              style={[styles.option, selected === goal.value && styles.optionSelected]}
              activeOpacity={0.7}
            >
              <Text style={styles.optionEmoji}>{goal.emoji}</Text>
              <View style={styles.optionText}>
                <Text variant="titleMedium" style={[styles.optionLabel, selected === goal.value && styles.optionLabelSelected]}>
                  {goal.label}
                </Text>
                <Text variant="bodySmall" style={styles.optionDesc}>{goal.description}</Text>
              </View>
              {selected === goal.value && (
                <Text style={styles.checkmark}>✓</Text>
              )}
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
          Calculate Goals
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { color: T.primary, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: T.textSecondary, marginBottom: 32 },
  options: { gap: 14 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.surface,
    gap: 14,
  },
  optionSelected: { borderColor: T.primary, backgroundColor: T.primaryTint },
  optionEmoji: { fontSize: 30, width: 36, textAlign: 'center' },
  optionText: { flex: 1 },
  optionLabel: { color: T.textPrimary, fontWeight: '600' },
  optionLabelSelected: { color: T.primary },
  optionDesc: { color: T.textMuted, marginTop: 2 },
  checkmark: { color: T.primary, fontSize: 20, fontWeight: '700' },
  footer: { padding: 24, flexDirection: 'row', gap: 12 },
  backButton: { flex: 1, borderColor: T.primary },
  button: { flex: 2, borderRadius: 12, backgroundColor: T.primary },
  buttonContent: { height: 52 },
});
