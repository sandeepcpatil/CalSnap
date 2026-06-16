import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useFoodLogStore } from '../../store/foodLogStore';
import { MealSection } from '../../components/MealSection';
import { useAppTheme } from '../../context/ThemeContext';

type MarkedDates = Record<string, { dotColor: string }>;

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getMonthDays(yearMonth: string): (string | null)[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay();
  const lastDate = new Date(y, m, 0).getDate();
  const days: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= lastDate; d++) {
    days.push(`${yearMonth}-${String(d).padStart(2, '0')}`);
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function addMonths(yearMonth: string, n: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

interface MiniCalendarProps {
  yearMonth: string;
  selectedDate: string;
  markedDates: MarkedDates;
  onSelectDate: (d: string) => void;
  onChangeMonth: (ym: string) => void;
  primaryColor: string;
  onSurface: string;
}

function MiniCalendar({ yearMonth, selectedDate, markedDates, onSelectDate, onChangeMonth, primaryColor, onSurface }: MiniCalendarProps) {
  const days = getMonthDays(yearMonth);
  const today = new Date().toISOString().slice(0, 10);
  const rows = Math.ceil(days.length / 7);

  return (
    <View style={calStyles.root}>
      {/* Month header */}
      <View style={calStyles.header}>
        <TouchableOpacity onPress={() => onChangeMonth(addMonths(yearMonth, -1))} style={calStyles.arrow}>
          <Ionicons name="chevron-back" size={20} color={primaryColor} />
        </TouchableOpacity>
        <Text style={[calStyles.monthLabel, { color: onSurface }]}>{formatMonthLabel(yearMonth)}</Text>
        <TouchableOpacity onPress={() => onChangeMonth(addMonths(yearMonth, 1))} style={calStyles.arrow}>
          <Ionicons name="chevron-forward" size={20} color={primaryColor} />
        </TouchableOpacity>
      </View>

      {/* Day of week row */}
      <View style={calStyles.row}>
        {DOW.map((d) => (
          <Text key={d} style={calStyles.dowLabel}>{d}</Text>
        ))}
      </View>

      {/* Day cells */}
      {Array.from({ length: rows }).map((_, ri) => (
        <View key={ri} style={calStyles.row}>
          {days.slice(ri * 7, ri * 7 + 7).map((dateStr, ci) => {
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === today;
            const mark = dateStr ? markedDates[dateStr] : undefined;
            return (
              <TouchableOpacity
                key={ci}
                style={calStyles.cell}
                onPress={() => dateStr && onSelectDate(dateStr)}
                disabled={!dateStr}
                activeOpacity={0.7}
              >
                {dateStr ? (
                  <View style={[
                    calStyles.dayCircle,
                    isSelected && { backgroundColor: primaryColor },
                    !isSelected && isToday && { borderWidth: 1.5, borderColor: primaryColor },
                  ]}>
                    <Text style={[
                      calStyles.dayText,
                      isSelected && { color: '#fff', fontWeight: '700' },
                      !isSelected && isToday && { color: primaryColor, fontWeight: '700' },
                      !isSelected && !isToday && { color: onSurface },
                    ]}>
                      {String(Number(dateStr.slice(-2)))}
                    </Text>
                    {mark && (
                      <View style={[calStyles.dot, { backgroundColor: mark.dotColor }]} />
                    )}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const calStyles = StyleSheet.create({
  root: { padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  arrow: { padding: 8 },
  monthLabel: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', marginBottom: 2 },
  dowLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#90a4ae', paddingVertical: 4 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 13 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 1 },
});

export function HistoryScreen() {
  const { session, profile } = useAuthStore();
  const { todayLogs, fetchLogsForDate } = useFoodLogStore();
  const { theme } = useAppTheme();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
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
        dotColor: calories <= calorieGoal ? '#4caf50' : '#ef5350',
      };
    });

    setMarkedDates(marks);
  }, [session?.user.id, selectedDate, calorieGoal]);

  useEffect(() => {
    fetchMonthData(currentMonth);
  }, [currentMonth]);

  useEffect(() => {
    fetchMonthData(selectedDate.slice(0, 7));
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

  const hasLogs = todayLogs.length > 0;
  const isToday = selectedDate === new Date().toISOString().slice(0, 10);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="headlineSmall" style={[styles.pageTitle, { color: theme.primary }]}>History 📅</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Avg this week', value: `${stats.avgCalories} kcal`, icon: 'flame-outline' },
            { label: 'Days logged', value: `${stats.streak} / 7`, icon: 'calendar-outline' },
            { label: 'Total scans', value: String(stats.totalScans), icon: 'camera-outline' },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Ionicons name={s.icon as any} size={18} color={theme.primary} style={{ marginBottom: 4 }} />
              <Text variant="titleMedium" style={[styles.statValue, { color: theme.primary }]}>{s.value}</Text>
              <Text variant="bodySmall" style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Calendar */}
        <View style={styles.calendarCard}>
          <MiniCalendar
            yearMonth={currentMonth}
            selectedDate={selectedDate}
            markedDates={markedDates}
            onSelectDate={(d) => { setSelectedDate(d); setCurrentMonth(d.slice(0, 7)); }}
            onChangeMonth={(ym) => setCurrentMonth(ym)}
            primaryColor={theme.primary}
            onSurface={theme.onSurface}
          />
        </View>

        {/* Day title */}
        <Text variant="titleMedium" style={[styles.dayTitle, { color: theme.onSurface }]}>
          {isToday ? 'Today' : selectedDate}
        </Text>

        {/* Logs or empty state */}
        {hasLogs ? (
          (['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => (
            <MealSection key={meal} mealType={meal} logs={byMealType(meal)} />
          ))
        ) : (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.primaryUltraLight }]}>
              <Text style={styles.emptyEmoji}>🥗</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>No meals logged</Text>
            <Text style={[styles.emptySubtitle, { color: theme.onSurfaceVariant }]}>
              {isToday
                ? 'Tap the camera button to scan your first meal today!'
                : 'Nothing was logged on this day.'}
            </Text>
            {isToday && (
              <View style={[styles.emptyHint, { backgroundColor: theme.primaryUltraLight, borderColor: theme.primaryLight }]}>
                <Ionicons name="camera-outline" size={16} color={theme.primary} />
                <Text style={[styles.emptyHintText, { color: theme.primary }]}>Use the Scan tab to log food</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40, gap: 16 },
  pageTitle: { fontWeight: '700', paddingHorizontal: 20, paddingTop: 16 },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: { fontWeight: '700' },
  statLabel: { color: '#90a4ae', textAlign: 'center', fontSize: 10 },

  calendarCard: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },

  dayTitle: { fontWeight: '700', paddingHorizontal: 20, marginTop: 4 },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyEmoji: { fontSize: 42 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1,
    marginTop: 4,
  },
  emptyHintText: { fontSize: 13, fontWeight: '600' },
});
