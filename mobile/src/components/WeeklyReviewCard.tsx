import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { T, type, spacing, radius, tabularNums } from '../theme';
import {
  daysLoggedLine,
  formatKcal,
  proteinLine,
  type WeeklyReviewData,
} from '../utils/weeklyReview';

interface Props {
  data: WeeklyReviewData;
}

/** The calorie bar runs to 1.2× target so an over-target week still fits. */
const BAR_HEADROOM = 1.2;

/**
 * The one card that gets shared: a 4:5 portrait in app colours with the
 * week's three numbers and one line for next week. It is a plain View so the
 * same component renders from the server recap or from on-device stats.
 */
export function WeeklyReviewCard({ data }: Props) {
  const empty = data.daysLogged === 0;
  const goal = data.calorieGoal;
  const fill = goal ? Math.min(1, data.avgCalories / (goal * BAR_HEADROOM)) : 0;
  const targetPos = goal ? 1 / BAR_HEADROOM : 0;
  const over = goal != null && data.avgCalories > goal;

  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={
        empty
          ? `Week ${data.weekLabel}. Nothing logged this week yet.`
          : `Week ${data.weekLabel}. ${formatKcal(data.avgCalories)} kilocalories a day on average${goal ? `, target ${formatKcal(goal)}` : ''}. ${proteinLine(data)}. ${daysLoggedLine(data)}.${data.nextWeek ? ` Next week: ${data.nextWeek}.` : ''}`
      }
    >
      <Text style={styles.kicker}>Week of {data.weekLabel}</Text>

      {empty ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Nothing logged this week yet.</Text>
        </View>
      ) : (
        <View style={styles.body}>
          {/* Calories vs target */}
          <View style={styles.calories}>
            <View style={styles.calRow}>
              <Text style={styles.calValue}>{formatKcal(data.avgCalories)}</Text>
              <Text style={styles.calUnit}>kcal a day</Text>
            </View>
            {goal != null ? (
              <>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round(fill * 100)}%` }, over && styles.fillOver]} />
                  <View style={[styles.targetTick, { left: `${Math.round(targetPos * 100)}%` }]} />
                </View>
                <Text style={styles.calCaption}>Target {formatKcal(goal)} kcal</Text>
              </>
            ) : (
              <Text style={styles.calCaption}>No calorie target set</Text>
            )}
          </View>

          {/* Protein and days */}
          <View style={styles.lines}>
            <Text style={styles.line}>{proteinLine(data)}</Text>
            <Text style={styles.line}>{daysLoggedLine(data)}</Text>
          </View>

          {data.nextWeek && (
            <View style={styles.next}>
              <Text style={styles.nextLabel}>Next week</Text>
              <Text style={styles.nextText}>{data.nextWeek}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.wordmark}>
          Cal<Text style={styles.wordmarkAccent}>Vue</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 4 / 5,
    padding: spacing['2xl'],
    borderRadius: radius.lg,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    justifyContent: 'space-between',
  },
  kicker: { ...type.label, color: T.textSecondary },

  body: { flex: 1, justifyContent: 'center', gap: spacing['2xl'] },

  calories: { gap: spacing.sm },
  calRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  calValue: { ...type.display, color: T.textPrimary },
  calUnit: { ...type.body, color: T.textSecondary },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: T.surface2,
    overflow: 'visible',
    marginTop: spacing.xs,
  },
  fill: { height: 4, borderRadius: 2, backgroundColor: T.primary },
  fillOver: { backgroundColor: T.warning },
  targetTick: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 12,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: T.textSecondary,
  },
  calCaption: { ...type.bodySm, color: T.textSecondary, ...tabularNums },

  lines: { gap: spacing.xs },
  line: { ...type.body, fontWeight: '600', color: T.textPrimary, ...tabularNums },

  next: { gap: 2 },
  nextLabel: { ...type.label, color: T.primary },
  nextText: { ...type.body, color: T.textPrimary },

  emptyWrap: { flex: 1, justifyContent: 'center' },
  emptyText: { ...type.body, color: T.textSecondary },

  footer: { flexDirection: 'row', justifyContent: 'flex-end' },
  wordmark: { ...type.bodySm, fontWeight: '800', letterSpacing: 0.2, color: T.textPrimary },
  wordmarkAccent: { color: T.primary },
});
