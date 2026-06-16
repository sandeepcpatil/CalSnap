import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../../services/supabase';
import { useAppTheme } from '../../context/ThemeContext';

const FOOD_IMAGE = require('../../../assets/a_vibrant_and_appetizing_high_quality_photo_of_a_healthy_mediterranean_salad.png');

WebBrowser.maybeCompleteAuthSession();

const FEATURE_ICONS = ['⚡', '📊', '🔥'] as const;
const FEATURE_LABELS = ['AI Analysis', 'Macros', 'Daily Streak'] as const;

export function AuthScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useAppTheme();
  const a = theme.auth; // shorthand

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);

      const redirectUrl = makeRedirectUri({ scheme: 'calsnap' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success' && result.url) {
          const url = new URL(result.url);
          const fragment = new URLSearchParams(url.hash.slice(1));
          const accessToken = fragment.get('access_token');
          const refreshToken = fragment.get('refresh_token');

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
        }
      }
    } catch (err: any) {
      Alert.alert('Sign-in failed', err.message ?? 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // overflow: 'hidden' clips the absolute-fill hero to the screen bounds (web fix)
    <View style={[styles.root, { backgroundColor: a.rootBg, overflow: 'hidden' }]}>

      {/* ── Hero background ────────────────────────────────────────────── */}
      {a.heroType === 'image' ? (
        <ImageBackground
          source={FOOD_IMAGE}
          style={styles.heroBg}
          resizeMode="cover"
        >
          <LinearGradient
            colors={a.overlayGradient as [string, string, ...string[]]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.72 }}
          />
        </ImageBackground>
      ) : (
        <LinearGradient
          colors={a.heroGradient as [string, string, ...string[]]}
          style={styles.heroBg}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 0.78 }}
        />
      )}

      {/* ── Top: logo + tagline ─────────────────────────────────────────── */}
      <SafeAreaView style={styles.hero} edges={['top']}>
        <View style={[styles.logoWrap, { backgroundColor: a.logoBg, borderColor: a.logoBorder }]}>
          <Text style={styles.logoEmoji}>🥗</Text>
        </View>
        <Text style={[styles.tagline, { color: a.taglineColor }]}>Snap. Track. Thrive.</Text>
        <Text style={[styles.subtitle, { color: a.subtitleColor }]}>
          Your nutrition journey, simplified by AI.
        </Text>
      </SafeAreaView>

      {/* ── Bottom: glass action panel ──────────────────────────────────── */}
      <SafeAreaView style={styles.panelSafe} edges={['bottom']}>
        <View style={[styles.glassPanel, { backgroundColor: a.glassBg, borderColor: a.glassBorder }]}>

          {/* Google CTA */}
          <TouchableOpacity
            onPress={handleGoogleSignIn}
            style={[styles.googleBtn, { backgroundColor: a.ctaButton, shadowColor: a.ctaButtonShadow }]}
            activeOpacity={0.88}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator animating color="#fff" />
            ) : (
              <>
                <Text style={styles.googleG}>G</Text>
                <Text style={styles.googleLabel}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={[styles.terms, { color: theme.onSurfaceVariant }]}>
            By continuing, you agree to our{' '}
            <Text style={[styles.termsLink, { color: a.termsLinkColor }]}>Terms</Text> and{' '}
            <Text style={[styles.termsLink, { color: a.termsLinkColor }]}>Privacy Policy</Text>.
          </Text>

          {/* Feature chips */}
          <View style={styles.features}>
            {FEATURE_ICONS.map((icon, i) => (
              <View
                key={FEATURE_LABELS[i]}
                style={[styles.chip, { borderColor: a.chipBorder }]}
              >
                <View style={[styles.chipIconWrap, { backgroundColor: a.chipBgs[i] }]}>
                  <Text style={styles.chipIcon}>{icon}</Text>
                </View>
                <Text style={[styles.chipLabel, { color: theme.onSurface }]}>
                  {FEATURE_LABELS[i]}
                </Text>
              </View>
            ))}
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between' },

  // Fills screen behind everything
  heroBg: {
    ...StyleSheet.absoluteFillObject,
  },

  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoEmoji: { fontSize: 48 },
  tagline: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 260,
    lineHeight: 22,
  },

  panelSafe: { paddingHorizontal: 16, paddingBottom: 4 },
  glassPanel: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    gap: 12,
  },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 50,
    paddingVertical: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  googleG: { fontSize: 18, fontWeight: '800', color: '#fff' },
  googleLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },

  terms: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  termsLink: { fontWeight: '700', textDecorationLine: 'underline' },

  features: { flexDirection: 'row', gap: 10, marginTop: 4 },
  chip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
    gap: 6,
  },
  chipIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIcon: { fontSize: 18 },
  chipLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
