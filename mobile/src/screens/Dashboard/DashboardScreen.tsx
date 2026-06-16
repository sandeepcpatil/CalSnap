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
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore, FoodLog } from '../../store/foodLogStore';
import { CalorieRing } from '../../components/CalorieRing';
import { MacroBar } from '../../components/MacroBar';
import { MealSection } from '../../components/MealSection';
import { WeeklyChart } from '../../components/WeeklyChart';
import { DateSelector } from '../../components/DateSelector';
import { useAppTheme } from '../../context/ThemeContext';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardScreen() {
  const { profile, session } = useAuthStore();
  const { todayLogs, selectedDate, isLoading, setSelectedDate, fetchLogsForDate } = useFoodLogStore();
  const { theme } = useAppTheme();

  const loadLogs = useCallback(() => {
    if (session?.user.id) {
      fetchLogsForDate(session.user.id, selectedDate);
    }
  }, [session?.user.id, selectedDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const calorieGoal = profile?.daily_calorie_goal ?? 2000;
  const proteinGoal = profile?.daily_protein_goal ?? 80;

  const totals = todayLogs.reduce(
    (acc, log) => ({
      calories: acc.calories + (log.calories || 0),
      protein: acc.protein + (log.protein_g || 0),
      carbs: acc.carbs + (log.carbs_g || 0),
      fat: acc.fat + (log.fat_g || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const byMealType = (type: FoodLog['meal_type']) =>
    todayLogs.filter((l) => l.meal_type === type);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Header */}
      <SafeAreaView style={[styles.headerSafe, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={[styles.avatar, { borderColor: theme.primaryLight }]}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.primaryUltraLight, borderColor: theme.primaryLight }]}>
                <Text style={[styles.avatarInitial, { color: theme.primary }]}>
                  {(profile?.name ?? 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={[styles.greeting, { color: theme.onSurfaceVariant }]}>{getGreeting()},</Text>
              <Text style={[styles.userName, { color: theme.primary }]}>{profile?.name ?? 'there'}</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.bellBtn, { backgroundColor: theme.surfaceTrack }]}>
            <Ionicons name="notifications-outline" size={22} color={theme.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadLogs} tintColor={theme.primary} />}
      >
        {/* Date selector */}
        <DateSelector
          selectedDate={selectedDate}
          onDateChange={(date) => setSelectedDate(date)}
        />

        {/* Calorie Ring */}
        <CalorieRing consumed={totals.calories} goal={calorieGoal} />

        {/* Macro bars */}
        <View style={styles.macrosCard}>
          <Text style={styles.macrosTitle}>Today's Macros</Text>
          <MacroBar label="Protein" current={totals.protein} goal={proteinGoal} color={theme.protein} unit="g" />
          <MacroBar label="Carbs" current={totals.carbs} goal={Math.round(calorieGoal * 0.5 / 4)} color={theme.carbs} unit="g" />
          <MacroBar label="Fat" current={totals.fat} goal={Math.round(calorieGoal * 0.3 / 9)} color={theme.fat} unit="g" />
        </View>

        {/* Meal sections */}
        <Text style={styles.sectionHeader}>Meals</Text>
        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => (
          <MealSection key={meal} mealType={meal} logs={byMealType(meal)} />
        ))}

        {/* 7-day trend chart */}
        <WeeklyChart userId={session?.user.id ?? ''} calorieGoal={calorieGoal} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  headerSafe: {},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { fontSize: 13, fontWeight: '500' },
  userName: { fontSize: 20, fontWeight: '800' },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2 },
  avatarInitial: { fontSize: 16, fontWeight: '700' },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 36, gap: 14 },

  // Macros card
  macrosCard: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  macrosTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#90a4ae',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },

  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#90a4ae',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginTop: 4,
  },
});


