import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Platform,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { SUPPORT_EMAIL } from '../../content/legal';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { useWeightStore } from '../../store/weightStore';
import { toast } from '../../store/toastStore';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import { restorePurchases, isPurchasesReady } from '../../services/purchases';
import { deleteAccount } from '../../services/account';
import { toSeries, formatDeltaKg } from '../../utils/weightStats';
import { shortDate, weightDeltaColor } from '../../components/WeightChart';
import { PaywallModal } from '../Paywall/PaywallModal';
import { NotificationSettingsModal } from '../../components/NotificationSettingsModal';
import { EditProfileModal } from '../../components/EditProfileModal';
import { FeedbackModal } from '../../components/FeedbackModal';
import { LegalModal, type LegalDoc } from '../../components/LegalModal';
import { T, spacing, radius, HIT_TARGET, tabularNums } from '../../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface RowDef {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
  busy?: boolean;
}

const MANAGE_SUBSCRIPTION_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';

const DELETE_ACCOUNT_COPY =
  "This permanently deletes your account, meals, weight and water history. This can't be undone.";

const FOUR_WEEKS_MS = 28 * 86_400_000;

/** One card of settings rows with an optional sentence-case heading. */
function SettingsGroup({ title, rows }: { title?: string; rows: RowDef[] }) {
  return (
    <View style={styles.sectionBlock}>
      {title ? <Text style={styles.sectionLabel}>{title}</Text> : null}
      <View style={styles.settingsList}>
        {rows.map((row, i) => {
          const danger = row.tone === 'danger';
          return (
            <TouchableOpacity
              key={row.key}
              style={[styles.settingsRow, i > 0 && styles.settingsRowDivider]}
              onPress={row.onPress}
              disabled={row.busy}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={row.label}
              accessibilityState={{ busy: row.busy, disabled: row.busy }}
            >
              <View style={styles.settingsLeft}>
                <Ionicons name={row.icon} size={22} color={danger ? T.error : T.textMuted} />
                <Text style={[styles.settingsLabel, danger && styles.settingsLabelDanger]}>{row.label}</Text>
              </View>
              {row.busy ? (
                <ActivityIndicator size={16} color={danger ? T.error : T.primary} />
              ) : danger ? null : (
                <Ionicons name="chevron-forward" size={18} color={T.textMuted} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const { session, profile, signOut, fetchProfile } = useAuthStore();
  const { todayLogs } = useFoodLogStore();
  const weightLogs = useWeightStore((s) => s.logs);
  const fetchWeight = useWeightStore((s) => s.fetch);
  // Weight lives on the root stack (over the tabs), reached through the parent.
  const rootNav = useNavigation().getParent<NativeStackNavigationProp<RootStackParamList>>();
  const [showPaywall, setShowPaywall] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Single source of truth for subscription/trial/scan state (same hook the
  // rest of the app uses — keeps Profile from drifting out of sync).
  const { isOnTrial, trialDaysLeft, scansRemaining } = useSubscriptionGate();

  const userId = session?.user.id;
  const isSubscribed = profile?.is_subscribed ?? false;
  const weight = profile?.weight_kg ?? 0;
  const proteinGoal = profile?.daily_protein_goal ?? 80;
  const bodyGoal = profile?.body_goal ?? null;

  useEffect(() => { if (userId) fetchWeight(userId); }, [userId, fetchWeight]);

  // Today's protein from shared store
  const proteinConsumed = todayLogs.reduce((s, l) => s + (l.protein_g || 0), 0);
  const proteinPct = proteinGoal > 0 ? Math.min(proteinConsumed / proteinGoal, 1) : 0;

  // Real weight context instead of a decorative bar: the 4-week change when
  // there is enough data, otherwise the last weigh-in date.
  const weightSeries = useMemo(() => toSeries(weightLogs), [weightLogs]);
  const weightMeta = useMemo(() => {
    if (weightSeries.length === 0) return { text: 'No weigh-ins yet', color: T.textMuted };
    const last = weightSeries[weightSeries.length - 1];
    const cutoff = new Date(Date.now() - FOUR_WEEKS_MS).toISOString().slice(0, 10);
    const recentWindow = weightSeries.filter((p) => p.date >= cutoff);
    if (recentWindow.length >= 2) {
      const delta = Math.round((last.kg - recentWindow[0].kg) * 10) / 10;
      return { text: `${formatDeltaKg(delta)} in 4 weeks`, color: weightDeltaColor(delta, bodyGoal) };
    }
    return { text: `Last weigh-in ${shortDate(last.date)}`, color: T.textSecondary };
  }, [weightSeries, bodyGoal]);

  const trialDays = trialDaysLeft ?? 0;
  const badgeText = isSubscribed
    ? 'Pro member'
    : isOnTrial
      ? `Trial · ${trialDays} day${trialDays !== 1 ? 's' : ''} left`
      : `Free · ${scansRemaining} scan${scansRemaining !== 1 ? 's' : ''} left today`;

  const activeUntil = profile?.subscription_end_date
    ? new Date(profile.subscription_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const handleContactSupport = async () => {
    const version = Constants.expoConfig?.version ?? '1.0.0';
    const subject = `CalVue support (v${version})`;
    // Pre-fill context so support has what they need without asking.
    const body = [
      '',
      '',
      '— — — — — — — — — —',
      'The details below help us assist you (feel free to edit):',
      `App version: ${version}`,
      `Platform: ${Platform.OS} ${Platform.Version}`,
      `Account: ${profile?.email ?? 'unknown'}`,
    ].join('\n');
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error('no mail app');
      await Linking.openURL(url);
    } catch {
      // No mail app configured — show the address so the user can still reach us.
      Alert.alert('Contact support', `Email us at ${SUPPORT_EMAIL}`);
    }
  };

  const handleManageSubscription = async () => {
    try {
      await Linking.openURL(MANAGE_SUBSCRIPTION_URL);
    } catch (err) {
      console.warn('[profile] open subscriptions failed', err);
      toast("Couldn't open the store. Manage your subscription from your store account.");
    }
  };

  const handleRestore = async () => {
    if (restoring) return;
    if (!isPurchasesReady()) {
      toast('Purchases are unavailable on this device.');
      return;
    }
    setRestoring(true);
    try {
      const pro = await restorePurchases();
      if (pro) {
        await fetchProfile();
        toast('Purchases restored. Pro is active.');
      } else {
        toast('No previous purchases found for this account.');
      }
    } catch (err) {
      console.warn('[profile] restore failed', err);
      toast("Couldn't restore purchases. Try again later.");
    } finally {
      setRestoring(false);
    }
  };

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

  const handleDeleteAccount = () => {
    if (deleting) return;
    const run = async () => {
      const token = session?.access_token;
      if (!token) {
        Alert.alert("Couldn't delete account", 'Sign in again and try once more.');
        return;
      }
      setDeleting(true);
      try {
        await deleteAccount(token);
        await signOut();
      } catch (err) {
        console.warn('[profile] delete account failed', err);
        setDeleting(false);
        Alert.alert(
          "Couldn't delete account",
          'Check your connection and try again. If it keeps failing, contact support.',
        );
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(DELETE_ACCOUNT_COPY)) void run();
      return;
    }
    Alert.alert('Delete account?', DELETE_ACCOUNT_COPY, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void run() },
    ]);
  };

  const accountRows: RowDef[] = [
    { key: 'edit', icon: 'person-outline', label: 'Edit profile', onPress: () => setShowEditProfile(true) },
    // Beta-gated: hidden entirely unless profiles.chat_beta is on.
    ...(profile?.chat_beta
      ? [{ key: 'coach', icon: 'chatbubbles-outline' as IconName, label: 'Nutrition coach (beta)', onPress: () => rootNav?.navigate('Coach') }]
      : []),
    { key: 'notifications', icon: 'notifications-outline', label: 'Notifications', onPress: () => setShowNotifSettings(true) },
    { key: 'manage', icon: 'card-outline', label: 'Manage subscription', onPress: handleManageSubscription },
    { key: 'restore', icon: 'refresh-outline', label: 'Restore purchases', onPress: handleRestore, busy: restoring },
  ];
  const supportRows: RowDef[] = [
    { key: 'feedback', icon: 'megaphone-outline', label: 'Send feedback', onPress: () => setShowFeedback(true) },
    { key: 'contact', icon: 'chatbubble-ellipses-outline', label: 'Contact support', onPress: handleContactSupport },
  ];
  const aboutRows: RowDef[] = [
    { key: 'privacy', icon: 'shield-checkmark-outline', label: 'Privacy policy', onPress: () => setLegalDoc('privacy') },
    { key: 'terms', icon: 'document-text-outline', label: 'Terms of service', onPress: () => setLegalDoc('terms') },
  ];
  const dangerRows: RowDef[] = [
    { key: 'signout', icon: 'log-out-outline', label: 'Sign out', onPress: handleSignOut, tone: 'danger' },
    { key: 'delete', icon: 'trash-outline', label: 'Delete account', onPress: handleDeleteAccount, tone: 'danger', busy: deleting },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.brand}>CalVue</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile header ── */}
        <View style={styles.profileSection}>
          <LinearGradient
            colors={[T.ringFrom, T.ringTo]}
            style={styles.avatarRing}
            start={{ x: 0.1, y: 0.9 }}
            end={{ x: 0.9, y: 0.1 }}
          >
            <View style={styles.avatarInner}>
              {profile?.avatar_url
                ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} accessibilityIgnoresInvertColors />
                : <View style={[styles.avatarImg, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>{(profile?.name ?? 'U')[0].toUpperCase()}</Text>
                  </View>
              }
            </View>
          </LinearGradient>

          <Text style={styles.userName}>{profile?.name ?? '—'}</Text>

          <View style={[styles.badge, isSubscribed && styles.badgePro]}>
            <Ionicons
              name={isSubscribed ? 'star' : isOnTrial ? 'timer-outline' : 'flash-outline'}
              size={13}
              color={isSubscribed ? T.primary : T.textSecondary}
            />
            <Text style={[styles.badgeText, isSubscribed && { color: T.primary }]}>{badgeText}</Text>
          </View>
        </View>

        {/* ── Active goals ── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>Active goals</Text>
          <View style={styles.goalsGrid}>
            <TouchableOpacity
              style={styles.goalCard}
              onPress={() => rootNav?.navigate('Weight')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Weight ${weight > 0 ? `${weight.toFixed(1)} kilograms` : 'not set'}. ${weightMeta.text}. Open weight tracking.`}
            >
              <View style={styles.goalCardTop}>
                <Text style={styles.goalCardLabel}>Weight</Text>
                <Ionicons name="scale-outline" size={20} color={T.primary} />
              </View>
              <View>
                <View style={styles.goalValueRow}>
                  <Text style={styles.goalBigNum}>{weight > 0 ? weight.toFixed(1) : '—'}</Text>
                  <Text style={styles.goalUnit}>kg</Text>
                </View>
                <Text style={[styles.goalMeta, { color: weightMeta.color }]} numberOfLines={1}>{weightMeta.text}</Text>
                <View style={styles.goalHintRow}>
                  <Text style={styles.goalHint}>Track over time</Text>
                  <Ionicons name="chevron-forward" size={13} color={T.primary} />
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.goalCard} accessibilityLabel={`Protein ${Math.round(proteinConsumed)} of ${proteinGoal} grams today`}>
              <View style={styles.goalCardTop}>
                <Text style={styles.goalCardLabel}>Protein</Text>
                <Ionicons name="nutrition-outline" size={20} color={T.protein} />
              </View>
              <View>
                <View style={styles.goalValueRow}>
                  <Text style={styles.goalBigNum}>{Math.round(proteinConsumed)}</Text>
                  <Text style={styles.goalUnit}>/ {proteinGoal} g</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${proteinPct * 100}%`, backgroundColor: T.protein }]} />
                </View>
                <Text style={[styles.goalMeta, { color: T.textSecondary }]}>
                  {Math.round(proteinPct * 100)}% of today's goal
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Pro status ── */}
        {isSubscribed ? (
          <View style={styles.proCard}>
            <View style={styles.proIconWell}>
              <Ionicons name="star" size={20} color={T.primary} />
            </View>
            <View style={styles.proText}>
              <Text style={styles.proTitle}>Pro is active</Text>
              <Text style={styles.proSub}>{activeUntil ? `Active until ${activeUntil}` : 'Pro is active'}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.proCard}>
            <View style={styles.proText}>
              <Text style={styles.proTitle}>
                {isOnTrial ? `Trial ends in ${trialDays} day${trialDays !== 1 ? 's' : ''}` : 'Upgrade to Pro'}
              </Text>
              <Text style={styles.proSub}>
                {isOnTrial
                  ? 'Keep your daily AI scans and full history after the trial.'
                  : 'Up to 20 AI scans a day, full history and export.'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.proBtn}
              onPress={() => setShowPaywall(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={styles.proBtnText}>{isOnTrial ? 'Upgrade' : 'Go Pro'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Settings ── */}
        <SettingsGroup title="Account" rows={accountRows} />
        <SettingsGroup title="Support" rows={supportRows} />
        <SettingsGroup title="About" rows={aboutRows} />
        <SettingsGroup rows={dangerRows} />

        <Text style={styles.versionText}>
          CalVue v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
        <View style={{ height: 80 }} />
      </ScrollView>

      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />
      <NotificationSettingsModal visible={showNotifSettings} onDismiss={() => setShowNotifSettings(false)} />
      <EditProfileModal visible={showEditProfile} onDismiss={() => setShowEditProfile(false)} />
      <FeedbackModal visible={showFeedback} onDismiss={() => setShowFeedback(false)} />
      <LegalModal visible={legalDoc !== null} doc={legalDoc ?? 'terms'} onClose={() => setLegalDoc(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  /* Header */
  headerSafe: { zIndex: 10 },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: T.bg,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  brand: { fontSize: 22, fontWeight: '800', letterSpacing: 0.5, color: T.primary },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { paddingTop: spacing['2xl'], paddingBottom: spacing['2xl'], gap: spacing['2xl'] },

  /* Profile section */
  profileSection: { alignItems: 'center', gap: spacing.sm },
  avatarRing: { padding: 3, borderRadius: radius.pill },
  avatarInner: {
    width: 88, height: 88, borderRadius: 44,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: T.bg,
  },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: { backgroundColor: T.surface2, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: T.primary, fontSize: 32, fontWeight: '700' },
  userName: { fontSize: 24, fontWeight: '700', color: T.textPrimary },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: T.surface2,
    borderWidth: 1, borderColor: T.border,
  },
  badgePro: { backgroundColor: T.primaryTint, borderColor: T.primaryBorder },
  badgeText: { fontSize: 13, fontWeight: '700', color: T.textSecondary },

  /* Section block */
  sectionBlock: { paddingHorizontal: spacing.xl, gap: spacing.md },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: T.textMuted },

  /* Goals grid */
  goalsGrid: { flexDirection: 'row', gap: spacing.md },
  goalCard: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: T.border,
    padding: spacing.lg,
    justifyContent: 'space-between',
    minHeight: 152,
  },
  goalCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalCardLabel: { fontSize: 13, fontWeight: '700', color: T.textMuted },
  goalValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: spacing.sm },
  goalBigNum: { fontSize: 32, fontWeight: '800', color: T.textPrimary, lineHeight: 38, ...tabularNums },
  goalUnit: { fontSize: 14, color: T.textMuted, fontWeight: '600' },
  goalMeta: { fontSize: 13, fontWeight: '600', marginTop: 6, ...tabularNums },
  progressTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: T.border,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  goalHintRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  goalHint: { fontSize: 12, fontWeight: '700', color: T.primary },

  /* Pro card */
  proCard: {
    marginHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: T.primaryBorder,
    padding: spacing.xl,
  },
  proIconWell: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.primaryTint,
  },
  proText: { flex: 1, gap: 3 },
  proTitle: { fontSize: 17, fontWeight: '700', color: T.textPrimary },
  proSub: { fontSize: 13, lineHeight: 18, color: T.textSecondary },
  proBtn: {
    backgroundColor: T.primary,
    paddingHorizontal: spacing.lg,
    minHeight: HIT_TARGET,
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  proBtnText: { color: T.textOnPrimary, fontSize: 14, fontWeight: '800' },

  /* Settings list */
  settingsList: {
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: HIT_TARGET + spacing.sm,
  },
  settingsRowDivider: { borderTopWidth: 1, borderTopColor: T.divider },
  settingsLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  settingsLabel: { fontSize: 16, fontWeight: '500', color: T.textPrimary },
  settingsLabelDanger: { color: T.error, fontWeight: '700' },

  versionText: { textAlign: 'center', fontSize: 12, color: T.textMuted, fontWeight: '600' },
});
