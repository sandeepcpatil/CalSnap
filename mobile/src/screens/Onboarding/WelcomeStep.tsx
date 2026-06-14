import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, SegmentedButtons } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { useAuthStore } from '../../store/authStore';
import { OnboardingProgress } from '../../components/OnboardingProgress';

type Props = { navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Welcome'> };

export function WelcomeStep({ navigation }: Props) {
  const { profile } = useAuthStore();
  const [name, setName] = useState(profile?.name ?? '');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');

  const canContinue = name.trim().length > 0 && Number(age) >= 10 && Number(age) <= 120;

  const handleNext = () => {
    useAuthStore.getState().updateProfile({
      name: name.trim(),
      age: Number(age),
      gender,
    });
    navigation.navigate('BodyStats');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <OnboardingProgress step={1} total={5} />

        <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>Welcome to CalSnap 👋</Text>
          <Text variant="bodyLarge" style={styles.subtitle}>Let's personalise your experience</Text>

          <View style={styles.form}>
            <TextInput
              label="Your name"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
              outlineColor="#b0bec5"
              activeOutlineColor="#01696f"
              autoCapitalize="words"
            />

            <TextInput
              label="Age"
              value={age}
              onChangeText={(v) => setAge(v.replace(/[^0-9]/g, ''))}
              mode="outlined"
              style={styles.input}
              keyboardType="number-pad"
              outlineColor="#b0bec5"
              activeOutlineColor="#01696f"
              maxLength={3}
            />

            <Text variant="labelLarge" style={styles.label}>Gender</Text>
            <SegmentedButtons
              value={gender}
              onValueChange={(v) => setGender(v as 'male' | 'female' | 'other')}
              buttons={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </View>
        </View>

        <View style={styles.footer}>
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
  container: { flex: 1, backgroundColor: '#f8fffe' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { color: '#01696f', fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#546e7a', marginBottom: 32 },
  form: { gap: 16 },
  input: { backgroundColor: '#fff' },
  label: { color: '#37474f', marginTop: 4, marginBottom: 4 },
  footer: { padding: 24 },
  button: { borderRadius: 12, backgroundColor: '#01696f' },
  buttonContent: { height: 52 },
});
