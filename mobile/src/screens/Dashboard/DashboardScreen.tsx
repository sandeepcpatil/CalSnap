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
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore, FoodLog } from '../../store/foodLogStore';
import { CalorieRing } from '../../components/CalorieRing';
import { MacroBar } from '../../components/MacroBar';
import { MealSection } from '../../components/MealSection';
import { WeeklyChart } from '../../components/WeeklyChart';
import { DateSelector } from '../../components/DateSelector';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardScreen() {
  const { profile, session } = useAuthStore();
  const { todayLogs, selectedDate, isLoading, setSelectedDate, fetchLogsForDate } = useFoodLogStore();

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadLogs} tintColor="#01696f" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text variant="bodyMedium" style={styles.greeting}>{getGreeting()},</Text>
            <Text variant="headlineSmall" style={styles.userName}>{profile?.name ?? 'there'} 👋</Text>
          </View>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {(profile?.name ?? 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Date selector */}
        <DateSelector
          selectedDate={selectedDate}
          onDateChange={(date) => {
            setSelectedDate(date);
          }}
        />

        {/* Calorie Ring */}
        <CalorieRing consumed={totals.calories} goal={calorieGoal} />

        {/* Macro bars */}
        <View style={styles.macrosCard}>
          <MacroBar label="Protein" current={totals.protein} goal={proteinGoal} color="#4caf50" unit="g" />
          <MacroBar label="Carbs" current={totals.carbs} goal={Math.round(calorieGoal * 0.5 / 4)} color="#ff9800" unit="g" />
          <MacroBar label="Fat" current={totals.fat} goal={Math.round(calorieGoal * 0.3 / 9)} color="#ffc107" unit="g" />
        </View>

        {/* Meal sections */}
        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => (
          <MealSection key={meal} mealType={meal} logs={byMealType(meal)} />
        ))}

        {/* 7-day trend chart */}
        <WeeklyChart userId={session?.user.id ?? ''} calorieGoal={calorieGoal} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fffe' },
  scroll: { paddingBottom: 32, gap: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  greeting: { color: '#90a4ae' },
  userName: { color: '#212121', fontWeight: '700' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { backgroundColor: '#01696f', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  macrosCard: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
});
