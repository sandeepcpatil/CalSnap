import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../store/authStore';
import { calculateGoals } from '../../utils/nutrition';
import { OnboardingProgress } from '../../components/OnboardingProgress';

export function SummaryStep() {
  const { profile, updateProfile } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [goals, setGoals] = useState<{ dailyCalorieGoal: number; dailyProteinGoal: number } | null>(null);

  useEffect(() => {
    if (
      profile?.weight_kg &&
      profile?.height_cm &&
      profile?.age &&
      profile?.gender &&
      profile?.activity_level &&
      profile?.body_goal
    ) {
      const calculated = calculateGoals({
        weight_kg: profile.weight_kg,
        height_cm: profile.height_cm,
        age: profile.age,
        gender: profile.gender,
        activity_level: profile.activity_level,
        body_goal: profile.body_goal,
      });
      setGoals(calculated);
    }
  }, [profile]);

  const handleFinish = async () => {
    if (!goals) return;
    setIsSaving(true);
    try {
      // Give every new user a 7-day free Pro trial on first onboarding
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);

      await updateProfile({
        daily_calorie_goal: goals.dailyCalorieGoal,
        daily_protein_goal: goals.dailyProteinGoal,
        onboarding_complete: true,
        trial_end_date: trialEnd.toISOString(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // RootNavigator will automatically redirect to Main once onboarding_complete is true
    } finally {
      setIsSaving(false);
    }
  };

  if (!goals) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator animating color="#01696f" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgress step={5} total={5} />

      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>You're all set! 🎉</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>Here's your personalised plan</Text>

        <View style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <Text variant="titleLarge" style={styles.cardTitle}>Daily Targets</Text>
          </View>

          <View style={styles.metric}>
            <Text style={styles.metricIcon}>🔥</Text>
            <View style={styles.metricText}>
              <Text variant="headlineSmall" style={styles.metricValue}>
                {goals.dailyCalorieGoal.toLocaleString('en-IN')} kcal
              </Text>
              <Text variant="bodyMedium" style={styles.metricLabel}>Daily calorie goal</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.metric}>
            <Text style={styles.metricIcon}>💪</Text>
            <View style={styles.metricText}>
              <Text variant="headlineSmall" style={styles.metricValue}>
                {goals.dailyProteinGoal}g protein
              </Text>
              <Text variant="bodyMedium" style={styles.metricLabel}>Daily protein goal</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.statsRow}>
            {[
              { label: 'Goal', value: profile?.body_goal?.replace('_', ' ') ?? '—' },
              { label: 'Activity', value: profile?.activity_level ?? '—' },
            ].map((s) => (
              <View key={s.label} style={styles.statItem}>
                <Text variant="bodySmall" style={styles.statLabel}>{s.label}</Text>
                <Text variant="titleSmall" style={styles.statValue}>{s.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text variant="bodySmall" style={styles.note}>
          You can update these anytime in your Profile.
        </Text>
      </View>

      <View style={styles.footer}>
        {isSaving ? (
          <ActivityIndicator animating color="#01696f" />
        ) : (
          <Button
            mode="contained"
            onPress={handleFinish}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            Start Tracking!
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fffe' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { color: '#01696f', fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#546e7a', marginBottom: 28 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e0f2f1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 16,
  },
  cardHeader: { marginBottom: 4 },
  cardTitle: { color: '#01696f', fontWeight: '700' },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  metricIcon: { fontSize: 32 },
  metricText: { flex: 1 },
  metricValue: { color: '#212121', fontWeight: '700' },
  metricLabel: { color: '#757575', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f0f0f0' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', gap: 4 },
  statLabel: { color: '#90a4ae', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { color: '#37474f', fontWeight: '600', textTransform: 'capitalize' },
  note: { color: '#b0bec5', textAlign: 'center', marginTop: 16 },
  footer: { padding: 24 },
  button: { borderRadius: 12, backgroundColor: '#01696f' },
  buttonContent: { height: 52 },
});
