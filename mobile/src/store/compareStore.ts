import { create } from 'zustand';
import type { LabelScanData } from '../services/api';

/** One product in the compare tray. */
export interface CompareItem {
  /** Stable identity: the barcode when there is one, else name + brand. */
  key: string;
  barcode?: string;
  result: LabelScanData;
  /** Local or remote image; may be empty for a label scan with no photo. */
  imageUri: string;
}

export const COMPARE_MAX = 3;

export type CompareAddOutcome = 'added' | 'duplicate' | 'full';

interface CompareState {
  items: CompareItem[];
  add: (item: Omit<CompareItem, 'key'>) => CompareAddOutcome;
  remove: (key: string) => void;
  clear: () => void;
}

/** Name + brand, case-folded, so the same product scanned two ways dedupes. */
function nameKey(result: LabelScanData): string {
  return `name:${result.product_name.trim().toLowerCase()}|${result.brand.trim().toLowerCase()}`;
}

/** The key an item would get, for "is this already in the tray" checks. */
export function compareKeyFor(result: LabelScanData, barcode?: string): string {
  return barcode ? `bc:${barcode}` : nameKey(result);
}

function isDuplicate(items: CompareItem[], result: LabelScanData, barcode?: string): boolean {
  const byName = nameKey(result);
  return items.some(
    (i) => (!!barcode && i.barcode === barcode) || nameKey(i.result) === byName,
  );
}

/**
 * Up to three scanned products held side by side. In memory only: the tray
 * is a scratch space for one shopping trip, not a record, so it empties when
 * the app restarts.
 */
export const useCompareStore = create<CompareState>((set, get) => ({
  items: [],
  add: ({ barcode, result, imageUri }) => {
    const { items } = get();
    if (isDuplicate(items, result, barcode)) return 'duplicate';
    if (items.length >= COMPARE_MAX) return 'full';
    set({ items: [...items, { key: compareKeyFor(result, barcode), barcode, result, imageUri }] });
    return 'added';
  },
  remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
  clear: () => set({ items: [] }),
}));

/** True when this product (by barcode or name + brand) is already in the tray. */
export function isInCompare(items: CompareItem[], result: LabelScanData, barcode?: string): boolean {
  return isDuplicate(items, result, barcode);
}
