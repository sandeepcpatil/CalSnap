import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import {
  computeStreak, buildStreakGrid, localDayKey, streakMessage,
  type GridDay, type StreakResult,
} from '../utils/streak';
import { T } from '../theme';

interface Props {
  userId: string;
  /** Bump to refetch after a new log. */
  refreshKey?: number;
}

const WEEKS = 5;
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Logging streak + a rolling 5-week consistency grid.
 *
 * Shown to free users too: the streak exists to bring people back, so gating
 * the main retention mechanic behind Pro would be self-defeating. Pro's value
 * is the analysis (macros, insights, export, long history), not "did I log on
 * Tuesday".
 */
export function StreakCard({ userId, refreshKey = 0 }: Props) {
  const [days, setDays] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    (async () => {
      // Only the timestamps are needed — not full rows — so this stays a tiny
      // payload and doesn't disturb the screen's range/Pro-gating logic.
      const from = new Date();
      from.setDate(from.getDate() - (WEEKS * 7 + 7));
      const { data, error } = await supabase
        .from('food_logs')
        .select('logged_at')
        .eq('user_id', userId)
        .gte('logged_at', from.toISOString());

      if (!active) return;
      if (error || !data) { setDays(new Set()); return; }
      // Convert to LOCAL day keys — a UTC slice would misplace late-night logs.
      setDays(new Set(data.map((r) => localDayKey(new Date(r.logged_at as string)))));
    })();

    return () => { active = false; };
  }, [userId, refreshKey]);

  const loggedDays = days ?? new Set<string>();
  const today = new Date();
  const streak: StreakResult = computeStreak(loggedDays, today);
  const grid = buildStreakGrid(loggedDays, today, WEEKS, 1);

  return (
    <View style={styles.card}>
      {/* Headline */}
      <View style={styles.topRow}>
        <View style={styles.streakBlock}>
          <View style={styles.flameRow}>
            <Ionicons
              name="flame"
              size={26}
              color={streak.current > 0 ? T.warning : T.textMuted}
            />
            <Text style={[styles.streakNum, streak.current === 0 && { color: T.textMuted }]}>
              {streak.current}
            </Text>
          </View>
          <Text style={styles.streakLabel}>DAY STREAK</Text>
        </View>

        <View style={styles.bestBlock}>
          <Text style={styles.bestNum}>{streak.longest}</Text>
          <Text style={styles.bestLabel}>LONGEST</Text>
        </View>
      </View>

      <Text style={styles.message}>{streakMessage(streak)}</Text>

      {/* Rolling 5-week grid */}
      <View style={styles.gridWrap}>
        <View style={styles.dowRow}>
          {DOW.map((d, i) => (
            <Text key={`${d}-${i}`} style={styles.dowLabel}>{d}</Text>
          ))}
        </View>
        {grid.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((day) => (
              <View key={day.key} style={styles.dotCell}>
                <Dot day={day} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function Dot({ day }: { day: GridDay }) {
  if (day.state === 'future') return <View style={[styles.dot, styles.dotFuture]} />;
  if (day.state === 'logged') return <View style={[styles.dot, styles.dotLogged]} />;
  if (day.state === 'today-pending') return <View style={[styles.dot, styles.dotToday]} />;
  return <View style={[styles.dot, styles.dotMissed]} />;
}

const DOT = 13;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    backgroundColor: T.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    gap: 14,
  },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  streakBlock: { gap: 2 },
  flameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakNum: {
    fontSize: 40, fontWeight: '800', color: T.textPrimary,
    letterSpacing: -1, lineHeight: 44, fontVariant: ['tabular-nums'],
  },
  streakLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: T.textMuted },

  bestBlock: { alignItems: 'flex-end', gap: 2 },
  bestNum: {
    fontSize: 20, fontWeight: '800', color: T.textSecondary,
    fontVariant: ['tabular-nums'], lineHeight: 24,
  },
  bestLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: T.textMuted },

  message: { fontSize: 13, color: T.textSecondary, fontWeight: '500', marginTop: -4 },

  gridWrap: { gap: 6 },
  dowRow: { flexDirection: 'row', marginBottom: 2 },
  dowLabel: {
    flex: 1, textAlign: 'center', fontSize: 11,
    fontWeight: '700', color: T.textMuted,
  },
  weekRow: { flexDirection: 'row' },
  dotCell: { flex: 1, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  dotLogged: { backgroundColor: T.primary },
  dotMissed: { backgroundColor: T.surface2 },
  dotToday: { backgroundColor: 'transparent', borderWidth: 2, borderColor: T.primary },
  dotFuture: { backgroundColor: 'transparent' },
});
