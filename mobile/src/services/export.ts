import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import type { FoodLog } from '../store/foodLogStore';
import { macroCalorieSplit } from '../utils/nutrition';

export interface ExportDay {
  /** ISO YYYY-MM-DD */
  date: string;
  /** Human label, e.g. "12 July 2026" */
  dateLabel: string;
  logs: FoodLog[];
}

// ── Export range presets ────────────────────────────────────────────────────
export type ExportRangeKey = 'week' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth';

export interface ResolvedRange {
  key: ExportRangeKey;
  label: string;
  /** Inclusive YYYY-MM-DD bounds. */
  startDate: string;
  endDate: string;
}

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

/** Resolve a preset into concrete inclusive date bounds. Pure — `now` is injectable. */
export function resolveExportRange(key: ExportRangeKey, now: Date = new Date()): ResolvedRange {
  const end = new Date(now);
  const start = new Date(now);
  switch (key) {
    case 'week':
      start.setDate(end.getDate() - 6);
      return { key, label: 'This week', startDate: isoDate(start), endDate: isoDate(end) };
    case 'last30':
      start.setDate(end.getDate() - 29);
      return { key, label: 'Last 30 days', startDate: isoDate(start), endDate: isoDate(end) };
    case 'last90':
      start.setDate(end.getDate() - 89);
      return { key, label: 'Last 90 days', startDate: isoDate(start), endDate: isoDate(end) };
    case 'thisMonth': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { key, label: 'This month', startDate: isoDate(s), endDate: isoDate(end) };
    }
    case 'lastMonth': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0); // day 0 = last day of prev month
      return { key, label: 'Last month', startDate: isoDate(s), endDate: isoDate(e) };
    }
  }
}

/** Format an ISO YYYY-MM-DD as "12 July 2026" for sheet rows. */
export function formatDayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Group raw logs into date-sorted ExportDay buckets (only days that have logs). */
export function groupLogsByDay(logs: FoodLog[]): ExportDay[] {
  const byDay: Record<string, FoodLog[]> = {};
  logs.forEach((l) => {
    const day = l.logged_at.slice(0, 10);
    (byDay[day] ??= []).push(l);
  });
  return Object.keys(byDay)
    .sort()
    .map((date) => ({ date, dateLabel: formatDayLabel(date), logs: byDay[date] }));
}

const round = (n: number) => Math.round(n * 10) / 10;

function sumLogs(logs: FoodLog[]) {
  return logs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories || 0),
      protein: acc.protein + (l.protein_g || 0),
      carbs: acc.carbs + (l.carbs_g || 0),
      fat: acc.fat + (l.fat_g || 0),
      fiber: acc.fiber + (l.fiber_g || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

/**
 * Build a two-sheet workbook (daily summary + per-meal detail) from the user's
 * logs and hand it to the OS share sheet as a real .xlsx file.
 * Returns false if there is nothing to export.
 */
export async function exportHistoryToExcel(days: ExportDay[]): Promise<boolean> {
  const daysWithData = days.filter((d) => d.logs.length > 0);
  if (daysWithData.length === 0) return false;

  // ── Sheet 1: Daily Summary ──
  const summaryRows = daysWithData.map((d) => {
    const t = sumLogs(d.logs);
    const split = macroCalorieSplit(t.protein, t.carbs, t.fat);
    const mealTypes = new Set(d.logs.map((l) => l.meal_type).filter(Boolean));
    return {
      Date: d.dateLabel,
      Calories: Math.round(t.calories),
      'Protein (g)': round(t.protein),
      'Carbs (g)': round(t.carbs),
      'Fat (g)': round(t.fat),
      'Fiber (g)': round(t.fiber),
      'Protein %': Math.round(split.proteinPct),
      'Carbs %': Math.round(split.carbsPct),
      'Fat %': Math.round(split.fatPct),
      Meals: mealTypes.size,
      Items: d.logs.length,
    };
  });

  // Grand-total footer row.
  const grand = daysWithData.reduce(
    (acc, d) => {
      const t = sumLogs(d.logs);
      return {
        calories: acc.calories + t.calories,
        protein: acc.protein + t.protein,
        carbs: acc.carbs + t.carbs,
        fat: acc.fat + t.fat,
        fiber: acc.fiber + t.fiber,
        items: acc.items + d.logs.length,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, items: 0 },
  );
  const n = daysWithData.length;
  summaryRows.push({
    Date: `Average (${n} day${n !== 1 ? 's' : ''})`,
    Calories: Math.round(grand.calories / n),
    'Protein (g)': round(grand.protein / n),
    'Carbs (g)': round(grand.carbs / n),
    'Fat (g)': round(grand.fat / n),
    'Fiber (g)': round(grand.fiber / n),
    'Protein %': 0,
    'Carbs %': 0,
    'Fat %': 0,
    Meals: 0,
    Items: grand.items,
  });

  // ── Sheet 2: Meal Detail ──
  const detailRows = daysWithData.flatMap((d) =>
    d.logs
      .slice()
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
      .map((l) => ({
        Date: d.dateLabel,
        Meal: (l.meal_type ?? 'snack').replace(/^\w/, (c) => c.toUpperCase()),
        Food: l.food_name,
        Calories: Math.round(l.calories || 0),
        'Protein (g)': round(l.protein_g || 0),
        'Carbs (g)': round(l.carbs_g || 0),
        'Fat (g)': round(l.fat_g || 0),
        'Fiber (g)': round(l.fiber_g || 0),
      })),
  );

  const wb = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  const detailSheet = XLSX.utils.json_to_sheet(detailRows);
  summarySheet['!cols'] = [{ wch: 22 }, { wch: 9 }, { wch: 11 }, { wch: 10 }, { wch: 8 }, { wch: 9 }, { wch: 10 }, { wch: 9 }, { wch: 7 }, { wch: 7 }, { wch: 7 }];
  detailSheet['!cols'] = [{ wch: 22 }, { wch: 11 }, { wch: 28 }, { wch: 9 }, { wch: 11 }, { wch: 10 }, { wch: 8 }, { wch: 9 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Daily Summary');
  XLSX.utils.book_append_sheet(wb, detailSheet, 'Meal Detail');

  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  const stamp = new Date().toISOString().slice(0, 10);
  const uri = `${FileSystem.cacheDirectory}CalSnap-Nutrition-${stamp}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Export CalSnap nutrition data',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
  return true;
}
