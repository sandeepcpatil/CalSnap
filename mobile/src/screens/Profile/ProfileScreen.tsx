import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Image, Alert, Platform } from 'react-native';
import { Text, Button, TextInput, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { calculateGoals } from '../../utils/nutrition';
import { PaywallModal } from '../Paywall/PaywallModal';
import { useTheme } from '../../hooks/useTheme';
import { ThemeToggle } from '../../components/ThemeToggle';

const APP_VERSION = '1.0.0';

export function ProfileScreen() {
  const { profile, updateProfile, signOut } = useAuthStore();
  const { theme } = useTheme();
  const [editWeight, setEditWeight] = useState(String(profile?.weight_kg ?? ''));
  const [editHeight, setEditHeight] = useState(String(profile?.height_cm ?? ''));
  const [isSaving, setIsSaving] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const isSubscribed = profile?.is_subscribed ?? false;
  const scanCount = profile?.scan_count ?? 0;
  const freeScanLimit = 5;

  const handleSaveStats = async () => {
    const w = Number(editWeight);
    const h = Number(editHeight);
    if (w < 20 || w > 300 || h < 100 || h > 250) {
      Alert.alert('Invalid values', 'Please enter a valid weight (20–300 kg) and height (100–250 cm).');
      return;
    }

    setIsSaving(true);
    try {
      const updates: Partial<typeof profile> = { weight_kg: w, height_cm: h };

      // Recalculate goals if we have all data
      if (profile?.age && profile?.gender && profile?.activity_level && profile?.body_goal) {
        const { dailyCalorieGoal, dailyProteinGoal } = calculateGoals({
          weight_kg: w,
          height_cm: h,
          age: profile.age,
          gender: profile.gender,
          activity_level: profile.activity_level,
          body_goal: profile.body_goal,
        });
        updates.daily_calorie_goal = dailyCalorieGoal;
        updates.daily_protein_goal = dailyProteinGoal;
      }

      await updateProfile(updates as any);
      Alert.alert('Saved!', 'Your stats and goals have been updated.');
    } finally {
      setIsSaving(false);
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
    console.log('[ProfileScreen] Signing out...');
    await signOut();
    console.log('[ProfileScreen] Sign out complete.');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar + user info */}
        <View style={styles.userCard}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={[styles.avatar, { borderWidth: 2, borderColor: theme.primaryLight }]} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={styles.avatarInitial}>{(profile?.name ?? 'U')[0].toUpperCase()}</Text>
            </View>
          )}
          <Text variant="headlineSmall" style={[styles.userName, { color: theme.textPrimary }]}>{profile?.name ?? '—'}</Text>
          <Text variant="bodyMedium" style={styles.userEmail}>{profile?.email ?? '—'}</Text>

          {/* Subscription badge */}
          {isSubscribed ? (
            <View style={styles.proBadge}>
              <Text variant="labelSmall" style={styles.proBadgeText}>✓ Pro Member</Text>
            </View>
          ) : (
            <View style={styles.freeBadge}>
              <Text variant="labelSmall" style={styles.freeBadgeText}>
                {Math.min(scanCount, freeScanLimit)} / {freeScanLimit} free scans used
              </Text>
            </View>
          )}
        </View>

        {/* Goals */}
        <View style={styles.section}>
          <Text variant="titleSmall" style={styles.sectionTitle}>Your Goals</Text>
          <View style={styles.goalsRow}>
            <View style={[styles.goalCard, { borderColor: theme.primaryTint }]}>
              <Text variant="headlineSmall" style={[styles.goalValue, { color: theme.primary }]}>{profile?.daily_calorie_goal ?? '—'}</Text>
              <Text variant="labelSmall" style={styles.goalLabel}>kcal / day</Text>
            </View>
            <View style={[styles.goalCard, { borderColor: theme.primaryTint }]}>
              <Text variant="headlineSmall" style={[styles.goalValue, { color: theme.primary }]}>{profile?.daily_protein_goal ?? '—'}g</Text>
              <Text variant="labelSmall" style={styles.goalLabel}>protein / day</Text>
            </View>
          </View>
        </View>

        {/* Edit body stats */}
        <View style={styles.section}>
          <Text variant="titleSmall" style={styles.sectionTitle}>Body Stats</Text>
          <View style={styles.statsForm}>
            <TextInput
              label="Weight (kg)"
              value={editWeight}
              onChangeText={(v) => setEditWeight(v.replace(/[^0-9.]/g, ''))}
              mode="outlined"
              keyboardType="decimal-pad"
              outlineColor="#b0bec5"
              activeOutlineColor={theme.primary}
              style={styles.statsInput}
            />
            <TextInput
              label="Height (cm)"
              value={editHeight}
              onChangeText={(v) => setEditHeight(v.replace(/[^0-9.]/g, ''))}
              mode="outlined"
              keyboardType="decimal-pad"
              outlineColor="#b0bec5"
              activeOutlineColor={theme.primary}
              style={styles.statsInput}
            />
            <Button
              mode="contained"
              onPress={handleSaveStats}
              loading={isSaving}
              disabled={isSaving}
              style={styles.saveButton}
              buttonColor={theme.primary}
            >
              Save & Recalculate
            </Button>
          </View>
        </View>

        <Divider style={styles.divider} />

        {/* Subscription section */}
        <View style={styles.section}>
          <Text variant="titleSmall" style={styles.sectionTitle}>Subscription</Text>
          {isSubscribed ? (
            <View style={styles.subCard}>
              <Text variant="bodyMedium" style={styles.subStatus}>
                ✓ Active Pro · Renews {profile?.subscription_end_date
                  ? new Date(profile.subscription_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'}
              </Text>
            </View>
          ) : (
            <Button
              mode="contained"
              onPress={() => setShowPaywall(true)}
              style={styles.upgradeButton}
              buttonColor={theme.primary}
              icon="star"
            >
              Upgrade to Pro — ₹150/month
            </Button>
          )}
        </View>

        <Divider style={styles.divider} />

        {/* ── Appearance ── */}
        <View style={styles.section}>
          <Text variant="titleSmall" style={styles.sectionTitle}>Display Mode</Text>
          <ThemeToggle />
        </View>

        <Divider style={styles.divider} />

        {/* Links */}
        <View style={styles.section}>
          {[
            { label: '📄 Privacy Policy', onPress: () => {} },
            { label: '📋 Terms of Service', onPress: () => {} },
            { label: `ℹ️ Version ${APP_VERSION}`, onPress: () => {} },
          ].map((item) => (
            <Button key={item.label} mode="text" onPress={item.onPress} style={styles.linkButton} textColor="#546e7a">
              {item.label}
            </Button>
          ))}
        </View>

        <Button
          mode="outlined"
          onPress={handleSignOut}
          style={styles.signOutButton}
          textColor="#ef5350"
          icon="logout"
        >
          Sign Out
        </Button>
      </ScrollView>

      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40, gap: 4 },
  userCard: { alignItems: 'center', padding: 24, gap: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 4 },
  avatarInitial: { color: '#fff', fontSize: 32, fontWeight: '700' },
  userName: { fontWeight: '700' },
  userEmail: { color: '#78909c' },
  proBadge: { backgroundColor: '#e8f5e9', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginTop: 4 },
  proBadgeText: { color: '#2e7d32', fontWeight: '700' },
  freeBadge: { backgroundColor: '#fff3e0', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginTop: 4 },
  freeBadgeText: { color: '#e65100', fontWeight: '600' },
  section: { paddingHorizontal: 20, paddingVertical: 8, gap: 10 },
  sectionTitle: { color: '#90a4ae', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  goalsRow: { flexDirection: 'row', gap: 12 },
  goalCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  goalValue: { fontWeight: '800' },
  goalLabel: { color: '#90a4ae' },
  statsForm: { gap: 12 },
  statsInput: { backgroundColor: '#fff' },
  saveButton: { borderRadius: 12 },
  divider: { marginHorizontal: 20, marginVertical: 4 },
  subCard: { backgroundColor: '#e8f5e9', borderRadius: 12, padding: 14 },
  subStatus: { color: '#2e7d32', fontWeight: '600' },
  upgradeButton: { borderRadius: 12 },
  // Theme switcher
  themeRow: { flexDirection: 'row', gap: 12 },
  themeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  themeEmoji: { fontSize: 18 },
  themeName: { fontSize: 14, fontWeight: '700' },
  themeCheck: { fontSize: 12, color: '#fff', fontWeight: '800' },
  linkButton: { justifyContent: 'flex-start' },
  signOutButton: { marginHorizontal: 20, marginTop: 8, borderColor: '#ef5350', borderRadius: 12 },
});
