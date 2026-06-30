import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../../services/supabase';
import { Ionicons } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

// ── Stitch dark / tech color tokens (matches HTML exactly) ────────────────
const C = {
  bg:               '#101415',
  glass:            'rgba(15, 23, 42, 0.80)',
  glassBorder:      'rgba(255, 255, 255, 0.10)',
  primary:          '#85d3da',
  secondary:        '#bdf4ff',
  primaryContainer: '#01696f',
  onSurface:        '#e0e3e5',
  onSurfaceVariant: '#bec8c9',
  outline:          '#889393',
  outlineVariant:   '#3f4949',
  surfaceLowest:    '#0b0f10',
};

const FEATURES = [
  { icon: 'camera-outline'    as const, label: 'AI Analysis',    desc: 'Instant meal recognition via neural engine.'          },
  { icon: 'bar-chart-outline' as const, label: 'Macro Tracking', desc: 'Deep clinical insights on protein and fibers.'        },
  { icon: 'flame-outline'     as const, label: 'Streaks',        desc: 'Gamified wellness to sustain high performance.'       },
] as const;

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
    <View style={styles.root}>
      {/* ── Cinematic hero background image ─────────────────────────────── */}
      <Image
        source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD7bSwv2b1GD_1qfmjXzb3eYWa8rtoXbSBViqrjHBGforNxlm0DEW206JH-KkNnZb4IwIzC1piUFaR6SLFfV_ufjGHTp6jZn5OeUMqqR7JSwLFNR2HwIb1ErT12xTXcQbgXmZ7Gglfi1uKrwGigZKXb6gvls1MRwJOLa4zGVS2iusesBTgNJPot8QctGjX0Nbz0pOA5wl4iMHJy3oz9WaxxNQ57oEupxFvPrfPCd8KU2jAhN7vlyFph42gtororetrXyyfD4q9YFGGy' }}
        style={styles.heroBg}
        resizeMode="cover"
      />
      {/* Dark gradient overlay — dims the photo so text stays legible */}
      <LinearGradient
        colors={['rgba(10,16,21,0.55)', 'rgba(16,20,21,0.78)', '#101415']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Ambient cyan glow accents */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >

            {/* ── Floating badge ─────────────────────────────────────────── */}
            <View style={styles.badgeRow}>
              <View style={[styles.floatingBadge, { backgroundColor: C.glass, borderColor: C.glassBorder }]}>
                <Ionicons name="nutrition-outline" size={16} color={C.secondary} />
                <Text style={styles.badgeText}>NEXT-GEN NUTRITION</Text>
              </View>
            </View>

            {/* ── Brand block ────────────────────────────────────────────── */}
            <View style={styles.brandBlock}>
              <Text style={styles.brandName} numberOfLines={1} adjustsFontSizeToFit>
                <Text style={styles.brandCal}>CAL</Text>
                <Text style={{ color: C.secondary }}>SNAP</Text>
              </Text>
              <Text style={[styles.tagline, { color: C.onSurfaceVariant }]}>
                Snap. Track.{' '}
                <Text style={{ color: C.primary }}>Thrive.</Text>
              </Text>
            </View>

            {/* ── Feature bento stack (vertical) ─────────────────────── */}
            <View style={styles.bentoGrid}>
              {FEATURES.map((f) => (
                <View
                  key={f.label}
                  style={[styles.bentoCard, { backgroundColor: C.glass, borderColor: C.glassBorder }]}
                >
                  <View style={[styles.bentoIcon, { backgroundColor: C.primaryContainer + '55' }]}>
                    <Ionicons name={f.icon} size={20} color={C.secondary} />
                  </View>
                  <View style={styles.bentoText}>
                    <Text style={[styles.bentoLabel, { color: C.onSurface }]}>{f.label}</Text>
                    <Text style={[styles.bentoDesc, { color: C.onSurfaceVariant }]}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ── Auth card ──────────────────────────────────────────────── */}
            <View style={[styles.authCard, { backgroundColor: C.glass, borderColor: C.glassBorder }]}>

              <View style={styles.authHeader}>
                <Text style={[styles.authTitle, { color: C.onSurface }]}>Get Started</Text>
                <Text style={[styles.authSubtitle, { color: C.onSurfaceVariant }]}>
                  Access your high-performance nutrition dashboard.
                </Text>
              </View>

              {/* Google button */}
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                style={[styles.googleBtn, { backgroundColor: C.onSurface }]}
                activeOpacity={0.88}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator animating color={C.bg} size="small" />
                ) : (
                  <>
                    <Text style={[styles.googleG, { color: C.bg }]}>G</Text>
                    <Text style={[styles.googleLabel, { color: C.bg }]}>CONTINUE WITH GOOGLE</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Terms */}
              <Text style={[styles.terms, { color: C.onSurfaceVariant }]}>
                By continuing, you agree to our{' '}
                <Text style={[styles.termsLink, { color: C.secondary }]}>Clinical Data Policy</Text>
                {' '}and{' '}
                <Text style={[styles.termsLink, { color: C.secondary }]}>Terms of Service</Text>.
              </Text>
            </View>

            {/* ── System status indicator ────────────────────────────────── */}
            <View style={[styles.statusBar, {
              backgroundColor: C.glass,
              borderColor: C.glassBorder,
              borderLeftColor: C.secondary,
            }]}>
              <View>
                <Text style={[styles.statusLabel, { color: C.secondary }]}>SYSTEM STATUS</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: C.secondary }]} />
                  <Text style={[styles.statusActive, { color: C.onSurface }]}>ACTIVE</Text>
                </View>
              </View>
              <View style={styles.dotRow}>
                {([0.3, 0.55, 1] as const).map((o, i) => (
                  <View key={i} style={[styles.accentDot, { backgroundColor: C.secondary, opacity: o }]} />
                ))}
              </View>
            </View>

          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101415' },
  heroBg: { ...StyleSheet.absoluteFillObject, opacity: 0.40 },

  glowTop: {
    position: 'absolute', top: -80, left: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(0,227,253,0.06)',
  },
  glowBottom: {
    position: 'absolute', bottom: -60, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(133,211,218,0.05)',
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 20,
  },

  // Floating badge
  badgeRow: { alignItems: 'center' },
  floatingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 100, borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#bdf4ff' },

  // Brand
  brandBlock: { alignItems: 'center', gap: 6 },
  brandName:  { fontSize: 56, fontWeight: '800', letterSpacing: -2, lineHeight: 62 },
  brandCal:   { color: '#e0e3e5' },
  tagline:    { fontSize: 18, fontWeight: '600', letterSpacing: 0.4 },

  // Bento stack — one card per row, icon left + text right
  bentoGrid: { flexDirection: 'column', gap: 8 },
  bentoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  bentoIcon: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bentoText:  { flex: 1 },
  bentoLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 2 },
  bentoDesc:  { fontSize: 11, lineHeight: 15 },

  // Auth card
  authCard: {
    borderRadius: 20, borderWidth: 1, padding: 22, gap: 16,
    shadowColor: '#00e3fd', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 4,
  },
  authHeader:   { gap: 4 },
  authTitle:    { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  authSubtitle: { fontSize: 14, lineHeight: 20 },

  googleBtn: {
    height: 56, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  googleG:     { fontSize: 20, fontWeight: '800' },
  googleLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },

  terms:     { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  termsLink: { fontWeight: '700' },

  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 12, borderWidth: 1, borderLeftWidth: 4,
  },
  statusLabel:  { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot:    { width: 8, height: 8, borderRadius: 4 },
  statusActive: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  dotRow:       { flexDirection: 'row', gap: 4, alignItems: 'center' },
  accentDot:    { width: 6, height: 6, borderRadius: 3 },
});
