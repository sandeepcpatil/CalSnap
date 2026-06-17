import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MacroData {
  protein_g: number;
  carbs_g:   number;
  fat_g:     number;
  fiber_g:   number;
}

interface MacroPieChartProps {
  data: MacroData;
  /** Width of the chart — defaults to screen width minus 32px padding */
  width?: number;
  style?: ViewStyle;
}

interface LegendItem {
  label: string;
  value: number;
  unit: string;
  color: string;
  tint: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * A macro breakdown pie chart that reads colours from the active theme.
 * Works correctly in both light and dark mode.
 *
 * @example
 * <MacroPieChart data={{ protein_g: 45, carbs_g: 120, fat_g: 30, fiber_g: 8 }} />
 */
export function MacroPieChart({ data, width, style }: MacroPieChartProps) {
  const { theme, isDark } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const chartWidth  = width ?? screenWidth - 32;

  const total = data.protein_g + data.carbs_g + data.fat_g + data.fiber_g;

  // If no data yet, render a placeholder ring
  const isEmpty = total <= 0;

  const legend: LegendItem[] = [
    { label: 'Protein', value: data.protein_g, unit: 'g', color: theme.protein, tint: theme.proteinTint },
    { label: 'Carbs',   value: data.carbs_g,   unit: 'g', color: theme.carbs,   tint: theme.carbsTint   },
    { label: 'Fat',     value: data.fat_g,     unit: 'g', color: theme.fat,     tint: theme.fatTint     },
    { label: 'Fiber',   value: data.fiber_g,   unit: 'g', color: theme.fiber,   tint: theme.fiberTint   },
  ];

  // chart-kit requires the data to sum > 0 — substitute with equal slices when empty
  const chartData = isEmpty
    ? legend.map((l) => ({
        name:       l.label,
        population: 1,
        color:      theme.borderColor,
        legendFontColor: theme.textMuted,
        legendFontSize:  0,
      }))
    : legend.map((l) => ({
        name:       l.label,
        population: Math.max(l.value, 0.001), // guard against zero slices
        color:      l.color,
        legendFontColor: theme.textPrimary,
        legendFontSize:  0, // we render our own legend below
      }));

  return (
    <ThemedView variant="card" style={[styles.container, style]}>
      {/* Title */}
      <ThemedText variant="label" style={styles.title}>Macro Breakdown</ThemedText>

      {/* Pie chart */}
      <PieChart
        data={chartData}
        width={chartWidth - 32} // subtract card padding
        height={180}
        chartConfig={{
          backgroundColor:      theme.cardBg,
          backgroundGradientFrom: theme.cardBg,
          backgroundGradientTo:   theme.cardBg,
          color: (opacity = 1) =>
            // theme-aware grid/label colour — not used visually in pie but required by the API
            isDark
              ? `rgba(226,245,235,${opacity})`
              : `rgba(26,43,26,${opacity})`,
          labelColor: (opacity = 1) =>
            isDark
              ? `rgba(226,245,235,${opacity})`
              : `rgba(26,43,26,${opacity})`,
        }}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="16"
        absolute={false}
        hasLegend={false} // we render a richer custom legend
      />

      {/* Custom legend — 2-column grid */}
      <View style={styles.legend}>
        {legend.map((item) => {
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
          return (
            <View
              key={item.label}
              style={[styles.legendItem, { backgroundColor: item.tint }]}
            >
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <View style={styles.legendText}>
                <ThemedText variant="caption" muted>{item.label}</ThemedText>
                <ThemedText variant="label" color={item.color}>
                  {Math.round(item.value)}{item.unit}
                  <ThemedText variant="caption" muted>  {pct}%</ThemedText>
                </ThemedText>
              </View>
            </View>
          );
        })}
      </View>

      {isEmpty && (
        <ThemedText variant="caption" muted style={styles.emptyLabel}>
          Log a meal to see your macro breakdown
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    gap: 8,
  },
  title: {
    marginBottom: 4,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    flex: 1,
    minWidth: '44%',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    gap: 1,
  },
  emptyLabel: {
    textAlign: 'center',
    marginTop: 4,
  },
});
