import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import type { FoodLog } from '../../store/foodLogStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const C = {
  bg:            '#101415',
  glass:         'rgba(15,23,42,0.80)',
  glassBorder:   'rgba(255,255,255,0.08)',
  primary:       '#85d3da',
  secondary:     '#bdf4ff',
  tertiary:      '#c0c1ff',
  secondaryCont: '#00e3fd',
  onSurface:     '#e0e3e5',
  onSurfaceVar:  '#bec8c9',
  outline:       '#889393',
  outlineVar:    '#3f4949',
  primaryCont:   '#01696f',
  error:         '#ffb4ab',
};

const DOW_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const MEAL_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  breakfast: { icon: 'cafe-outline',       color: '#ffd580' },
  lunch:     { icon: 'fast-food-outline',  color: C.primary },
  dinner:    { icon: 'restaurant-outline', color: C.tertiary },
  snack:     { icon: 'nutrition-outline',  color: '#a8d8a8' },
};

const CHART_BAR_HEIGHT = 120;

interface DayData {
  date: string;
  dow: string;
  dayNum: number;
  dateLabel: string;
  calories: number;
  mealCount: number;
  logs: FoodLog[];
}

function buildLast7(): DayData[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    return {
      date: iso,
      dow: DOW_SHORT[d.getDay()],
      dayNum: d.getDate(),
      dateLabel: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      calories: 0,
      mealCount: 0,
      logs: [],
    };
  });
}

export function HistoryScreen() {
  const { session } = useAuthStore();
  const [weekDays, setWeekDays] = useState<DayData[]>(buildLast7());
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [avgCalories, setAvgCalories] = useState(0);
  const [trend, setTrend] = useState<{ pct: number; dir: 'up' | 'down' | 'neutral' }>({ pct: 0, dir: 'neutral' });

  const today = new Date().toISOString().slice(0, 10);

  const fetchWeekData = useCallback(async () => {
    if (!session?.user.id) return;

    const from = new Date();
    from.setDate(from.getDate() - 13);
    const startISO = from.toISOString().slice(0, 10) + 'T00:00:00.000Z';

    const { data } = await supabase
      .from('food_logs')
      .select('id, logged_at, calories, food_name, meal_type, protein_g, carbs_g, fat_g, fiber_g, image_url, user_id')
      .eq('user_id', session.user.id)
      .gte('logged_at', startISO)
      .order('logged_at', { ascending: true });

    if (!data) return;

    const byDay: Record<string, { calories: number; logs: FoodLog[] }> = {};
    (data as FoodLog[]).forEach((log) => {
      const day = log.logged_at.slice(0, 10);
      if (!byDay[day]) byDay[day] = { calories: 0, logs: [] };
      byDay[day].calories += log.calories || 0;
      byDay[day].logs.push(log);
    });

    const last7 = buildLast7().map((d) => {
      const entry = byDay[d.date];
      if (!entry) return d;
      const mealTypes = new Set(entry.logs.map((l) => l.meal_type).filter(Boolean));
      return { ...d, calories: Math.round(entry.calories), mealCount: mealTypes.size, logs: entry.logs };
    });
    setWeekDays(last7);

    const daysWithData = last7.filter((d) => d.calories > 0);
    const avg = daysWithData.length > 0
      ? Math.round(daysWithData.reduce((s, d) => s + d.calories, 0) / daysWithData.length)
      : 0;
    setAvgCalories(avg);

    const prev7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - 7 - i);
      return d.toISOString().slice(0, 10);
    });
    const prevCals = prev7.map((d) => byDay[d]?.calories || 0).filter((c) => c > 0);
    const prevAvg = prevCals.length > 0 ? prevCals.reduce((s, c) => s + c, 0) / prevCals.length : 0;
    if (prevAvg > 0 && avg > 0) {
      const pct = Math.round(((avg - prevAvg) / prevAvg) * 100);
      setTrend({ pct: Math.abs(pct), dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral' });
    }
  }, [session?.user.id]);

  useEffect(() => { fetchWeekData(); }, [fetchWeekData]);

  const toggleDay = (date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDate((prev) => (prev === date ? null : date));
  };

  const handleExport = async () => {
    const lines = weekDays
      .filter((d) => d.calories > 0)
      .map((d) => `${d.dateLabel}: ${d.calories.toLocaleString()} kcal (${d.mealCount} meal${d.mealCount !== 1 ? 's' : ''})`)
      .join('\n');
    await Share.share({ message: `CalSnap Weekly Report\n\n${lines || 'No logs this week.'}` });
  };

  const maxCals = Math.max(...weekDays.map((d) => d.calories), 1);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>Your metabolic journey over the last 7 days.</Text>
        </View>

        {/* Weekly Insights Bar Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartTopRow}>
            <View style={{ gap: 4 }}>
              <Text style={styles.chartCaption}>Average Consumption</Text>
              <View style={styles.chartAvgRow}>
                <Text style={styles.chartBigNum}>
                  {avgCalories > 0 ? avgCalories.toLocaleString() : '--'}
                </Text>
                <Text style={styles.chartUnit}>kcal/day</Text>
              </View>
            </View>
            <View style={styles.chartTrendBlock}>
              <Text style={styles.chartTrendLabel}>Week Trend</Text>
              {trend.pct > 0 ? (
                <Text style={[styles.chartTrendValue, { color: trend.dir === 'up' ? C.error : '#a8d8a8' }]}>
                  {trend.dir === 'up' ? '+' : '-'}{trend.pct}% {trend.dir === 'up' ? 'up' : 'down'}
                </Text>
              ) : (
                <Text style={[styles.chartTrendValue, { color: C.outline }]}>-- %</Text>
              )}
            </View>
          </View>

          <View style={styles.barChart}>
            {weekDays.map((day) => {
              const isToday = day.date === today;
              const barH = day.calories > 0
                ? Math.max(Math.round((day.calories / maxCals) * CHART_BAR_HEIGHT), 6)
                : 0;

              return (
                <View key={day.date} style={styles.barCol}>
                  {isToday ? (
                    <View style={styles.todayPill}>
                      <Text style={styles.todayPillText}>TODAY</Text>
                    </View>
                  ) : (
                    <View style={styles.todayPillPlaceholder} />
                  )}

                  <View style={[styles.barTrack, isToday && styles.barTrackToday, !day.calories && { opacity: 0.3 }]}>
                    {barH > 0 && (
                      <LinearGradient
                        colors={['#01696f', '#00e3fd']}
                        style={[styles.barFill, { height: barH }]}
                        start={{ x: 0.5, y: 1 }}
                        end={{ x: 0.5, y: 0 }}
                      />
                    )}
                  </View>

                  <Text style={[
                    styles.barLabel,
                    isToday && { color: C.secondaryCont, fontWeight: '700' },
                    !day.calories && { color: C.outlineVar },
                  ]}>
                    {day.dow}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Daily Logs */}
        <View style={styles.logsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daily Logs</Text>
            <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.7}>
              <Text style={styles.exportText}>EXPORT</Text>
              <Ionicons name="share-outline" size={14} color={C.secondaryCont} />
            </TouchableOpacity>
          </View>

          {[...weekDays].reverse().map((day) => {
            const isExpanded = expandedDate === day.date;
            const isDayToday = day.date === today;

            return (
              <View key={day.date} style={[styles.dayCard, isExpanded && styles.dayCardExpanded]}>
                <TouchableOpacity
                  style={styles.dayCardHeader}
                  onPress={() => toggleDay(day.date)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.dateBadge, isExpanded && { backgroundColor: 'rgba(133,211,218,0.12)' }]}>
                    <Text style={styles.dateBadgeDow}>{day.dow}</Text>
                    <Text style={[styles.dateBadgeNum, isExpanded && { color: C.primary }]}>{day.dayNum}</Text>
                  </View>

                  <View style={styles.dayInfo}>
                    <Text style={styles.dayDateLabel}>{day.dateLabel}</Text>
                    <Text style={styles.dayMeta}>
                      {day.mealCount > 0
                        ? `${day.mealCount} MEAL${day.mealCount !== 1 ? 'S' : ''} - ${day.calories.toLocaleString()} KCAL`
                        : isDayToday ? 'START LOGGING TODAY' : 'NO LOGS'}
                    </Text>
                  </View>

                  {!isExpanded && day.logs.length > 0 && (
                    <View style={styles.macroDots}>
                      <View style={[styles.dot, { backgroundColor: C.primary }]} />
                      <View style={[styles.dot, { backgroundColor: C.tertiary }]} />
                      <View style={[styles.dot, { backgroundColor: C.error }]} />
                    </View>
                  )}

                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={C.outline}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.expandedBody}>
                    <View style={styles.expandDivider} />
                    {day.logs.length > 0 ? (
                      <>
                        {day.logs.map((log, li) => {
                          const mealInfo = MEAL_ICONS[log.meal_type ?? 'snack'] ?? MEAL_ICONS.snack;
                          return (
                            <View key={log.id ?? li} style={styles.logItem}>
                              <View style={styles.logLeft}>
                                <Ionicons name={mealInfo.icon} size={18} color={mealInfo.color} />
                                <Text style={styles.logName} numberOfLines={1}>{log.food_name}</Text>
                              </View>
                              <Text style={styles.logCal}>{Math.round(log.calories)} kcal</Text>
                            </View>
                          );
                        })}
                        <View style={styles.logTotalRow}>
                          <Text style={styles.logTotalLabel}>Total</Text>
                          <Text style={styles.logTotalValue}>{day.calories.toLocaleString()} kcal</Text>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.noLogsText}>No meals were logged on this day.</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Motivational Quote */}
        <LinearGradient
          colors={['rgba(1,105,111,0.18)', 'rgba(73,75,214,0.12)']}
          style={styles.quoteCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="sparkles" size={28} color={C.secondaryCont} style={{ marginBottom: 10 }} />
          <Text style={styles.quoteText}>
            "Consistency is the silent catalyst of transformation.{'\n'}Your data tells a story of progress."
          </Text>
        </LinearGradient>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40, gap: 20 },

  headerSection: { paddingHorizontal: 20, paddingTop: 16, gap: 4 },
  title:    { fontSize: 28, fontWeight: '800', color: C.onSurface, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: C.onSurfaceVar, fontWeight: '400' },

  chartCard: {
    marginHorizontal: 20,
    backgroundColor: C.glass,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.glassBorder,
    padding: 20,
    gap: 20,
  },
  chartTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  chartCaption:   { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.secondaryCont, textTransform: 'uppercase' },
  chartAvgRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  chartBigNum:    { fontSize: 40, fontWeight: '800', color: C.secondary, letterSpacing: -1 },
  chartUnit:      { fontSize: 14, color: C.onSurfaceVar, fontWeight: '400' },
  chartTrendBlock:{ alignItems: 'flex-end', gap: 2 },
  chartTrendLabel:{ fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: C.outline, textTransform: 'uppercase' },
  chartTrendValue:{ fontSize: 18, fontWeight: '700' },

  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_BAR_HEIGHT + 48,
    gap: 6,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },

  todayPill:           { backgroundColor: C.secondaryCont, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  todayPillText:       { fontSize: 8, fontWeight: '800', color: '#00363a', letterSpacing: 0.5 },
  todayPillPlaceholder:{ height: 18 },

  barTrack: {
    width: '100%',
    height: CHART_BAR_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barTrackToday: {
    backgroundColor: 'rgba(0,227,253,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,227,253,0.25)',
  },
  barFill:  { width: '100%', borderRadius: 8 },
  barLabel: { fontSize: 9, fontWeight: '700', color: C.outline, letterSpacing: 0.5 },

  logsSection:  { gap: 12, paddingHorizontal: 20 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: C.onSurface },
  exportBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exportText:   { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.secondaryCont },

  dayCard: {
    backgroundColor: C.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
    overflow: 'hidden',
    marginBottom: 10,
  },
  dayCardExpanded: { borderLeftWidth: 3, borderLeftColor: C.secondaryCont },
  dayCardHeader:   { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },

  dateBadge:    { width: 48, height: 48, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', gap: 1 },
  dateBadgeDow: { fontSize: 9, fontWeight: '700', color: C.outline, letterSpacing: 0.8 },
  dateBadgeNum: { fontSize: 20, fontWeight: '700', color: C.onSurface, lineHeight: 22 },

  dayInfo:      { flex: 1, gap: 3 },
  dayDateLabel: { fontSize: 15, fontWeight: '600', color: C.onSurface },
  dayMeta:      { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: C.outline },

  macroDots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot:        { width: 7, height: 7, borderRadius: 4 },

  expandedBody:  { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  expandDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 4 },

  logItem:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  logName:  { fontSize: 14, color: C.onSurface, flex: 1 },
  logCal:   { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: C.outline },

  logTotalRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  logTotalLabel:{ fontSize: 11, fontWeight: '700', color: C.outline, letterSpacing: 1, textTransform: 'uppercase' },
  logTotalValue:{ fontSize: 15, fontWeight: '800', color: C.primary },

  noLogsText: { fontSize: 13, color: C.outline, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },

  quoteCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(133,211,218,0.15)',
  },
  quoteText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: C.onSurfaceVar,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
});
