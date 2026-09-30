import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Image,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import Svg, { Path } from 'react-native-svg';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '../../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LegalModal, type LegalDoc } from '../../components/LegalModal';
import { T } from '../../theme';

/** Official multicolor Google "G" (per Google sign-in branding guidelines). */
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

// webClientId = the Google Cloud OAuth *Web* client ID (also added to Supabase →
// Auth → Providers → Google → Authorized Client IDs). Required so the returned
// ID token is accepted by Supabase's signInWithIdToken.
const GOOGLE_WEB_CLIENT_ID =
  Constants.expoConfig?.extra?.googleWebClientId ??
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  '';

if (GOOGLE_WEB_CLIENT_ID) {
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
}

// Google's light button spec: white fill, near-black label, sentence case.
const GOOGLE_BTN_BG = '#FFFFFF';
const GOOGLE_BTN_TEXT = '#1F1F1F';

/** Three things the app actually does today — no marketing abstractions. */
const PROOF_POINTS = [
  'Log a meal by photo, voice or barcode',
  'Health score for packaged-food labels',
  'Daily calorie and protein targets built for you',
] as const;

export function AuthScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

  // Subtle entrance: content fades in and rises on mount.
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 650,
      delay: 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance]);
  const entranceStyle = {
    opacity: entrance,
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  };

  const handleGoogleSignIn = async () => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      Alert.alert('Sign-in unavailable', 'Google sign-in is not configured yet. Please try again later.');
      return;
    }
    try {
      setIsLoading(true);

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      // ID token shape differs across SDK versions — handle both.
      const idToken =
        (response as { data?: { idToken?: string | null } })?.data?.idToken ??
        (response as { idToken?: string | null })?.idToken ??
        null;

      if (!idToken) throw new Error('Google did not return an ID token.');

      const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
      if (error) throw error;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      // User dismissed the picker — no error UI.
      if (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS) return;
      // Map SDK codes to friendly copy — never show raw codes like DEVELOPER_ERROR.
      let message: string;
      if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        message = 'Google Play Services is unavailable or out of date on this device.';
      } else if (code === 'DEVELOPER_ERROR') {
        message = 'Sign-in is temporarily unavailable. Please update the app and try again.';
      } else {
        message = err instanceof Error ? err.message : 'Please try again.';
      }
      Alert.alert('Sign-in failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Hero photo sits behind the top half; the gradient hands off to the
          solid app background well before the text starts, so copy is always
          on a dark, even ground. */}
      <Image
        source={require('../../../assets/auth-hero.png')}
        style={styles.heroBg}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(12,17,18,0.10)', 'rgba(12,17,18,0.72)', T.bg]}
        locations={[0, 0.5, 0.82]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Hero: brand + promise ─────────────────────────────────── */}
          <Animated.View style={[styles.hero, entranceStyle]}>
            <View style={styles.brandRow}>
              <Image source={require('../../../assets/icon.png')} style={styles.appIcon} />
              <Text style={styles.wordmark}>
                Cal<Text style={styles.wordmarkAccent}>Vue</Text>
              </Text>
            </View>

            <Text style={styles.headline}>See what&apos;s on your plate.</Text>
            <Text style={styles.subline}>
              Point your camera at any meal and get calories, protein, carbs and fat in seconds.
            </Text>

            <View style={styles.proofList}>
              {PROOF_POINTS.map((line) => (
                <View key={line} style={styles.proofRow}>
                  <Ionicons name="checkmark-circle" size={18} color={T.primary} />
                  <Text style={styles.proofText}>{line}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* ── Sign-in sheet ─────────────────────────────────────────── */}
          <Animated.View style={[styles.sheet, entranceStyle]}>
            <TouchableOpacity
              onPress={handleGoogleSignIn}
              style={styles.googleBtn}
              activeOpacity={0.88}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
            >
              {isLoading ? (
                <ActivityIndicator animating color={GOOGLE_BTN_TEXT} size="small" />
              ) : (
                <>
                  <GoogleLogo size={20} />
                  <Text style={styles.googleLabel}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>One tap. No password to remember.</Text>

            <Text style={styles.terms}>
              By continuing you agree to our{' '}
              <Text style={styles.termsLink} onPress={() => setLegalDoc('terms')}>
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text style={styles.termsLink} onPress={() => setLegalDoc('privacy')}>
                Privacy Policy
              </Text>.
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      <LegalModal
        visible={legalDoc !== null}
        doc={legalDoc ?? 'terms'}
        onClose={() => setLegalDoc(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  safe: { flex: 1 },
  heroBg: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '62%',
  },

  // flexGrow + flex-end pins the sheet to the bottom on tall screens and lets
  // the whole thing scroll on short ones instead of clipping.
  scroll: { flexGrow: 1, justifyContent: 'flex-end' },

  // Hero
  hero: { paddingHorizontal: 24, paddingBottom: 28, gap: 14 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  appIcon: {
    width: 44, height: 44, borderRadius: 12,
    borderWidth: 1, borderColor: T.glassBorder,
  },
  wordmark: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: T.textPrimary },
  wordmarkAccent: { color: T.primary },
  headline: {
    fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.8,
    color: T.textPrimary, maxWidth: 320,
  },
  subline: { fontSize: 16, lineHeight: 24, color: T.textSecondary, maxWidth: 340 },
  proofList: { gap: 10, marginTop: 6 },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  proofText: { fontSize: 15, lineHeight: 20, color: T.textPrimary, flexShrink: 1 },

  // Sheet
  sheet: {
    backgroundColor: T.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderColor: T.border,
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16,
    gap: 12,
  },
  googleBtn: {
    height: 54, borderRadius: 14, backgroundColor: GOOGLE_BTN_BG,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  googleLabel: { fontSize: 16, fontWeight: '600', color: GOOGLE_BTN_TEXT },
  hint: { fontSize: 13, textAlign: 'center', color: T.textMuted },
  terms: { fontSize: 12, lineHeight: 18, textAlign: 'center', color: T.textMuted, marginTop: 4 },
  termsLink: { color: T.primary, fontWeight: '600' },
});
