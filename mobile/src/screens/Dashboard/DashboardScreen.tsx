import React, { useEffect, useCallback } from 'react';
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
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore, FoodLog } from '../../store/foodLogStore';
import { CalorieRing } from '../../components/CalorieRing';
import { MacroBar } from '../../components/MacroBar';
import { MealSection } from '../../components/MealSection';
import { useTheme } from '../../hooks/useTheme';

const C = {
  bg:              '#101415',
  glass:           'rgba(15,23,42,0.80)',
  glassBorder:     'rgba(255,255,255,0.08)',
  primary:         '#85d3da',
  secondary:       '#bdf4ff',
  tertiary:        '#c0c1ff',
  onSurface:       '#e0e3e5',
  onSurfaceVar:    '#bec8c9',
  outline:         '#889393',
  outlineVar:      '#3f4949',
  surfaceLowest:   '#0b0f10',
  insightBg:       'rgba(1,105,111,0.18)',
  insightBorder:   'rgba(133,211,218,0.25)',
};

export function DashboardScreen() {
  const { profile, session } = useAuthStore();
  const { todayLogs, selectedDate, isLoading, fetchLogsForDate } = useFoodLogStore();
  const { theme } = useTheme();

  const loadLogs = useCallback(() => {
    if (session?.user.id) {
      fetchLogsForDate(session.user.id, selectedDate);
    }
  }, [session?.user.id, selectedDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

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

  const insightMsg = totals.protein < proteinGoal * 0.5
    ? `You're under protein targets today — consider adding a high-protein snack to hit your ${proteinGoal}g goal.`
    : `Great progress! You're on track with your nutrition goals. Keep it up!`;

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <LinearGradient
          colors={['rgba(16,20,21,1)', 'rgba(16,20,21,0.90)', 'rgba(16,20,21,0)']}
          style={styles.headerGrad}
        >
          <View style={styles.header}>
            {/* Avatar */}
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{(profile?.name ?? 'U')[0].toUpperCase()}</Text>
              </View>
            )}

            {/* Brand */}
            <Text style={styles.brand}>
              CAL<Text style={styles.brandSnap}>SNAP</Text>
            </Text>

            {/* Bell */}
            <TouchableOpacity style={styles.bellBtn}>
              <Ionicons name="notifications-outline" size={22} color={C.onSurfaceVar} />
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
      >
        {/* ── Calorie Ring Card ── */}
        <View style={styles.glassCard}>
          <CalorieRing consumed={totals.calories} goal={calorieGoal} />
        </View>

        {/* ── Macro Targets Card ── */}
        <View style={styles.glassCard}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="analytics-outline" size={16} color={C.primary} />
            <Text style={styles.cardTitle}>Macro Targets</Text>
          </View>
          <View style={styles.macroBars}>
            <MacroBar label="Protein"       current={totals.protein} goal={proteinGoal} color={C.primary}    unit="g" />
            <MacroBar label="Carbohydrates" current={totals.carbs}   goal={carbsGoal}   color={C.secondary}  unit="g" />
            <MacroBar label="Fat"           current={totals.fat}     goal={fatGoal}     color={C.tertiary}   unit="g" />
          </View>
        </View>

        {/* ── Nutri-Insight Card ── */}
        <View style={[styles.glassCard, { borderColor: C.insightBorder, backgroundColor: C.insightBg }]}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="sparkles-outline" size={16} color={C.primary} />
            <Text style={styles.cardTitle}>Nutri-Insight</Text>
          </View>
          <Text style={styles.insightText}>{insightMsg}</Text>
        </View>

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

  /* Scroll */
  scroll:        { flex: 1 },
  scrollContent: { paddingTop: 4, paddingBottom: 40, gap: 12 },

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

