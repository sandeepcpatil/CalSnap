import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore, FoodLog } from '../../store/foodLogStore';
import { useWaterStore } from '../../store/waterStore';
import { CalorieRing } from '../../components/CalorieRing';
import { WaterCard } from '../../components/WaterCard';
import { MacroBar } from '../../components/MacroBar';
import { MacroDonut } from '../../components/MacroDonut';
import { MealSection } from '../../components/MealSection';
import { TrialBanner } from '../../components/TrialBanner';
import { AlertsModal } from '../../components/AlertsModal';
import { CoachFab, useHideOnScroll } from '../../components/CoachFab';
import { buildNutriInsight, macroCalorieSplit } from '../../utils/nutrition';
import { buildSmartAlerts, alertsSignature } from '../../utils/alerts';
import { useAlertsSeenStore } from '../../store/alertsSeenStore';
import { useTheme } from '../../hooks/useTheme';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import { useConfirmExit } from '../../hooks/useConfirmExit';
import { useNotificationStore } from '../../store/notificationStore';
import { useRecapStore } from '../../store/recapStore';
import type { MainTabParamList } from '../../navigation/MainTabNavigator';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { PaywallModal } from '../Paywall/PaywallModal';
import { ProGate } from '../../components/ProGate';
import { T } from '../../theme';

// Screen palette — derived from the shared design tokens so colours stay in
// sync app-wide (see theme/tokens.ts).
const C = {
  bg: T.bg,
  glass: T.surface,
  glassBorder: T.border,
  primary: T.primary,
  secondary: T.primary,
  tertiary: T.protein,
  onSurface: T.textPrimary,
  onSurfaceVar: T.textSecondary,
  outline: T.textMuted,
  outlineVar: T.border,
  surfaceLowest: T.bg,
  insightBg: T.primaryTint,
  insightBorder: T.border,
};

export function DashboardScreen() {
  const { profile, session } = useAuthStore();
  const { todayLogs, selectedDate, isLoading, fetchLogsForDate } = useFoodLogStore();
  const { theme } = useTheme();
  const { isSubscribed, isOnTrial, trialDaysLeft, paywallVisible, showPaywall, dismissPaywall } = useSubscriptionGate();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  // Water is a root-stack screen, not a tab, so it is reached through the parent.
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const [alertsOpen, setAlertsOpen] = useState(false);

  // Home is the root of the back stack, so a single stray press would otherwise
  // close the app outright.
  useConfirmExit();

  // Slides the floating Coach pill away while scrolling down through the log.
  const { hidden: fabHidden, onScroll } = useHideOnScroll();

  // Pull the weekly recap once so the bell can flag an unread review. The server
  // generates it at most once a week, so this is a cheap cached read after that.
  const recapUnread = useRecapStore((s) => (s.recap ? s.recap.week_start !== s.seenWeek : false));
  const fetchRecap = useRecapStore((s) => s.fetch);
  useEffect(() => {
    if (session?.access_token) fetchRecap(session.access_token);
  }, [session?.access_token, fetchRecap]);

  const loadLogs = useCallback(() => {
    if (session?.user.id) {
      fetchLogsForDate(session.user.id, selectedDate);
      // Water lives in its own table but shares this screen's refresh control —
      // pulling down must not leave the hydration card stale.
      useWaterStore.getState().fetchForDate(session.user.id, selectedDate);
    }
  }, [session?.user.id, selectedDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Re-arm the streak nudge whenever today's logs change. Home is the landing
  // screen, so this keeps the reminder accurate without a background job — and
  // it's the only place that reliably knows whether today has been logged.
  useEffect(() => {
    if (!session?.user.id) return;
    useNotificationStore.getState().refreshStreakReminder(todayLogs.length > 0);
  }, [session?.user.id, todayLogs.length]);

  const calorieGoal  = profile?.daily_calorie_goal ?? 2000;
  const proteinGoal  = profile?.daily_protein_goal ?? 80;
  const carbsGoal    = Math.round((calorieGoal * 0.50) / 4);
  const fatGoal      = Math.round((calorieGoal * 0.30) / 9);

  const totals = todayLogs.reduce(
    (acc, log) => ({
      calories: acc.calories + (log.calories   || 0),
      protein:  acc.protein  + (log.protein_g  || 0),
      carbs:    acc.carbs    + (log.carbs_g    || 0),
      fat:      acc.fat      + (log.fat_g      || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const byMealType = (type: FoodLog['meal_type']) =>
    todayLogs.filter((l) => l.meal_type === type);

  const insightMsg = buildNutriInsight(totals, { calorieGoal, proteinGoal });
  const macroSplit = macroCalorieSplit(totals.protein, totals.carbs, totals.fat);

  const mealsLogged = new Set(
    todayLogs.map((l) => l.meal_type).filter(Boolean) as string[],
  );
  const currentHour = new Date().getHours();
  const alerts = buildSmartAlerts({
    totals,
    goals: { calorieGoal, proteinGoal },
    mealsLogged,
    itemsLoggedToday: todayLogs.length,
    isOnTrial,
    trialDaysLeft,
    hour: currentHour,
  });

  // Bell dot: clears the moment the sheet is opened, and only re-appears when a
  // genuinely new/different alert shows up (see `alertsSignature`). Today's local
  // date keys the signature so a fresh day's alerts count as new.
  const todayKey = new Date().toISOString().slice(0, 10);
  const alertsSig = alertsSignature(alerts, todayKey);
  const alertsUnread = useAlertsSeenStore((s) => s.hasUnread(alertsSig));
  const markAlertsSeen = useAlertsSeenStore((s) => s.markSeen);
  const badgeCount = (alertsUnread ? alerts.length : 0) + (recapUnread ? 1 : 0);

  const openAlerts = () => {
    markAlertsSeen(alertsSig);
    setAlertsOpen(true);
  };

  const firstName = (profile?.name ?? '').trim().split(' ')[0] || 'there';
  const greeting =
    currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <LinearGradient
          colors={['rgba(12,17,18,1)', 'rgba(12,17,18,0.90)', 'rgba(12,17,18,0)']}
          style={styles.headerGrad}
        >
          <View style={styles.header}>
            {/* Avatar → Profile */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{(profile?.name ?? 'U')[0].toUpperCase()}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Brand */}
            <Text style={styles.brand}>
              CAL<Text style={styles.brandSnap}>SNAP</Text>
            </Text>

            {/* Bell → Alerts */}
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={openAlerts}
              accessibilityRole="button"
              accessibilityLabel="Open alerts"
            >
              <Ionicons name="notifications-outline" size={22} color={C.onSurfaceVar} />
              {badgeCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{badgeCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadLogs} tintColor={C.primary} />
        }
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* ── Personalized greeting ── */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingSmall}>{greeting},</Text>
          <Text style={styles.greetingName}>{firstName}</Text>
        </View>

        {/* ── Trial countdown (only during the 7-day trial) ── */}
        <TrialBanner onPress={showPaywall} />

        {/* ── Calorie Ring Card ── */}
        <View style={styles.glassCard}>
          <CalorieRing consumed={totals.calories} goal={calorieGoal} />
        </View>

        {/* ── Water ── high on the page on purpose: it's logged more often than
            meals, and burying it behind the hub would be too slow. ── */}
        <WaterCard onOpen={() => rootNavigation?.navigate('Water')} />

        {/* Coach lives in a floating pill (see CoachFab below) rather than a card
            here — a card scrolls away exactly when a question occurs to you. */}

        {/* ── Macro Targets Card (Pro) ── */}
        <ProGate isSubscribed={isSubscribed} onUpgrade={showPaywall} label="Macro Breakdown" borderRadius={20}>
          <View style={styles.glassCard}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="analytics-outline" size={16} color={C.primary} />
              <Text style={styles.cardTitle}>Macro Targets</Text>
            </View>
            <MacroDonut protein={totals.protein} carbs={totals.carbs} fat={totals.fat} showLegend={false} />
            <View style={styles.macroDivider} />
            <View style={styles.macroBars}>
              <MacroBar label="Protein"       current={totals.protein} goal={proteinGoal} color={T.protein} unit="g" percent={macroSplit.proteinPct} />
              <MacroBar label="Carbohydrates" current={totals.carbs}   goal={carbsGoal}   color={T.carbs}   unit="g" percent={macroSplit.carbsPct} />
              <MacroBar label="Fat"           current={totals.fat}     goal={fatGoal}     color={T.fat}     unit="g" percent={macroSplit.fatPct} />
            </View>
          </View>
        </ProGate>

        {/* ── Nutri-Insight Card (Pro) ── */}
        <ProGate isSubscribed={isSubscribed} onUpgrade={showPaywall} label="AI Nutri-Insight" borderRadius={20}>
          <View style={[styles.glassCard, { borderColor: C.insightBorder, backgroundColor: C.insightBg }]}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="sparkles-outline" size={16} color={C.primary} />
              <Text style={styles.cardTitle}>Nutri-Insight</Text>
            </View>
            <Text style={styles.insightText}>{insightMsg}</Text>
          </View>
        </ProGate>

        {/* ── Today's Log heading ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Log</Text>
          <Text style={styles.sectionSub}>{todayLogs.length} items</Text>
        </View>

        {/* ── Meal sections ── */}
        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => (
          <MealSection key={meal} mealType={meal} logs={byMealType(meal)} />
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      <CoachFab hidden={fabHidden} />

      <PaywallModal visible={paywallVisible} onDismiss={dismissPaywall} />
      <AlertsModal visible={alertsOpen} onClose={() => setAlertsOpen(false)} alerts={alerts} onUpgrade={showPaywall} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  /* Header */
  headerSafe:  { zIndex: 10 },
  headerGrad:  { paddingBottom: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.primary + '55',
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.outlineVar,
    borderWidth: 2,
    borderColor: C.primary + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: C.primary, fontSize: 16, fontWeight: '700' },
  brand: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    color: C.onSurface,
  },
  brandSnap: { color: C.secondary },
  bellBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { fontSize: 11, fontWeight: '800', color: T.textOnPrimary },

  /* Scroll */
  scroll:        { flex: 1 },
  scrollContent: { paddingTop: 4, paddingBottom: 40, gap: 12 },

  /* Greeting */
  greetingBlock: { paddingHorizontal: 20, paddingTop: 2 },
  greetingSmall: { fontSize: 13, fontWeight: '600', color: C.onSurfaceVar, letterSpacing: 0.3 },
  greetingName:  { fontSize: 24, fontWeight: '800', color: C.onSurface, letterSpacing: -0.4 },

  /* Glass card */
  glassCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    overflow: 'hidden',
    padding: 20,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.primary,
  },
  macroBars: { gap: 16 },
  macroDivider: { height: 1, backgroundColor: T.divider, marginVertical: 18 },

  /* Insight */
  insightText: {
    color: C.onSurfaceVar,
    fontSize: 14,
    lineHeight: 22,
  },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.onSurface,
    letterSpacing: 0.3,
  },
  sectionSub: {
    fontSize: 12,
    fontWeight: '600',
    color: C.outline,
  },
});

