import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { normalizeLog, type FoodLog } from '../../store/foodLogStore';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import { PaywallModal } from '../Paywall/PaywallModal';
import { CoachFab, useHideOnScroll } from '../../components/CoachFab';
import { ProGate } from '../../components/ProGate';
import { ExportRangeModal } from '../../components/ExportRangeModal';
import { StreakCard } from '../../components/StreakCard';
import { T, HIT_TARGET, tabularNums } from '../../theme';
import {
  exportHistoryToExcel,
  resolveExportRange,
  groupLogsByDay,
  type ExportRangeKey,
} from '../../services/export';
import {
  bucketize,
  granularityFor,
  averageOverLoggedDays,
  trendPct,
  type Bucket,
} from '../../utils/historyStats';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MEAL_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  breakfast: { icon: 'cafe-outline',       color: T.mealBreakfast },
  lunch:     { icon: 'fast-food-outline',  color: T.mealLunch },
  dinner:    { icon: 'restaurant-outline', color: T.mealDinner },
  snack:     { icon: 'nutrition-outline',  color: T.mealSnack },
};

// Chart geometry. Each column stacks: value label / track / axis label, so the
// target line can be placed against the track by arithmetic alone.
const CHART_BAR_HEIGHT = 120;
const VALUE_LABEL_H = 18;
const AXIS_LABEL_H = 16;
const BAR_GAP = 4;
/** Bars scale to at least 1.2× the goal so the goal line never sits at the top. */
const TARGET_HEADROOM = 1.2;

type LoadStatus = 'loading' | 'ready' | 'error';
type TrendDir = 'up' | 'down' | 'neutral';
type BodyGoal = 'lose_weight' | 'maintain' | 'gain_muscle' | null;

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
  { days: 90, label: '90 days' },
] as const;
type RangeDays = (typeof RANGE_OPTIONS)[number]['days'];

/**
 * `count` empty days ending `endOffset` days before today (0 = today).
 * The offset lets us build the *prior* window for the trend comparison.
 */
function buildDays(count: number, endOffset = 0): DayData[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - endOffset - (count - 1 - i));
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

/** Weekday for a daily bucket key, in sentence case (the stats helper emits caps). */
function dowLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return DOW_SHORT[new Date(y, (m ?? 1) - 1, d ?? 1).getDay()];
}

interface MealGroup {
  key: string;
  mealType: string;
  time: string;         // "7:30 PM"
  calories: number;
  logs: FoodLog[];      // 1 item = simple row; 2+ = expandable meal
}

/**
 * Collapse a day's rows into meals. Rows sharing a `meal_id` (a single scan of
 * a multi-item plate) become one group; everything else is its own group. So a
 * thali reads as "Dinner · 5 items" instead of five identical thumbnails.
 */
function groupLogsIntoMeals(logs: FoodLog[]): MealGroup[] {
  const byMeal = new Map<string, FoodLog[]>();
  logs.forEach((log) => {
    // Ungrouped rows (no meal_id, or legacy) each get a unique key.
    const key = log.meal_id ?? `single-${log.id}`;
    const arr = byMeal.get(key);
    if (arr) arr.push(log);
    else byMeal.set(key, [log]);
  });

  return Array.from(byMeal.entries())
    .map(([key, rows]) => {
      const first = rows[0];
      const time = new Date(first.logged_at).toLocaleTimeString('en-IN', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
      return {
        key,
        mealType: first.meal_type ?? 'snack',
        time,
        calories: Math.round(rows.reduce((s, l) => s + (l.calories || 0), 0)),
        logs: rows,
      };
    })
    .sort((a, b) => a.logs[0].logged_at.localeCompare(b.logs[0].logged_at));
}

const MEAL_TYPE_LABEL: Record<string, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
};

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

/**
 * Colour for a calorie trend, read through the body goal. Eating more is only
 * a warning when the goal is to lose; for a muscle-gain goal it is progress;
 * small moves and unset goals stay neutral so nothing is painted good or bad
 * without a reason.
 */
function calorieTrendColor(dir: TrendDir, pct: number, goal: BodyGoal): string {
  if (dir === 'neutral' || pct < 5) return T.textSecondary;
  switch (goal) {
    case 'lose_weight':
      return dir === 'down' ? T.success : T.warning;
    case 'gain_muscle':
      return dir === 'up' ? T.success : T.warning;
    case 'maintain':
      return pct <= 10 ? T.textSecondary : T.warning;
    default:
      return T.textSecondary;
  }
}

function RetryRow({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.retryRow}>
      <Ionicons name="cloud-offline-outline" size={18} color={T.textMuted} />
      <Text style={styles.retryText}>Couldn't load your history.</Text>
      <TouchableOpacity
        onPress={onRetry}
        style={styles.retryBtn}
        accessibilityRole="button"
        accessibilityLabel="Retry loading history"
      >
        <Text style={styles.retryBtnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

export function HistoryScreen() {
  const { session, profile } = useAuthStore();
  const { isSubscribed, paywallVisible, showPaywall, dismissPaywall } = useSubscriptionGate();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [listDays, setListDays] = useState<DayData[]>(buildLast7());
  const [historyRange, setHistoryRange] = useState<RangeDays>(7);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());
  const [exportPickerOpen, setExportPickerOpen] = useState(false);
  const [exportBusyKey, setExportBusyKey] = useState<ExportRangeKey | null>(null);
  const [avgCalories, setAvgCalories] = useState(0);
  const [trend, setTrend] = useState<{ pct: number; dir: TrendDir }>({ pct: 0, dir: 'neutral' });
  // Discards a slow response for a range the user has already moved on from.
  const requestSeq = useRef(0);

  // Slides the floating Coach pill away while scrolling through history.
  const { hidden: fabHidden, onScroll } = useHideOnScroll();

  const today = new Date().toISOString().slice(0, 10);
  const calorieGoal = profile?.daily_calorie_goal ?? null;
  const bodyGoal: BodyGoal = profile?.body_goal ?? null;

  const fetchWeekData = useCallback(async () => {
    if (!session?.user.id) return;
    const seq = ++requestSeq.current;
    setStatus('loading');

    // Fetch two full ranges: the current window for the chart + list, and the
    // window before it so the trend can compare like with like.
    const span = historyRange * 2;
    const from = new Date();
    from.setDate(from.getDate() - (span - 1));
    const startISO = from.toISOString().slice(0, 10) + 'T00:00:00.000Z';

    const { data, error } = await supabase
      .from('food_logs')
      .select('id, logged_at, calories, food_name, meal_type, protein_g, carbs_g, fat_g, fiber_g, image_url, user_id, meal_id')
      .eq('user_id', session.user.id)
      .gte('logged_at', startISO)
      .order('logged_at', { ascending: true });

    if (seq !== requestSeq.current) return;

    if (error || !data) {
      console.warn('[history] load failed', error);
      setStatus('error');
      return;
    }

    const byDay: Record<string, { logs: FoodLog[] }> = {};
    (data as FoodLog[]).map(normalizeLog).forEach((log) => {
      const day = log.logged_at.slice(0, 10);
      if (!byDay[day]) byDay[day] = { logs: [] };
      byDay[day].logs.push(log);
    });

    // Current range drives the chart, the average and the daily-logs list.
    const currentDays = fillDays(buildDays(historyRange), byDay);
    const priorDays = fillDays(buildDays(historyRange, historyRange), byDay);

    setListDays(currentDays);
    setBuckets(bucketize(currentDays, granularityFor(historyRange), today));

    const avg = averageOverLoggedDays(currentDays);
    setAvgCalories(avg);
    setTrend(trendPct(avg, averageOverLoggedDays(priorDays)));
    setStatus('ready');
  }, [session?.user.id, historyRange, today]);

  useEffect(() => { fetchWeekData(); }, [fetchWeekData]);

  const toggleDay = (date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDate((prev) => (prev === date ? null : date));
  };

  const toggleMeal = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedMeals((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
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
        .select('id, logged_at, calories, food_name, meal_type, protein_g, carbs_g, fat_g, fiber_g, image_url, user_id, meal_id')
        .eq('user_id', session.user.id)
        .gte('logged_at', `${range.startDate}T00:00:00.000Z`)
        .lte('logged_at', `${range.endDate}T23:59:59.999Z`)
        .order('logged_at', { ascending: true });
      if (error) throw error;

      const days = groupLogsByDay(((data as FoodLog[]) ?? []).map(normalizeLog));
      const ok = await exportHistoryToExcel(days);
      if (ok) {
        setExportPickerOpen(false);
      } else {
        Alert.alert('Nothing to export', `No meals were logged in ${range.label.toLowerCase()}. Try another period.`);
      }
    } catch (err: unknown) {
      console.warn('[history] export failed', err);
      Alert.alert("Couldn't export", 'Check your connection and try again.');
    } finally {
      setExportBusyKey(null);
    }
  };

  const maxCals = Math.max(...buckets.map((b) => b.avgKcal), 1);
  const scaleMax = Math.max(calorieGoal ? calorieGoal * TARGET_HEADROOM : 0, maxCals, 1);
  const targetRatio = calorieGoal ? Math.min(1, calorieGoal / scaleMax) : null;
  const isDaily = granularityFor(historyRange) === 'day';

  // Month / 90-day are Pro. A free tap becomes an upsell rather than a dead chip.
  const selectRange = (days: RangeDays) => {
    if (days !== 7 && !isSubscribed) { showPaywall(); return; }
    setHistoryRange(days);
  };

  const rangeNoun = historyRange === 7 ? '7 days' : historyRange === 30 ? '30 days' : '90 days';
  const trendCopy =
    trend.pct === 0
      ? { value: 'About the same', caption: `as the previous ${rangeNoun}` }
      : { value: `${trend.pct}% ${trend.dir === 'up' ? 'more' : 'less'}`, caption: `than the previous ${rangeNoun}` };

  // Daily-logs list: free users see the last week; Pro sees the whole selected
  // range (weeks show every day, longer ranges show only logged days to avoid
  // a wall of empty rows).
  const reversedList = [...listDays].reverse();
  const daysToShow = !isSubscribed
    ? reversedList
    : historyRange === 7
      ? reversedList
      : reversedList.filter((d) => d.logs.length > 0);
  const loggedDayCount = listDays.filter((d) => d.logs.length > 0).length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >

        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>What you ate over the last {rangeNoun}.</Text>
        </View>

        {/* Streak — the most motivating element, so it earns the first screenful. */}
        {!!session?.user.id && <StreakCard userId={session.user.id} />}

        {/* Range selector — drives the whole analytics block below it. */}
        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map((opt) => {
            const active = historyRange === opt.days;
            const locked = opt.days !== 7 && !isSubscribed;
            return (
              <TouchableOpacity
                key={opt.days}
                style={[styles.rangeChip, active && styles.rangeChipActive]}
                onPress={() => selectRange(opt.days)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={locked ? `${opt.label}, requires Pro` : opt.label}
              >
                {locked && <Ionicons name="lock-closed" size={12} color={active ? T.textOnPrimary : T.textMuted} />}
                <Text style={[styles.rangeChipText, active && styles.rangeChipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Consumption chart — bars re-bucket by range: daily / weekly / monthly. */}
        <View style={styles.chartCard}>
          <View style={styles.chartTopRow}>
            <View style={{ gap: 4 }}>
              <Text style={styles.chartCaption}>Average per logged day</Text>
              <View style={styles.chartAvgRow}>
                <Text style={styles.chartBigNum}>
                  {status === 'ready' && avgCalories > 0 ? avgCalories.toLocaleString() : '—'}
                </Text>
                <Text style={styles.chartUnit}>kcal</Text>
              </View>
            </View>
            {status === 'ready' && avgCalories > 0 && (
              <View style={styles.chartTrendBlock}>
                <Text style={[styles.chartTrendValue, { color: calorieTrendColor(trend.dir, trend.pct, bodyGoal) }]}>
                  {trendCopy.value}
                </Text>
                <Text style={styles.chartTrendLabel}>{trendCopy.caption}</Text>
              </View>
            )}
          </View>

          {status === 'loading' ? (
            <View style={styles.chartLoading} accessibilityLabel="Loading history">
              <ActivityIndicator color={T.primary} />
            </View>
          ) : status === 'error' ? (
            <RetryRow onRetry={fetchWeekData} />
          ) : (
            <>
              {/* Caption clarifies what one bar means when it isn't a single day. */}
              {!isDaily && (
                <Text style={styles.chartBarNote}>
                  Each bar is the average day of that {historyRange === 30 ? 'week' : 'month'}.
                </Text>
              )}

              <View style={styles.chartArea}>
                {targetRatio != null && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.targetLine,
                      { bottom: AXIS_LABEL_H + BAR_GAP + Math.round(targetRatio * CHART_BAR_HEIGHT) },
                    ]}
                  />
                )}
                <View style={styles.barChart}>
                  {buckets.map((b) => {
                    const barH = b.avgKcal > 0
                      ? Math.max(Math.round((b.avgKcal / scaleMax) * CHART_BAR_HEIGHT), 6)
                      : 0;
                    const over = calorieGoal != null && b.avgKcal > calorieGoal;
                    const label = isDaily ? dowLabel(b.key) : b.label;

                    return (
                      <View
                        key={b.key}
                        style={styles.barCol}
                        accessibilityLabel={`${label}${b.isCurrent ? ', today' : ''}: ${b.avgKcal > 0 ? `${b.avgKcal} kilocalories` : 'nothing logged'}`}
                      >
                        <Text style={[styles.barValue, over && { color: T.warning }]} numberOfLines={1}>
                          {b.avgKcal > 0 ? b.avgKcal.toLocaleString() : ''}
                        </Text>

                        <View style={[styles.barTrack, b.isCurrent && styles.barTrackToday, !b.avgKcal && { opacity: 0.3 }]}>
                          {barH > 0 && (
                            <View style={[styles.barFill, { height: barH, backgroundColor: over ? T.warning : T.primary }]} />
                          )}
                        </View>

                        <Text
                          style={[
                            styles.barLabel,
                            b.isCurrent && { color: T.primary, fontWeight: '700' },
                            !b.avgKcal && !b.isCurrent && { color: T.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {calorieGoal != null && (
                <Text style={styles.chartLegend}>
                  Dashed line: your {calorieGoal.toLocaleString()} kcal goal. Amber bars are above it.
                </Text>
              )}
            </>
          )}
        </View>

        {/* Daily logs */}
        <View style={styles.logsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daily logs</Text>
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={isSubscribed ? () => setExportPickerOpen(true) : showPaywall}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={isSubscribed ? 'Export to Excel' : 'Export, requires Pro'}
            >
              {!isSubscribed && <Ionicons name="lock-closed" size={13} color={T.textMuted} />}
              <Text style={[styles.exportText, !isSubscribed && { color: T.textMuted }]}>Export</Text>
              {isSubscribed && <Ionicons name="download-outline" size={16} color={T.primary} />}
            </TouchableOpacity>
          </View>

          {status === 'loading' ? (
            <View style={styles.listLoading}>
              <ActivityIndicator color={T.primary} />
            </View>
          ) : status === 'error' ? (
            <View style={styles.dayCard}>
              <RetryRow onRetry={fetchWeekData} />
            </View>
          ) : (
            <>
              {isSubscribed && historyRange !== 7 && (
                <Text style={styles.rangeCaption}>
                  {loggedDayCount} day{loggedDayCount !== 1 ? 's' : ''} logged in the last {historyRange} days
                </Text>
              )}

              {daysToShow.map((day) => {
                const isExpanded = expandedDate === day.date;
                const isDayToday = day.date === today;
                const meta = day.mealCount > 0
                  ? `${day.mealCount} meal${day.mealCount !== 1 ? 's' : ''} · ${day.calories.toLocaleString()} kcal`
                  : isDayToday ? 'Start logging today' : 'Nothing logged';

                return (
                  <View key={day.date} style={[styles.dayCard, isExpanded && styles.dayCardExpanded]}>
                    <TouchableOpacity
                      style={styles.dayCardHeader}
                      onPress={() => toggleDay(day.date)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isExpanded }}
                      accessibilityLabel={`${day.dateLabel}. ${meta}`}
                    >
                      <View style={[styles.dateBadge, isExpanded && { backgroundColor: T.primaryTint }]}>
                        <Text style={styles.dateBadgeDow}>{day.dow}</Text>
                        <Text style={[styles.dateBadgeNum, isExpanded && { color: T.primary }]}>{day.dayNum}</Text>
                      </View>

                      <View style={styles.dayInfo}>
                        <Text style={styles.dayDateLabel}>{day.dateLabel}</Text>
                        <Text style={styles.dayMeta}>{meta}</Text>
                      </View>

                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={T.textMuted}
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.expandedBody}>
                        <View style={styles.expandDivider} />
                        {day.logs.length > 0 ? (
                          <>
                            {groupLogsIntoMeals(day.logs).map((meal) => {
                              const mealInfo = MEAL_ICONS[meal.mealType] ?? MEAL_ICONS.snack;
                              const isMulti = meal.logs.length > 1;
                              const mealOpen = expandedMeals.has(meal.key);
                              return (
                                <View key={meal.key} style={styles.mealBlock}>
                                  {/* Meal header — a single food shows its own name;
                                      a multi-item scan shows "Dinner · 5 items". */}
                                  <TouchableOpacity
                                    style={styles.logItem}
                                    onPress={isMulti ? () => toggleMeal(meal.key) : undefined}
                                    activeOpacity={isMulti ? 0.7 : 1}
                                    disabled={!isMulti}
                                    accessibilityRole={isMulti ? 'button' : undefined}
                                    accessibilityState={isMulti ? { expanded: mealOpen } : undefined}
                                  >
                                    <View style={styles.logLeft}>
                                      <Ionicons name={mealInfo.icon} size={18} color={mealInfo.color} />
                                      <View style={{ flex: 1 }}>
                                        <Text style={styles.logName} numberOfLines={1}>
                                          {isMulti
                                            ? `${MEAL_TYPE_LABEL[meal.mealType] ?? 'Meal'} · ${meal.logs.length} items`
                                            : meal.logs[0].food_name}
                                        </Text>
                                        <Text style={styles.mealTime}>{meal.time}</Text>
                                      </View>
                                    </View>
                                    <Text style={styles.logCal}>{meal.calories.toLocaleString()} kcal</Text>
                                    {isMulti && (
                                      <Ionicons
                                        name={mealOpen ? 'chevron-up' : 'chevron-down'}
                                        size={15}
                                        color={T.textMuted}
                                      />
                                    )}
                                  </TouchableOpacity>

                                  {/* Item breakdown — only for multi-item meals when opened */}
                                  {isMulti && mealOpen && (
                                    <View style={styles.mealItems}>
                                      {meal.logs.map((log, li) => (
                                        <View key={log.id ?? li} style={styles.subItem}>
                                          <Text style={styles.subItemName} numberOfLines={1}>{log.food_name}</Text>
                                          <Text style={styles.subItemCal}>{Math.round(log.calories)} kcal</Text>
                                        </View>
                                      ))}
                                    </View>
                                  )}
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
                  <Ionicons name="calendar-outline" size={28} color={T.textMuted} />
                  <Text style={styles.emptyRangeText}>No meals logged in the last {historyRange} days.</Text>
                </View>
              )}
            </>
          )}

          {/* Pro gate for older days */}
          {!isSubscribed && (
            <ProGate isSubscribed={false} onUpgrade={showPaywall} label="Full history, charts and export" borderRadius={16}>
              <View style={styles.dayCard}>
                <View style={styles.dayCardHeader}>
                  <View style={styles.dateBadge}>
                    <Ionicons name="calendar-outline" size={20} color={T.textMuted} />
                  </View>
                  <View style={styles.dayInfo}>
                    <Text style={styles.dayDateLabel}>30 and 90-day history, plus export</Text>
                    <Text style={styles.dayMeta}>Unlock with Pro</Text>
                  </View>
                </View>
              </View>
            </ProGate>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <CoachFab hidden={fabHidden} />

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
  root:   { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 40, gap: 20 },

  headerSection: { paddingHorizontal: 20, paddingTop: 16, gap: 4 },
  title:    { fontSize: 28, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22, color: T.textSecondary, fontWeight: '500' },

  chartCard: {
    marginHorizontal: 20,
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    gap: 16,
  },
  chartTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  chartCaption:   { fontSize: 13, fontWeight: '700', color: T.textMuted },
  chartAvgRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  chartBigNum:    { fontSize: 40, fontWeight: '800', color: T.primary, letterSpacing: -1, ...tabularNums },
  chartUnit:      { fontSize: 14, color: T.textSecondary, fontWeight: '500' },
  chartTrendBlock:{ alignItems: 'flex-end', gap: 2, maxWidth: '45%' },
  chartTrendLabel:{ fontSize: 12, fontWeight: '600', color: T.textMuted, textAlign: 'right' },
  chartTrendValue:{ fontSize: 18, fontWeight: '700', ...tabularNums },
  chartLoading:   { height: CHART_BAR_HEIGHT + VALUE_LABEL_H + AXIS_LABEL_H + BAR_GAP * 2, alignItems: 'center', justifyContent: 'center' },

  chartArea: { position: 'relative' },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: BAR_GAP },
  barValue: { fontSize: 13, lineHeight: VALUE_LABEL_H, fontWeight: '700', color: T.textSecondary, ...tabularNums },

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
  barLabel: { fontSize: 12, lineHeight: AXIS_LABEL_H, fontWeight: '600', color: T.textSecondary },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 1,
    borderColor: T.textSecondary,
    zIndex: 1,
  },
  chartBarNote: { fontSize: 12, fontWeight: '500', color: T.textSecondary, marginTop: -6 },
  chartLegend: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: T.textMuted },

  retryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14 },
  retryText: { flex: 1, fontSize: 14, color: T.textSecondary },
  retryBtn: { minHeight: HIT_TARGET, minWidth: HIT_TARGET, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: T.primaryTint },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: T.primary },
  listLoading: { paddingVertical: 32, alignItems: 'center' },

  logsSection:  { gap: 12, paddingHorizontal: 20 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: T.textPrimary },
  exportBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: HIT_TARGET, minWidth: HIT_TARGET, paddingHorizontal: 8, marginRight: -8, justifyContent: 'flex-end' },
  exportText:   { fontSize: 14, fontWeight: '700', color: T.primary },

  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 20,
    backgroundColor: T.divider,
    borderRadius: 12,
    padding: 4,
  },
  rangeChip: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 40,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeChipActive: { backgroundColor: T.primaryTint },
  rangeChipText: { fontSize: 13, fontWeight: '700', color: T.textMuted },
  rangeChipTextActive: { color: T.primary },
  rangeCaption: { fontSize: 12, fontWeight: '600', color: T.textMuted, marginTop: 2 },

  emptyRange: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  emptyRangeText: { fontSize: 13, color: T.textMuted, textAlign: 'center' },

  dayCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    marginBottom: 10,
  },
  dayCardExpanded: { borderLeftWidth: 3, borderLeftColor: T.primary },
  dayCardHeader:   { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },

  dateBadge:    { width: 48, height: 48, borderRadius: 10, backgroundColor: T.divider, alignItems: 'center', justifyContent: 'center', gap: 1 },
  dateBadgeDow: { fontSize: 12, fontWeight: '700', color: T.textMuted },
  dateBadgeNum: { fontSize: 20, fontWeight: '700', color: T.textPrimary, lineHeight: 22, ...tabularNums },

  dayInfo:      { flex: 1, gap: 3 },
  dayDateLabel: { fontSize: 15, fontWeight: '600', color: T.textPrimary },
  dayMeta:      { fontSize: 13, fontWeight: '600', color: T.textMuted, ...tabularNums },

  expandedBody:  { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  expandDivider: { height: 1, backgroundColor: T.divider, marginBottom: 4 },

  mealBlock: { gap: 6 },
  mealTime:  { fontSize: 12, color: T.textMuted, fontWeight: '600', marginTop: 1 },
  mealItems: {
    marginLeft: 28, marginBottom: 4, gap: 6,
    paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: T.border,
  },
  subItem:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subItemName: { flex: 1, fontSize: 13, color: T.textSecondary },
  subItemCal:  { fontSize: 13, fontWeight: '600', color: T.textMuted, ...tabularNums },

  logItem:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: HIT_TARGET },
  logLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  logName:  { fontSize: 14, color: T.textPrimary, flex: 1 },
  logCal:   { fontSize: 13, fontWeight: '700', color: T.textMuted, ...tabularNums },

  logTotalRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.divider },
  logTotalLabel:{ fontSize: 13, fontWeight: '700', color: T.textMuted },
  logTotalValue:{ fontSize: 15, fontWeight: '800', color: T.primary, ...tabularNums },

  noLogsText: { fontSize: 13, color: T.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
});
