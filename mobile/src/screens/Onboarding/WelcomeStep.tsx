import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TextInput as RNTextInput } from 'react-native';
import { Text, TextInput, Button, SegmentedButtons, HelperText } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { useAuthStore } from '../../store/authStore';
import { useOnboardingStore, ONBOARDING_LIMITS, parseInRange } from '../../store/onboardingStore';
import { GENDER_LABELS, GENDER_ORDER, type Gender } from '../../constants/profileLabels';
import { OnboardingProgress } from '../../components/OnboardingProgress';
import { T, spacing, radius, type } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Welcome'> };

const AGE = ONBOARDING_LIMITS.age;

export function WelcomeStep({ navigation }: Props) {
  const profileName = useAuthStore((s) => s.profile?.name ?? '');
  const { name, age, gender, setFields } = useOnboardingStore();
  const ageRef = useRef<RNTextInput>(null);

  // Prefill from the sign-in profile once; the user can still clear it.
  useEffect(() => {
    if (!useOnboardingStore.getState().name && profileName) setFields({ name: profileName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ageValue = parseInRange(age, AGE);
  const ageInvalid = age.length > 0 && ageValue === null;
  const canContinue = name.trim().length > 0 && ageValue !== null && gender !== null;

  const handleNext = () => {
    if (!canContinue) return;
    setFields({ name: name.trim() });
    navigation.navigate('BodyStats');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <OnboardingProgress step={1} total={5} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Welcome to CalVue</Text>
          <Text style={styles.subtitle}>A few details so your targets fit you.</Text>

          <View style={styles.form}>
            <TextInput
              label="Your name"
              value={name}
              onChangeText={(v) => setFields({ name: v })}
              mode="outlined"
              textColor={T.textPrimary}
              style={styles.input}
              outlineColor={T.border}
              activeOutlineColor={T.primary}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => ageRef.current?.focus()}
            />

            <View>
              <TextInput
                ref={ageRef}
                label="Age"
                value={age}
                onChangeText={(v) => setFields({ age: v.replace(/[^0-9]/g, '') })}
                mode="outlined"
                textColor={T.textPrimary}
                style={styles.input}
                keyboardType="number-pad"
                outlineColor={T.border}
                activeOutlineColor={T.primary}
                error={ageInvalid}
                maxLength={3}
                returnKeyType="done"
              />
              <HelperText type="error" visible={ageInvalid} style={styles.helper}>
                Age {AGE.min} to {AGE.max}
              </HelperText>
            </View>

            <Text style={styles.label}>Gender</Text>
            <SegmentedButtons
              value={gender ?? ''}
              onValueChange={(v) => setFields({ gender: v as Gender })}
              buttons={GENDER_ORDER.map((g) => ({ value: g, label: GENDER_LABELS[g] }))}
            />
            <Text style={styles.fieldNote}>Used only for the calorie formula.</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {!canContinue && (
            <Text style={styles.hint}>
              Enter your name, an age between {AGE.min} and {AGE.max}, and choose a gender.
            </Text>
          )}
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
  label: { ...type.body, fontWeight: '700', color: T.textPrimary, marginTop: spacing.xs },
  fieldNote: { ...type.bodySm, color: T.textMuted },
  footer: { padding: spacing.xl, gap: spacing.md },
  hint: { ...type.bodySm, color: T.textMuted, textAlign: 'center' },
  button: { borderRadius: radius.md },
  buttonContent: { height: 52 },
  buttonLabel: { ...type.body, fontWeight: '700' },
});
