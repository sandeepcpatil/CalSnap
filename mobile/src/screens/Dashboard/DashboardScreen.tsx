import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
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
import { CoachFab, useHideOnScroll, COACH_FAB_CLEARANCE } from '../../components/CoachFab';
import { buildNutriInsight, macroCalorieSplit } from '../../utils/nutrition';
import { buildSmartAlerts, alertsSignature } from '../../utils/alerts';
import { useAlertsSeenStore } from '../../store/alertsSeenStore';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import { useConfirmExit } from '../../hooks/useConfirmExit';
import { useNotificationStore } from '../../store/notificationStore';
import { useRecapStore } from '../../store/recapStore';
import type { MainTabParamList } from '../../navigation/MainTabNavigator';
import { openLogHub } from '../../store/logHubStore';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { PaywallModal } from '../Paywall/PaywallModal';
import { ProGate } from '../../components/ProGate';
import { T, spacing, radius, type, HIT_TARGET, withAlpha, tabularNums } from '../../theme';

export function DashboardScreen() {
  const { profile, session } = useAuthStore();
  const { todayLogs, selectedDate, isLoading, hasLoaded, error, fetchLogsForDate } = useFoodLogStore();
  const { isSubscribed, isOnTrial, trialDaysLeft, paywallVisible, showPaywall, dismissPaywall } = useSubscriptionGate();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  // Water is a root-stack screen, not a tab, so it is reached through the parent.
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const [alertsOpen, setAlertsOpen] = useState(false);
  // Only a pull-to-refresh spins the control; background fetches stay silent.
  const [refreshing, setRefreshing] = useState(false);

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

  const loadLogs = useCallback(async () => {
    if (session?.user.id) {
      // Water lives in its own table but shares this screen's refresh control —
      // pulling down must not leave the hydration card stale.
      await Promise.all([
        fetchLogsForDate(session.user.id, selectedDate),
        useWaterStore.getState().fetchForDate(session.user.id, selectedDate),
      ]);
    }
  }, [session?.user.id, selectedDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadLogs();
    } finally {
      setRefreshing(false);
    }
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

  const byMealType = (mealType: FoodLog['meal_type']) =>
    todayLogs.filter((l) => l.meal_type === mealType);

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

  // No cache, first fetch still in flight: show a placeholder ring rather than
  // the full goal masquerading as "remaining".
  const firstLoad = !hasLoaded && isLoading;
  const isEmptyDay = hasLoaded && todayLogs.length === 0;
  const itemCount = `${todayLogs.length} ${todayLogs.length === 1 ? 'item' : 'items'}`;

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <LinearGradient
          colors={[withAlpha(T.bg, 1), withAlpha(T.bg, 0.9), withAlpha(T.bg, 0)]}
          style={styles.headerGrad}
        >
          <View style={styles.header}>
            {/* Wordmark. The Profile tab already exists, so the old avatar
                shortcut here was a duplicate route and has gone. */}
            <Text style={styles.brand} accessibilityRole="header">
              Cal<Text style={styles.brandAccent}>Vue</Text>
            </Text>

            {/* Bell → Alerts */}
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={openAlerts}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={badgeCount > 0 ? `Open alerts, ${badgeCount} new` : 'Open alerts'}
            >
              <Ionicons name="notifications-outline" size={22} color={T.textSecondary} />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />
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

        {/* ── Quiet inline note when the last refresh failed ── */}
        {error && (
          <View style={styles.noticeRow} accessibilityLiveRegion="polite">
            <Ionicons name="cloud-offline-outline" size={16} color={T.textMuted} />
            <Text style={styles.noticeText}>{error}</Text>
          </View>
        )}

        {/* ── Calorie ring ── */}
        <View style={styles.card}>
          <CalorieRing consumed={totals.calories} goal={calorieGoal} loading={firstLoad} />

          {isEmptyDay && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Nothing logged yet today.</Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={openLogHub}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Log your first meal"
              >
                <Ionicons name="add" size={20} color={T.textOnPrimary} />
                <Text style={styles.primaryBtnText}>Log your first meal</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Water ── high on the page on purpose: it's logged more often than
            meals, and burying it behind the hub would be too slow. ── */}
        <WaterCard onOpen={() => rootNavigation?.navigate('Water')} />

        {/* ── Today's log ── the diary comes before the Pro cards so a free
            user is not scrolling past two locked panels to reach it. ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's log</Text>
          <Text style={styles.sectionSub}>{itemCount}</Text>
        </View>

        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => (
          <MealSection key={meal} mealType={meal} logs={byMealType(meal)} />
        ))}

        {/* ── Pro: one gate over both analysis cards, not a badge on each ── */}
        <ProGate isSubscribed={isSubscribed} onUpgrade={showPaywall} label="Macros and insight" borderRadius={radius.lg}>
          <View style={styles.proStack}>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="pie-chart-outline" size={18} color={T.textSecondary} />
                <Text style={styles.cardTitle}>Macros</Text>
              </View>
              <MacroDonut protein={totals.protein} carbs={totals.carbs} fat={totals.fat} showLegend={false} />
              <View style={styles.macroDivider} />
              <View style={styles.macroBars}>
                <MacroBar label="Protein" current={totals.protein} goal={proteinGoal} color={T.protein} unit="g" percent={macroSplit.proteinPct} />
                <MacroBar label="Carbs"   current={totals.carbs}   goal={carbsGoal}   color={T.carbs}   unit="g" percent={macroSplit.carbsPct} />
                <MacroBar label="Fat"     current={totals.fat}     goal={fatGoal}     color={T.fat}     unit="g" percent={macroSplit.fatPct} />
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="bulb-outline" size={18} color={T.textSecondary} />
                <Text style={styles.cardTitle}>Insight</Text>
              </View>
              <Text style={styles.insightText}>{insightMsg}</Text>
            </View>
          </View>
        </ProGate>

        {/* Coach lives in a floating pill (see CoachFab below) rather than a card
            here — a card scrolls away exactly when a question occurs to you. */}
      </ScrollView>

      <CoachFab hidden={fabHidden} />

      <PaywallModal visible={paywallVisible} onDismiss={dismissPaywall} />
      <AlertsModal visible={alertsOpen} onClose={() => setAlertsOpen(false)} alerts={alerts} onUpgrade={showPaywall} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  /* Header */
  headerSafe:  { zIndex: 10 },
  headerGrad:  { paddingBottom: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    minHeight: HIT_TARGET + spacing.xs,
  },
  brand: { ...type.titleSm, fontWeight: '800', color: T.textPrimary },
  brandAccent: { color: T.primary },
  bellBtn: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    // Optically right-align the glyph with the card edge below.
    marginRight: -spacing.md,
  },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { ...type.bodySm, fontSize: 12, fontWeight: '800', color: T.textOnPrimary, ...tabularNums },

  /* Scroll */
  scroll:        { flex: 1 },
  // The tail clearance keeps the last row's kcal column out from under the
  // floating Coach pill.
  scrollContent: { paddingTop: spacing.xs, paddingBottom: COACH_FAB_CLEARANCE, gap: spacing.md },

  /* Greeting */
  greetingBlock: { paddingHorizontal: spacing.xl, paddingTop: 2 },
  greetingSmall: { ...type.bodySm, fontWeight: '600', color: T.textSecondary },
  greetingName:  { ...type.headline, fontSize: 24, lineHeight: 30, color: T.textPrimary },

  /* Inline notice */
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  noticeText: { ...type.bodySm, color: T.textMuted },

  /* Card */
  card: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    padding: spacing.xl,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
    marginBottom: spacing.lg,
  },
  cardTitle: { ...type.body, fontWeight: '600', color: T.textSecondary },
  proStack: { gap: spacing.md },
  macroBars: { gap: spacing.lg },
  macroDivider: { height: 1, backgroundColor: T.divider, marginVertical: 18 },

  /* Empty day */
  emptyState: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  emptyTitle: { ...type.body, color: T.textSecondary, textAlign: 'center' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm - 2,
    minHeight: 48,
    paddingHorizontal: spacing['2xl'],
    borderRadius: radius.md,
    backgroundColor: T.primary,
    alignSelf: 'stretch',
  },
  primaryBtnText: { ...type.body, fontWeight: '700', color: T.textOnPrimary },

  /* Insight */
  insightText: { ...type.body, color: T.textPrimary },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xs,
  },
  sectionTitle: { ...type.title, fontSize: 18, lineHeight: 24, color: T.textPrimary },
  sectionSub: { ...type.bodySm, fontWeight: '600', color: T.textMuted, ...tabularNums },
});
