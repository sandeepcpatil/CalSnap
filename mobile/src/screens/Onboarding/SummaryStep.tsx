import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { useAuthStore } from '../../store/authStore';
import { useOnboardingStore, getOnboardingInputs } from '../../store/onboardingStore';
import { GOAL_LABELS, ACTIVITY_LABELS } from '../../constants/profileLabels';
import { calculateGoals } from '../../utils/nutrition';
import { OnboardingProgress } from '../../components/OnboardingProgress';
import { T, spacing, radius, type, tabularNums } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Summary'> };

type SaveStatus = 'idle' | 'saving' | 'error';

/** Every new user gets a 7-day Pro trial when they finish onboarding. */
const TRIAL_DAYS = 7;

export function SummaryStep({ navigation }: Props) {
  const saveProfile = useAuthStore((s) => s.saveProfile);
  const fields = useOnboardingStore();
  const [status, setStatus] = useState<SaveStatus>('idle');

  // Targets come from what the user just entered, not from the server, so a
  // slow or failed write earlier can never leave this screen empty.
  const inputs = useMemo(() => getOnboardingInputs(fields), [fields]);
  const goals = useMemo(() => (inputs ? calculateGoals(inputs) : null), [inputs]);

  const handleFinish = async () => {
    if (!inputs || !goals || status === 'saving') return;
    setStatus('saving');
    try {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

      // One write for the whole flow. `onboarding_complete` rides along, so it
      // is only ever true once the row is actually saved.
      await saveProfile({
        name: inputs.name,
        age: inputs.age,
        gender: inputs.gender,
        weight_kg: inputs.weight_kg,
        height_cm: inputs.height_cm,
        activity_level: inputs.activity_level,
        body_goal: inputs.body_goal,
        daily_calorie_goal: goals.dailyCalorieGoal,
        daily_protein_goal: goals.dailyProteinGoal,
        trial_end_date: trialEnd.toISOString(),
        onboarding_complete: true,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // RootNavigator swaps to Main once onboarding_complete is true; the
      // scratch state is no longer needed.
      useOnboardingStore.getState().reset();
    } catch {
      setStatus('error');
    }
  };

  const footer = (
    <View style={styles.footer}>
      {status === 'error' && (
        <View style={styles.errorCard} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Ionicons name="cloud-offline-outline" size={20} color={T.error} />
          <Text style={styles.errorText}>
            Couldn't save your profile. Check your connection and try again.
          </Text>
        </View>
      )}
      <View style={styles.footerRow}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          disabled={status === 'saving'}
          textColor={T.primary}
          style={styles.backButton}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          Back
        </Button>
        <Button
          mode="contained"
          onPress={handleFinish}
          disabled={!goals || status === 'saving'}
          loading={status === 'saving'}
          buttonColor={T.primary}
          textColor={T.textOnPrimary}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          {status === 'saving' ? 'Saving' : status === 'error' ? 'Retry' : 'Start tracking'}
        </Button>
      </View>
    </View>
  );

  // Reached without complete answers (should not happen through the flow).
  // Keep the header and offer a way back rather than a bare spinner.
  if (!inputs || !goals) {
    return (
      <SafeAreaView style={styles.container}>
        <OnboardingProgress step={5} total={5} />
        <View style={styles.content}>
          <Text style={styles.title}>Almost there</Text>
          <Text style={styles.subtitle}>
            Some details are missing. Go back and fill in the earlier steps.
          </Text>
        </View>
        {footer}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgress step={5} total={5} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>You're all set</Text>
        <Text style={styles.subtitle}>Here's your personalised plan.</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Daily targets</Text>

          <View style={styles.metric}>
            <View style={styles.metricWell}>
              <Ionicons name="flame-outline" size={24} color={T.primary} />
            </View>
            <View style={styles.metricText}>
              <Text style={styles.metricValue}>
                {goals.dailyCalorieGoal.toLocaleString('en-IN')} kcal
              </Text>
              <Text style={styles.metricLabel}>Daily calorie goal</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.metric}>
            <View style={styles.metricWell}>
              <Ionicons name="fitness-outline" size={24} color={T.primary} />
            </View>
            <View style={styles.metricText}>
              <Text style={styles.metricValue}>{goals.dailyProteinGoal} g protein</Text>
              <Text style={styles.metricLabel}>Daily protein goal</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Goal</Text>
              <Text style={styles.statValue}>{GOAL_LABELS[inputs.body_goal].label}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Activity</Text>
              <Text style={styles.statValue}>{ACTIVITY_LABELS[inputs.activity_level].label}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.note}>You can change these any time in your profile.</Text>
      </ScrollView>

      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing['2xl'] },
  title: { ...type.headline, color: T.textPrimary, marginBottom: spacing.sm },
  subtitle: { ...type.body, color: T.textSecondary, marginBottom: spacing['2xl'] },
  summaryCard: {
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: T.border,
    gap: spacing.lg,
  },
  cardTitle: { ...type.title, color: T.textPrimary },
  metric: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  metricWell: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: T.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricText: { flex: 1 },
  metricValue: { ...type.title, ...tabularNums, color: T.textPrimary },
  metricLabel: { ...type.bodySm, color: T.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: T.divider },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statItem: { flex: 1, gap: spacing.xs },
  statLabel: { ...type.bodySm, color: T.textMuted },
  statValue: { ...type.body, fontWeight: '700', color: T.textPrimary },
  note: { ...type.bodySm, color: T.textMuted, textAlign: 'center', marginTop: spacing.lg },
  footer: { padding: spacing.xl, gap: spacing.md },
  footerRow: { flexDirection: 'row', gap: spacing.md },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: T.errorTint,
    borderWidth: 1,
    borderColor: T.error,
  },
  errorText: { ...type.body, color: T.textPrimary, flex: 1 },
  backButton: { flex: 1, borderRadius: radius.md, borderColor: T.primaryBorder },
  button: { flex: 2, borderRadius: radius.md },
  buttonContent: { height: 52 },
  buttonLabel: { ...type.body, fontWeight: '700' },
});
