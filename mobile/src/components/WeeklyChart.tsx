import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { supabase } from '../services/supabase';
import { useTheme } from '../hooks/useTheme';

interface Props {
  userId: string;
  calorieGoal: number;
}

const { width } = Dimensions.get('window');

export function WeeklyChart({ userId, calorieGoal }: Props) {
  const [data, setData] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const { theme } = useTheme();

  useEffect(() => {
    if (!userId) return;

    const fetchWeekData = async () => {
      const days: string[] = [];
      const results: number[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        days.push(d.toLocaleDateString('en-IN', { weekday: 'short' }));

        const { data: logs } = await supabase
          .from('food_logs')
          .select('calories')
          .eq('user_id', userId)
          .gte('logged_at', `${dateStr}T00:00:00.000Z`)
          .lte('logged_at', `${dateStr}T23:59:59.999Z`);

        const total = logs?.reduce((s, l) => s + (l.calories || 0), 0) ?? 0;
        results.push(total);
      }

      setLabels(days);
      setData(results);
    };

    fetchWeekData();
  }, [userId]);

  if (data.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBg }]}>
      <Text variant="titleSmall" style={[styles.title, { color: theme.textPrimary }]}>7-Day Trend</Text>
      <LineChart
        data={{
          labels,
          datasets: [
            { data, color: () => theme.primary, strokeWidth: 2 },
            {
              data: Array(7).fill(calorieGoal),
              color: () => '#ef9a9a',
              strokeWidth: 1.5,
              withDots: false,
            },
          ],
          legend: ['Calories', 'Goal'],
        }}
        width={width - 40}
        height={180}
        yAxisSuffix=" kcal"
        chartConfig={{
          backgroundColor: theme.cardBg,
          backgroundGradientFrom: theme.cardBg,
          backgroundGradientTo:   theme.cardBg,
          decimalPlaces: 0,
          color: (opacity = 1) => theme.primary + Math.round(opacity * 255).toString(16).padStart(2, '0'),
          labelColor: () => theme.textMuted,
          propsForDots: { r: '4', strokeWidth: '2', stroke: theme.primary },
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  title: { fontWeight: '700', marginBottom: 12 },
  chart: { marginLeft: -16, borderRadius: 12 },
});
