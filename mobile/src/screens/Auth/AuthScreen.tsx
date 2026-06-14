import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../../services/supabase';

WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get('window');

export function AuthScreen() {
  const [isLoading, setIsLoading] = useState(false);

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
          // Extract session from the redirect URL
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
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        {/* Logo placeholder — replace with assets/icon.png */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>🥗</Text>
        </View>

        <Text variant="displaySmall" style={styles.appName}>CalSnap</Text>
        <Text variant="titleMedium" style={styles.tagline}>
          Snap your food. Know your nutrition.
        </Text>
      </View>

      <View style={styles.features}>
        {['📷  Instant AI food recognition', '📊  Track macros effortlessly', '🎯  Personalised calorie goals'].map((f) => (
          <Text key={f} variant="bodyMedium" style={styles.featureItem}>{f}</Text>
        ))}
      </View>

      <View style={styles.footer}>
        {isLoading ? (
          <ActivityIndicator animating size="large" color="#01696f" />
        ) : (
          <Button
            mode="contained"
            onPress={handleGoogleSignIn}
            style={styles.googleButton}
            contentStyle={styles.googleButtonContent}
            labelStyle={styles.googleButtonLabel}
            icon="google"
          >
            Continue with Google
          </Button>
        )}

        <Text variant="bodySmall" style={styles.legal}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fffe',
    paddingHorizontal: 24,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: '#e0f2f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoEmoji: {
    fontSize: 54,
  },
  appName: {
    color: '#01696f',
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  tagline: {
    color: '#546e7a',
    textAlign: 'center',
  },
  features: {
    gap: 12,
    marginBottom: 40,
  },
  featureItem: {
    color: '#37474f',
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    paddingBottom: 24,
    gap: 16,
  },
  googleButton: {
    borderRadius: 12,
    backgroundColor: '#01696f',
  },
  googleButtonContent: {
    height: 52,
  },
  googleButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  legal: {
    color: '#9e9e9e',
    textAlign: 'center',
    lineHeight: 18,
  },
});
