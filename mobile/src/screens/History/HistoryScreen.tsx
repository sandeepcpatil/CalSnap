import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { MealSection } from '../../components/MealSection';

interface DayMeta {
  calories: number;
  goal: number;
}

type MarkedDates = Record<string, { marked: boolean; dotColor: string; selected?: boolean; selectedColor?: string }>;

export function HistoryScreen() {
  const { session, profile } = useAuthStore();
  const { todayLogs, fetchLogsForDate } = useFoodLogStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [stats, setStats] = useState({ avgCalories: 0, streak: 0, totalScans: 0 });

  const calorieGoal = profile?.daily_calorie_goal ?? 2000;

  const fetchMonthData = useCallback(async (monthStr: string) => {
    if (!session?.user.id) return;

    const [year, month] = monthStr.split('-');
    const start = `${year}-${month}-01T00:00:00.000Z`;
    const end = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10) + 'T23:59:59.999Z';

    const { data } = await supabase
      .from('food_logs')
      .select('logged_at, calories')
      .eq('user_id', session.user.id)
      .gte('logged_at', start)
      .lte('logged_at', end);

    if (!data) return;

    const byDay: Record<string, number> = {};
    data.forEach((log) => {
      const day = log.logged_at.slice(0, 10);
      byDay[day] = (byDay[day] || 0) + (log.calories || 0);
    });

    const marks: MarkedDates = {};
    Object.entries(byDay).forEach(([day, calories]) => {
      marks[day] = {
        marked: true,
        dotColor: calories <= calorieGoal ? '#4caf50' : '#ef5350',
        ...(day === selectedDate ? { selected: true, selectedColor: '#01696f' } : {}),
      };
    });

    if (selectedDate && !marks[selectedDate]) {
      marks[selectedDate] = { marked: false, dotColor: '', selected: true, selectedColor: '#01696f' };
    }

    setMarkedDates(marks);
  }, [session?.user.id, selectedDate, calorieGoal]);

  useEffect(() => {
    const month = selectedDate.slice(0, 7);
    fetchMonthData(month);
    if (session?.user.id) fetchLogsForDate(session.user.id, selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    fetchStats();
  }, [session?.user.id]);

  const fetchStats = async () => {
    if (!session?.user.id) return;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: weekLogs } = await supabase
      .from('food_logs')
      .select('logged_at, calories')
      .eq('user_id', session.user.id)
      .gte('logged_at', sevenDaysAgo);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('scan_count')
      .eq('id', session.user.id)
      .single();

    const totalCals = weekLogs?.reduce((s, l) => s + (l.calories || 0), 0) ?? 0;
    const daysWithLogs = new Set(weekLogs?.map(l => l.logged_at.slice(0, 10))).size;
    const avgCals = daysWithLogs > 0 ? Math.round(totalCals / daysWithLogs) : 0;

    setStats({
      avgCalories: avgCals,
      streak: daysWithLogs,
      totalScans: profileData?.scan_count ?? 0,
    });
  };

  const byMealType = (type: string) =>
    todayLogs.filter((l) => l.meal_type === type) as any;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="headlineSmall" style={styles.pageTitle}>History 📅</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Avg this week', value: `${stats.avgCalories} kcal` },
            { label: 'Days logged', value: `${stats.streak} / 7` },
            { label: 'Total scans', value: String(stats.totalScans) },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text variant="titleMedium" style={styles.statValue}>{s.value}</Text>
              <Text variant="bodySmall" style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Calendar */}
        <View style={styles.calendarCard}>
          <Calendar
            current={selectedDate}
            onDayPress={(day: { dateString: string }) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            onMonthChange={(month: { dateString: string }) => fetchMonthData(month.dateString.slice(0, 7))}
            theme={{
              selectedDayBackgroundColor: '#01696f',
              todayTextColor: '#01696f',
              arrowColor: '#01696f',
              dotColor: '#01696f',
              textDayFontWeight: '500',
            }}
          />
        </View>

        {/* Logs for selected day */}
        <Text variant="titleMedium" style={styles.dayTitle}>
          {selectedDate === new Date().toISOString().slice(0, 10) ? 'Today' : selectedDate}
        </Text>

        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => (
          <MealSection key={meal} mealType={meal} logs={byMealType(meal)} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fffe' },
  scroll: { paddingBottom: 32, gap: 16 },
  pageTitle: { color: '#01696f', fontWeight: '700', paddingHorizontal: 20, paddingTop: 16 },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  statValue: { color: '#01696f', fontWeight: '700' },
  statLabel: { color: '#90a4ae', textAlign: 'center' },
  calendarCard: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  dayTitle: { color: '#37474f', fontWeight: '700', paddingHorizontal: 20 },
});
