import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { getDailyQuote } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { FoodLog } from '../../store/foodLogStore';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import { PaywallModal } from '../Paywall/PaywallModal';
import { ProGate } from '../../components/ProGate';
import { ExportRangeModal } from '../../components/ExportRangeModal';
import { T } from '../../theme';
import {
  exportHistoryToExcel,
  resolveExportRange,
  groupLogsByDay,
  type ExportRangeKey,
} from '../../services/export';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Screen palette — derived from the shared design tokens so colours stay in
// sync app-wide (see theme/tokens.ts).
const C = {
  bg: T.bg,
  glass: T.surface,
  glassBorder: T.border,
  primary: T.primary,
  secondary: T.primary,
  tertiary: T.protein,
  secondaryCont: T.primary,
  onSurface: T.textPrimary,
  onSurfaceVar: T.textSecondary,
  outline: T.textMuted,
  outlineVar: T.border,
  primaryCont: T.primaryDeep,
  error: T.error,
};

const DOW_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const MEAL_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  breakfast: { icon: 'cafe-outline',       color: T.mealBreakfast },
  lunch:     { icon: 'fast-food-outline',  color: C.primary },
  dinner:    { icon: 'restaurant-outline', color: C.tertiary },
  snack:     { icon: 'nutrition-outline',  color: T.mealSnack },
};

const CHART_BAR_HEIGHT = 120;

// Local fallback so a quote always shows (offline, or before the fetch resolves).
const LOCAL_QUOTES = [
  'Consistency is the silent catalyst of transformation. Your data tells a story of progress.',
  'Small choices, repeated daily, become the body you live in.',
  'You don’t need to be perfect — just one step better than yesterday.',
  'Your habits are voting for the person you’re becoming.',
  'Progress is quiet. Keep going even when no one is watching.',
];

interface DayData {
  date: string;
  dow: string;
  dayNum: number;
  dateLabel: string;
  calories: number;
  mealCount: number;
  logs: FoodLog[];
}

// Ranges offered to Pro users. Free users are capped at the 7-day week.
const RANGE_OPTIONS = [
  { days: 7,  label: 'Week' },
  { days: 30, label: 'Month' },
  { days: 90, label: '90 Days' },
] as const;
type RangeDays = (typeof RANGE_OPTIONS)[number]['days'];

function buildDays(count: number): DayData[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
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

const buildLast7 = (): DayData[] => buildDays(7);

/** Fill a range of empty DayData with logs grouped by day. Immutable. */
function fillDays(days: DayData[], byDay: Record<string, { logs: FoodLog[] }>): DayData[] {
  return days.map((d) => {
    const entry = byDay[d.date];
    if (!entry) return d;
    const calories = entry.logs.reduce((s, l) => s + (l.calories || 0), 0);
    const mealTypes = new Set(entry.logs.map((l) => l.meal_type).filter(Boolean));
    return { ...d, calories: Math.round(calories), mealCount: mealTypes.size, logs: entry.logs };
  });
}

export function HistoryScreen() {
  const { session } = useAuthStore();
  const { isSubscribed, paywallVisible, showPaywall, dismissPaywall } = useSubscriptionGate();
  const [weekDays, setWeekDays] = useState<DayData[]>(buildLast7());
  const [listDays, setListDays] = useState<DayData[]>(buildLast7());
  const [historyRange, setHistoryRange] = useState<RangeDays>(7);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [exportPickerOpen, setExportPickerOpen] = useState(false);
  const [exportBusyKey, setExportBusyKey] = useState<ExportRangeKey | null>(null);
  const [avgCalories, setAvgCalories] = useState(0);
  const [trend, setTrend] = useState<{ pct: number; dir: 'up' | 'down' | 'neutral' }>({ pct: 0, dir: 'neutral' });
  const [quote, setQuote] = useState<string>(
    () => LOCAL_QUOTES[new Date().getDate() % LOCAL_QUOTES.length] ?? LOCAL_QUOTES[0],
  );

  const today = new Date().toISOString().slice(0, 10);

  // Fetch the shared "quote of the day" (backend caches one per day for everyone).
  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    let active = true;
    getDailyQuote(token)
      .then((r) => { if (active && r?.quote) setQuote(r.quote); })
      .catch(() => { /* keep the local fallback already in state */ });
    return () => { active = false; };
  }, [session?.access_token]);

  const fetchWeekData = useCallback(async () => {
    if (!session?.user.id) return;

    // Fetch enough to cover both the selected range and the 14 days the
    // week-over-week trend needs.
    const span = Math.max(historyRange, 14);
    const from = new Date();
    from.setDate(from.getDate() - (span - 1));
    const startISO = from.toISOString().slice(0, 10) + 'T00:00:00.000Z';

    const { data } = await supabase
      .from('food_logs')
      .select('id, logged_at, calories, food_name, meal_type, protein_g, carbs_g, fat_g, fiber_g, image_url, user_id')
      .eq('user_id', session.user.id)
      .gte('logged_at', startISO)
      .order('logged_at', { ascending: true });

    if (!data) return;

    const byDay: Record<string, { logs: FoodLog[] }> = {};
    (data as FoodLog[]).forEach((log) => {
      const day = log.logged_at.slice(0, 10);
      if (!byDay[day]) byDay[day] = { logs: [] };
      byDay[day].logs.push(log);
    });

    const last7 = fillDays(buildLast7(), byDay);
    setWeekDays(last7);
    setListDays(fillDays(buildDays(historyRange), byDay));

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
    const prevCals = prev7
      .map((d) => (byDay[d]?.logs.reduce((s, l) => s + (l.calories || 0), 0)) || 0)
      .filter((c) => c > 0);
    const prevAvg = prevCals.length > 0 ? prevCals.reduce((s, c) => s + c, 0) / prevCals.length : 0;
    if (prevAvg > 0 && avg > 0) {
      const pct = Math.round(((avg - prevAvg) / prevAvg) * 100);
      setTrend({ pct: Math.abs(pct), dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral' });
    }
  }, [session?.user.id, historyRange]);

  useEffect(() => { fetchWeekData(); }, [fetchWeekData]);

  const toggleDay = (date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDate((prev) => (prev === date ? null : date));
  };

  // Export queries Supabase directly for the chosen window, independent of what's
  // currently loaded on screen — so "Last month" works even in the 7-day view.
  const runExport = async (key: ExportRangeKey) => {
    if (!session?.user.id || exportBusyKey) return;
    setExportBusyKey(key);
    try {
      const range = resolveExportRange(key);
      const { data, error } = await supabase
        .from('food_logs')
        .select('id, logged_at, calories, food_name, meal_type, protein_g, carbs_g, fat_g, fiber_g, image_url, user_id')
        .eq('user_id', session.user.id)
        .gte('logged_at', `${range.startDate}T00:00:00.000Z`)
        .lte('logged_at', `${range.endDate}T23:59:59.999Z`)
        .order('logged_at', { ascending: true });
      if (error) throw error;

      const days = groupLogsByDay((data as FoodLog[]) ?? []);
      const ok = await exportHistoryToExcel(days);
      if (ok) {
        setExportPickerOpen(false);
      } else {
        Alert.alert('Nothing to export', `No meals were logged in ${range.label.toLowerCase()}. Try another period.`);
      }
    } catch (err: unknown) {
      Alert.alert('Export failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setExportBusyKey(null);
    }
  };

  const maxCals = Math.max(...weekDays.map((d) => d.calories), 1);

  // Daily-logs list: free users see the 3 most recent days; Pro sees the whole
  // selected range (weeks show every day, longer ranges show only logged days
  // to avoid a wall of empty rows).
  const reversedList = [...listDays].reverse();
  const daysToShow = !isSubscribed
    ? reversedList // free: full last-7-days week
    : historyRange === 7
      ? reversedList
      : reversedList.filter((d) => d.logs.length > 0);
  const loggedDayCount = listDays.filter((d) => d.logs.length > 0).length;

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
                <Text style={[styles.chartTrendValue, { color: trend.dir === 'up' ? C.error : T.mealSnack }]}>
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
                        colors={[T.primaryDeep, T.primary]}
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
            {isSubscribed ? (
              <TouchableOpacity style={styles.exportBtn} onPress={() => setExportPickerOpen(true)} activeOpacity={0.7}>
                <Text style={styles.exportText}>EXPORT</Text>
                <Ionicons name="download-outline" size={14} color={C.secondaryCont} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.exportBtn} onPress={showPaywall} activeOpacity={0.7}>
                <Ionicons name="lock-closed" size={12} color={C.outline} />
                <Text style={[styles.exportText, { color: C.outline }]}>EXPORT</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Range selector — Pro only */}
          {isSubscribed && (
            <View style={styles.rangeRow}>
              {RANGE_OPTIONS.map((opt) => {
                const active = historyRange === opt.days;
                return (
                  <TouchableOpacity
                    key={opt.days}
                    style={[styles.rangeChip, active && styles.rangeChipActive]}
                    onPress={() => setHistoryRange(opt.days)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.rangeChipText, active && styles.rangeChipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {isSubscribed && historyRange !== 7 && (
            <Text style={styles.rangeCaption}>
              {loggedDayCount} day{loggedDayCount !== 1 ? 's' : ''} logged in the last {historyRange} days
            </Text>
          )}

          {/* Free: 3 most recent days. Pro: the selected range. */}
          {daysToShow.map((day) => {
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

          {/* Empty state for Pro long ranges with no logs */}
          {isSubscribed && historyRange !== 7 && daysToShow.length === 0 && (
            <View style={styles.emptyRange}>
              <Ionicons name="calendar-outline" size={28} color={C.outline} />
              <Text style={styles.emptyRangeText}>No meals logged in the last {historyRange} days.</Text>
            </View>
          )}

          {/* Pro gate for older days */}
          {!isSubscribed && (
            <ProGate isSubscribed={false} onUpgrade={showPaywall} label="Full History, Charts & Export" borderRadius={16}>
              <View style={styles.dayCard}>
                <View style={styles.dayCardHeader}>
                  <View style={styles.dateBadge}>
                    <Ionicons name="calendar-outline" size={20} color={C.outline} />
                  </View>
                  <View style={styles.dayInfo}>
                    <Text style={styles.dayDateLabel}>30 & 90-Day History + Export</Text>
                    <Text style={styles.dayMeta}>UNLOCK WITH PRO</Text>
                  </View>
                </View>
              </View>
            </ProGate>
          )}
        </View>

        {/* Motivational Quote */}
        <LinearGradient
          colors={[T.primaryTint, T.primaryTint]}
          style={styles.quoteCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="sparkles" size={28} color={C.secondaryCont} style={{ marginBottom: 10 }} />
          <Text style={styles.quoteText}>
            "{quote}"
          </Text>
        </LinearGradient>

        <View style={{ height: 40 }} />
      </ScrollView>

      <PaywallModal visible={paywallVisible} onDismiss={dismissPaywall} />
      <ExportRangeModal
        visible={exportPickerOpen}
        onClose={() => setExportPickerOpen(false)}
        onSelect={runExport}
        busyKey={exportBusyKey}
      />
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
  chartTrendLabel:{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: C.outline, textTransform: 'uppercase' },
  chartTrendValue:{ fontSize: 18, fontWeight: '700' },

  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_BAR_HEIGHT + 48,
    gap: 6,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },

  todayPill:           { backgroundColor: C.secondaryCont, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  todayPillText:       { fontSize: 11, fontWeight: '800', color: T.textOnPrimary, letterSpacing: 0.5 },
  todayPillPlaceholder:{ height: 18 },

  barTrack: {
    width: '100%',
    height: CHART_BAR_HEIGHT,
    backgroundColor: T.surface2,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barTrackToday: {
    backgroundColor: T.primaryTint,
    borderWidth: 1,
    borderColor: T.border,
  },
  barFill:  { width: '100%', borderRadius: 8 },
  barLabel: { fontSize: 11, fontWeight: '700', color: C.outline, letterSpacing: 0.5 },

  logsSection:  { gap: 12, paddingHorizontal: 20 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: C.onSurface },
  exportBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exportText:   { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.secondaryCont },

  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: T.divider,
    borderRadius: 12,
    padding: 4,
  },
  rangeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  rangeChipActive: { backgroundColor: T.primaryTint },
  rangeChipText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: C.outline },
  rangeChipTextActive: { color: C.secondaryCont },
  rangeCaption: { fontSize: 11, fontWeight: '600', color: C.outline, letterSpacing: 0.3, marginTop: 2 },

  emptyRange: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  emptyRangeText: { fontSize: 13, color: C.outline, textAlign: 'center' },

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

  dateBadge:    { width: 48, height: 48, borderRadius: 10, backgroundColor: T.divider, alignItems: 'center', justifyContent: 'center', gap: 1 },
  dateBadgeDow: { fontSize: 11, fontWeight: '700', color: C.outline, letterSpacing: 0.8 },
  dateBadgeNum: { fontSize: 20, fontWeight: '700', color: C.onSurface, lineHeight: 22 },

  dayInfo:      { flex: 1, gap: 3 },
  dayDateLabel: { fontSize: 15, fontWeight: '600', color: C.onSurface },
  dayMeta:      { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: C.outline },

  macroDots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot:        { width: 7, height: 7, borderRadius: 4 },

  expandedBody:  { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  expandDivider: { height: 1, backgroundColor: T.divider, marginBottom: 4 },

  logItem:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  logName:  { fontSize: 14, color: C.onSurface, flex: 1 },
  logCal:   { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: C.outline },

  logTotalRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.divider },
  logTotalLabel:{ fontSize: 11, fontWeight: '700', color: C.outline, letterSpacing: 1, textTransform: 'uppercase' },
  logTotalValue:{ fontSize: 15, fontWeight: '800', color: C.primary },

  noLogsText: { fontSize: 13, color: C.outline, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },

  quoteCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.border,
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
