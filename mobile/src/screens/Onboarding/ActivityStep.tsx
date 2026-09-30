import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { useOnboardingStore } from '../../store/onboardingStore';
import { ACTIVITY_LABELS, ACTIVITY_ORDER } from '../../constants/profileLabels';
import { OnboardingProgress } from '../../components/OnboardingProgress';
import { OptionCard } from '../../components/OptionCard';
import { T, spacing, radius, type } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Activity'> };

export function ActivityStep({ navigation }: Props) {
  const { activity, setFields } = useOnboardingStore();

  const handleNext = () => {
    if (!activity) return;
    navigation.navigate('Goal');
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingProgress step={3} total={5} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Activity level</Text>
        <Text style={styles.subtitle}>How active are you on a typical day?</Text>

        <View style={styles.options} accessibilityRole="radiogroup">
          {ACTIVITY_ORDER.map((value) => {
            const opt = ACTIVITY_LABELS[value];
            return (
              <OptionCard
                key={value}
                label={opt.label}
                description={opt.description}
                icon={opt.icon}
                selected={activity === value}
                onPress={() => setFields({ activity: value })}
              />
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {!activity && <Text style={styles.hint}>Choose one to continue.</Text>}
        <View style={styles.footerRow}>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            textColor={T.primary}
            style={styles.backButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            Back
          </Button>
          <Button
            mode="contained"
            onPress={handleNext}
            disabled={!activity}
            buttonColor={T.primary}
            textColor={T.textOnPrimary}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            Continue
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing['2xl'] },
  title: { ...type.headline, color: T.textPrimary, marginBottom: spacing.sm },
  subtitle: { ...type.body, color: T.textSecondary, marginBottom: spacing['2xl'] },
  options: { gap: spacing.md },
  footer: { padding: spacing.xl, gap: spacing.md },
  footerRow: { flexDirection: 'row', gap: spacing.md },
  hint: { ...type.bodySm, color: T.textMuted, textAlign: 'center' },
  backButton: { flex: 1, borderRadius: radius.md, borderColor: T.primaryBorder },
  button: { flex: 2, borderRadius: radius.md },
  buttonContent: { height: 52 },
  buttonLabel: { ...type.body, fontWeight: '700' },
});
