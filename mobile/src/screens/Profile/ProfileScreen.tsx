import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { useHealthStore } from '../../store/healthStore';
import { useStepCounter } from '../../hooks/useStepCounter';
import { PaywallModal } from '../Paywall/PaywallModal';
import { NotificationSettingsModal } from '../../components/NotificationSettingsModal';
import { EditProfileModal } from '../../components/EditProfileModal';

const C = {
  bg:              '#101415',
  glass:           'rgba(15,23,42,0.80)',
  glassBorder:     'rgba(255,255,255,0.08)',
  primary:         '#85d3da',
  secondary:       '#bdf4ff',
  tertiary:        '#c0c1ff',
  secondaryCont:   '#00e3fd',
  onSurface:       '#e0e3e5',
  onSurfaceVar:    '#bec8c9',
  outline:         '#889393',
  outlineVar:      '#3f4949',
  primaryCont:     '#01696f',
  error:           '#ffb4ab',
  surfaceCont:     '#1d2022',
};

export function ProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const { todayLogs } = useFoodLogStore();
  const { steps } = useHealthStore();
  const [showPaywall, setShowPaywall] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  // Activate step counter while this screen is mounted
  useStepCounter();

  const isSubscribed    = profile?.is_subscribed ?? false;
  const scanCount       = profile?.scan_count    ?? 0;
  const weight          = profile?.weight_kg     ?? 0;
  const proteinGoal     = profile?.daily_protein_goal ?? 160;
  const bodyGoal        = profile?.body_goal;

  // Trial logic
  const now = new Date();
  const trialEnd = profile?.trial_end_date ? new Date(profile.trial_end_date) : null;
  const isOnTrial = !isSubscribed && !!trialEnd && trialEnd > now;
  const trialDaysLeft = isOnTrial ? Math.ceil((trialEnd!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const isPro = isSubscribed || isOnTrial;

  // Today's protein from shared store
  const proteinConsumed = todayLogs.reduce((s, l) => s + (l.protein_g || 0), 0);
  const proteinPct      = proteinGoal > 0 ? Math.min(proteinConsumed / proteinGoal, 1) : 0;

  // Weight target logic
  const weightTarget =
    bodyGoal === 'lose_weight' ? weight - 5 :
    bodyGoal === 'gain_muscle' ? weight + 5 :
    weight;
  const weightDelta  = Math.abs(weight - weightTarget);
  const weightLabel  =
    bodyGoal === 'lose_weight' ? `${weightDelta.toFixed(0)}kg to Target (${weightTarget.toFixed(0)}kg)` :
    bodyGoal === 'gain_muscle' ? `${weightDelta.toFixed(0)}kg to Target (${weightTarget.toFixed(0)}kg)` :
    'Maintaining';
  const weightPct = bodyGoal === 'maintain' ? 1 : 0.6; // approximate progress indicator

  const handleSignOut = async () => {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm('Are you sure you want to sign out?')
        : await new Promise<boolean>((resolve) =>
            Alert.alert('Sign out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Sign out', style: 'destructive', onPress: () => resolve(true) },
            ])
          );
    if (!confirmed) return;
    await signOut();
  };

  return (
    <View style={styles.root}>
      {/* ── Top Bar ── */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Ionicons name="menu-outline" size={24} color={C.primary} />
          <Text style={styles.brand}>Cal<Text style={styles.brandSnap}>Snap</Text></Text>
          <View style={styles.headerAvatar}>
            {profile?.avatar_url
              ? <Image source={{ uri: profile.avatar_url }} style={styles.headerAvatarImg} />
              : <View style={[styles.headerAvatarImg, { backgroundColor: C.outlineVar, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: C.primary, fontWeight: '700' }}>{(profile?.name ?? 'U')[0].toUpperCase()}</Text>
                </View>
            }
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Header ── */}
        <View style={styles.profileSection}>
          {/* Gradient ring avatar */}
          <LinearGradient
            colors={[C.primary, C.secondary]}
            style={styles.avatarRing}
            start={{ x: 0.1, y: 0.9 }}
            end={{ x: 0.9, y: 0.1 }}
          >
            <View style={styles.avatarInner}>
              {profile?.avatar_url
                ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
                : <View style={[styles.avatarImg, { backgroundColor: C.outlineVar, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: C.primary, fontSize: 32, fontWeight: '700' }}>{(profile?.name ?? 'U')[0].toUpperCase()}</Text>
                  </View>
              }
            </View>
          </LinearGradient>

          <Text style={styles.userName}>{profile?.name ?? '—'}</Text>

          {/* Badge */}
          <View style={isSubscribed ? styles.eliteBadge : isOnTrial ? styles.trialBadge : styles.freeBadge}>
            <Ionicons
              name={isSubscribed ? 'star' : isOnTrial ? 'timer-outline' : 'flash-outline'}
              size={12}
              color={isSubscribed ? C.primary : isOnTrial ? C.tertiary : C.outline}
            />
            <Text style={[styles.badgeText, { color: isSubscribed ? C.primary : isOnTrial ? C.tertiary : C.outline }]}>
              {isSubscribed ? 'Pro Member' : isOnTrial ? `Trial · ${trialDaysLeft}d left` : `${Math.min(scanCount, 5)} / 5 free scans`}
            </Text>
          </View>
        </View>

        {/* ── Active Goals Grid ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>ACTIVE GOALS</Text>
          <View style={styles.goalsGrid}>
            {/* Weight card */}
            <View style={styles.goalCard}>
              <View style={styles.goalCardTop}>
                <Text style={styles.goalCardLabel}>Weight</Text>
                <Ionicons name="scale-outline" size={20} color={C.primary} />
              </View>
              <View>
                <View style={styles.goalValueRow}>
                  <Text style={styles.goalBigNum}>{weight > 0 ? weight.toFixed(0) : '—'}</Text>
                  <Text style={styles.goalUnit}>kg</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${weightPct * 100}%`, backgroundColor: C.primary }]} />
                </View>
                <Text style={[styles.goalHint, { color: C.primary }]}>{weightLabel}</Text>
              </View>
            </View>

            {/* Protein card */}
            <View style={styles.goalCard}>
              <View style={styles.goalCardTop}>
                <Text style={styles.goalCardLabel}>Protein</Text>
                <Ionicons name="nutrition-outline" size={20} color={C.tertiary} />
              </View>
              <View>
                <View style={styles.goalValueRow}>
                  <Text style={styles.goalBigNum}>{Math.round(proteinConsumed)}</Text>
                  <Text style={styles.goalUnit}>/ {proteinGoal}g</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${proteinPct * 100}%`, backgroundColor: C.tertiary }]} />
                </View>
                <Text style={[styles.goalHint, { color: C.tertiary }]}>
                  {Math.round(proteinPct * 100)}% of Daily Goal
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Daily Steps ── */}
        <View style={styles.glassCard}>
          <View style={styles.stepsRow}>
            <View style={[styles.stepsIcon, { backgroundColor: C.primary + '22' }]}>
              <Ionicons name="walk-outline" size={22} color={C.primary} />
            </View>
            <View style={styles.stepsInfo}>
              <Text style={styles.stepsLabel}>Today's Steps</Text>
              <Text style={styles.stepsValue}>{steps > 0 ? steps.toLocaleString() : '—'}</Text>
            </View>
            <Text style={styles.stepsHint}>Auto-tracked</Text>
          </View>
        </View>

        {/* ── Subscription CTA ── */}
        {isPro && !isSubscribed && (
          // Trial active — show countdown + soft upgrade nudge
          <View style={[styles.ctaCard, { borderColor: C.tertiary + '40' }]}>
            <View style={styles.ctaGlow} pointerEvents="none" />
            <View style={styles.ctaContent}>
              <View style={styles.ctaText}>
                <Text style={[styles.ctaTitle, { color: C.tertiary }]}>⏳ Trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</Text>
                <Text style={styles.ctaSubtitle}>Enjoying CalSnap Pro? Lock in your access.</Text>
              </View>
              <TouchableOpacity
                style={[styles.ctaButton, { backgroundColor: C.tertiary }]}
                onPress={() => setShowPaywall(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaButtonText}>UPGRADE</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!isPro && (
          // Free tier — hard upgrade prompt
          <View style={styles.ctaCard}>
            <View style={styles.ctaGlow} pointerEvents="none" />
            <View style={styles.ctaContent}>
              <View style={styles.ctaText}>
                <Text style={styles.ctaTitle}>Upgrade to Pro</Text>
                <Text style={styles.ctaSubtitle} numberOfLines={2}>Unlock AI Scanning &amp; Advanced Macros</Text>
              </View>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => setShowPaywall(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaButtonText}>GO PRO</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isSubscribed && (
          <View style={[styles.ctaCard, { borderColor: C.primary + '40' }]}>
            <View style={styles.ctaContent}>
              <View style={styles.ctaText}>
                <Text style={[styles.ctaTitle, { color: C.primary }]}>✓ Pro Active</Text>
                <Text style={styles.ctaSubtitle}>
                  {profile?.subscription_end_date
                    ? `Renews ${new Date(profile.subscription_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : 'Unlimited scans enabled'}
                </Text>
              </View>
              <Ionicons name="star" size={28} color={C.primary} />
            </View>
          </View>
        )}

        {/* ── Settings ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>SETTINGS</Text>
          <View style={styles.settingsList}>
            {[
              { icon: 'person-outline',          label: 'Edit Profile',     color: C.onSurface },
              // { icon: 'sync-outline',            label: 'Health Connect',   color: C.onSurface },
              { icon: 'notifications-outline',   label: 'Notifications',    color: C.onSurface },
            ].map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.settingsRow, i > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }]}
                onPress={
                  item.label === 'Notifications' ? () => setShowNotifSettings(true) :
                  item.label === 'Edit Profile'  ? () => setShowEditProfile(true)  :
                  undefined
                }
                activeOpacity={0.7}
              >
                <View style={styles.settingsLeft}>
                  <Ionicons name={item.icon as any} size={22} color={C.outline} />
                  <Text style={[styles.settingsLabel, { color: item.color }]}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.outline} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }]}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <View style={styles.settingsLeft}>
                <Ionicons name="log-out-outline" size={22} color={C.error} />
                <Text style={[styles.settingsLabel, { color: C.error, fontWeight: '700' }]}>Sign Out</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />
      <NotificationSettingsModal visible={showNotifSettings} onDismiss={() => setShowNotifSettings(false)} />
      <EditProfileModal visible={showEditProfile} onDismiss={() => setShowEditProfile(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  /* Header */
  headerSafe: { zIndex: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(16,20,21,0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  brand: { fontSize: 22, fontWeight: '800', letterSpacing: 0.5, color: C.primary },
  brandSnap: { color: C.secondary },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: C.primaryCont,
  },
  headerAvatarImg: { width: 40, height: 40, borderRadius: 20 },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 28, paddingBottom: 40, gap: 28 },

  /* Profile section */
  profileSection: { alignItems: 'center', gap: 10 },
  avatarRing: { padding: 3, borderRadius: 56 },
  avatarInner: {
    width: 88, height: 88, borderRadius: 44,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: C.bg,
  },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  userName: { fontSize: 24, fontWeight: '700', color: C.onSurface },
  eliteBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(1,105,111,0.20)',
    borderWidth: 1, borderColor: C.primary + '50',
  },
  trialBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(192,193,255,0.12)',
    borderWidth: 1, borderColor: C.tertiary + '60',
  },
  freeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(136,147,147,0.12)',
    borderWidth: 1, borderColor: C.outlineVar,
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },

  /* Section block */
  sectionBlock: { paddingHorizontal: 20, gap: 12 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    textTransform: 'uppercase', color: C.outline,
  },

  /* Goals grid */
  goalsGrid: { flexDirection: 'row', gap: 12 },
  goalCard: {
    flex: 1,
    backgroundColor: C.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
    padding: 16,
    justifyContent: 'space-between',
    minHeight: 152,
  },
  goalCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalCardLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: C.outline },
  goalValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 8 },
  goalBigNum: { fontSize: 32, fontWeight: '800', color: C.onSurface, lineHeight: 38 },
  goalUnit: { fontSize: 14, color: C.outline },
  progressTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  goalHint: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 6, textTransform: 'uppercase' },


  /* Steps card */
  glassCard: {
    marginHorizontal: 20,
    backgroundColor: C.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
    padding: 16,
  },
  stepsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepsIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepsInfo: { flex: 1, gap: 2 },
  stepsLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: C.outline },
  stepsValue: { fontSize: 26, fontWeight: '800', color: C.onSurface },
  stepsHint: { fontSize: 10, color: C.outline, fontWeight: '600' },

  /* CTA card */
  ctaCard: {
    marginHorizontal: 20,
    backgroundColor: C.glass,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(133,211,218,0.20)',
    overflow: 'hidden',
    padding: 20,
  },
  ctaGlow: {
    position: 'absolute', top: -32, right: -32,
    width: 120, height: 120,
    backgroundColor: C.primary + '33',
    borderRadius: 60,
  },
  ctaContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 },
  ctaText: { flex: 1, gap: 3, marginRight: 12 },
  ctaTitle: { fontSize: 18, fontWeight: '700', color: C.primary },
  ctaSubtitle: { fontSize: 13, color: C.onSurfaceVar },
  ctaButton: {
    backgroundColor: C.secondaryCont,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaButtonText: {
    color: '#00363d',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  /* Settings list */
  settingsList: {
    backgroundColor: C.glass,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.glassBorder,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingsLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsLabel: { fontSize: 16, fontWeight: '500', color: C.onSurface },
});
