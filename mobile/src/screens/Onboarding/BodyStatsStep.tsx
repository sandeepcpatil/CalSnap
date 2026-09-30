import React, { useRef } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TextInput as RNTextInput } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { useOnboardingStore, ONBOARDING_LIMITS, parseInRange } from '../../store/onboardingStore';
import { OnboardingProgress } from '../../components/OnboardingProgress';
import { T, spacing, radius, type } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<OnboardingStackParamList, 'BodyStats'> };

const W = ONBOARDING_LIMITS.weightKg;
const H = ONBOARDING_LIMITS.heightCm;

export function BodyStatsStep({ navigation }: Props) {
  const { weightKg, heightCm, setFields } = useOnboardingStore();
  const heightRef = useRef<RNTextInput>(null);

  const weightValue = parseInRange(weightKg, W);
  const heightValue = parseInRange(heightCm, H);
  const weightInvalid = weightKg.length > 0 && weightValue === null;
  const heightInvalid = heightCm.length > 0 && heightValue === null;
  const canContinue = weightValue !== null && heightValue !== null;

  const handleNext = () => {
    if (!canContinue) return;
    navigation.navigate('Activity');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <OnboardingProgress step={2} total={5} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Your body stats</Text>
          <Text style={styles.subtitle}>Used to work out your daily calorie and protein targets.</Text>

          <View style={styles.form}>
            <View>
              <TextInput
                label="Weight (kg)"
                value={weightKg}
                onChangeText={(v) => setFields({ weightKg: v.replace(/[^0-9.]/g, '') })}
                mode="outlined"
                textColor={T.textPrimary}
                style={styles.input}
                keyboardType="decimal-pad"
                outlineColor={T.border}
                activeOutlineColor={T.primary}
                error={weightInvalid}
                right={<TextInput.Affix text="kg" />}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => heightRef.current?.focus()}
              />
              <HelperText type="error" visible={weightInvalid} style={styles.helper}>
                Weight {W.min} to {W.max} kg
              </HelperText>
            </View>

            <View>
              <TextInput
                ref={heightRef}
                label="Height (cm)"
                value={heightCm}
                onChangeText={(v) => setFields({ heightCm: v.replace(/[^0-9.]/g, '') })}
                mode="outlined"
                textColor={T.textPrimary}
                style={styles.input}
                keyboardType="decimal-pad"
                outlineColor={T.border}
                activeOutlineColor={T.primary}
                error={heightInvalid}
                right={<TextInput.Affix text="cm" />}
                returnKeyType="done"
                onSubmitEditing={handleNext}
              />
              <HelperText type="error" visible={heightInvalid} style={styles.helper}>
                Height {H.min} to {H.max} cm
              </HelperText>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {!canContinue && (
            <Text style={styles.hint}>
              Enter a weight between {W.min} and {W.max} kg and a height between {H.min} and {H.max} cm.
            </Text>
          )}
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
              disabled={!canContinue}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing['2xl'] },
  title: { ...type.headline, color: T.textPrimary, marginBottom: spacing.sm },
  subtitle: { ...type.body, color: T.textSecondary, marginBottom: spacing['3xl'] },
  form: { gap: spacing.md },
  input: { backgroundColor: T.surface },
  helper: { ...type.bodySm, color: T.error },
  footer: { padding: spacing.xl, gap: spacing.md },
  footerRow: { flexDirection: 'row', gap: spacing.md },
  hint: { ...type.bodySm, color: T.textMuted, textAlign: 'center' },
  backButton: { flex: 1, borderRadius: radius.md, borderColor: T.primaryBorder },
  button: { flex: 2, borderRadius: radius.md },
  buttonContent: { height: 52 },
  buttonLabel: { ...type.body, fontWeight: '700' },
});
