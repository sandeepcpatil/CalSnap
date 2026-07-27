import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { useAuthStore } from '../../store/authStore';
import { OnboardingProgress } from '../../components/OnboardingProgress';
import { T } from '../../theme';

type Props = { navigation: NativeStackNavigationProp<OnboardingStackParamList, 'BodyStats'> };

export function BodyStatsStep({ navigation }: Props) {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  const canContinue =
    Number(weight) >= 20 && Number(weight) <= 300 &&
    Number(height) >= 100 && Number(height) <= 250;

  const handleNext = () => {
    useAuthStore.getState().updateProfile({
      weight_kg: Number(weight),
      height_cm: Number(height),
    });
    navigation.navigate('Activity');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <OnboardingProgress step={2} total={5} />

        <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>Your body stats ⚖️</Text>
          <Text variant="bodyLarge" style={styles.subtitle}>Used to calculate your personalised goals</Text>

          <View style={styles.form}>
            <TextInput
              label="Weight (kg)"
              value={weight}
              onChangeText={(v) => setWeight(v.replace(/[^0-9.]/g, ''))}
              mode="outlined"
              textColor={T.textPrimary}
              style={styles.input}
              keyboardType="decimal-pad"
              outlineColor={T.border}
              activeOutlineColor={T.primary}
              right={<TextInput.Affix text="kg" />}
            />

            <TextInput
              label="Height (cm)"
              value={height}
              onChangeText={(v) => setHeight(v.replace(/[^0-9.]/g, ''))}
              mode="outlined"
              textColor={T.textPrimary}
              style={styles.input}
              keyboardType="decimal-pad"
              outlineColor={T.border}
              activeOutlineColor={T.primary}
              right={<TextInput.Affix text="cm" />}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Button mode="outlined" onPress={() => navigation.goBack()} style={styles.backButton}>
            Back
          </Button>
          <Button
            mode="contained"
            onPress={handleNext}
            disabled={!canContinue}
            style={styles.button}
            contentStyle={styles.buttonContent}
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
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { color: T.primary, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: T.textSecondary, marginBottom: 32 },
  form: { gap: 16 },
  input: { backgroundColor: T.surface },
  footer: { padding: 24, flexDirection: 'row', gap: 12 },
  backButton: { flex: 1, borderColor: T.primary },
  button: { flex: 2, borderRadius: 12, backgroundColor: T.primary },
  buttonContent: { height: 52 },
});
