import type { TextStyle } from 'react-native';

/**
 * Type scale — replaces 16 ad-hoc sizes (8, 9, 10, 10.5, 11, 11.5, 12, 12.5,
 * 13, 14, 14.5, 15, 16, 18, 20…) found across the screens.
 *
 * Rules:
 * - Nothing below 11px (`caption` is the floor — kills the old 8–10px text).
 * - Weights limited to 500 / 600 / 700 / 800.
 * - Every numeric figure uses tabular numerals so digits don't jiggle as
 *   values tick (calories, macros, scores).
 */

/** Apply to any live/changing number so glyph widths stay fixed. */
export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = {
  /** 44/48 · 800 — calorie ring & health score only. */
  display: { fontSize: 44, lineHeight: 48, fontWeight: '800', letterSpacing: -1, ...tabularNums },
  /** 28/34 · 800 — screen titles. */
  headline: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  /** 20/26 · 700 — section heads. */
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2 },
  /** 17/22 · 700 — card titles. */
  titleSm: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  /** 15/22 · 500 — body copy. */
  body: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  /** 13/18 · 500 — secondary lines, metadata. */
  bodySm: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  /** 12/16 · 700 · +1 tracking, caps — eyebrow labels. */
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  /** 11/14 · 600 — the floor. Nothing smaller. */
  caption: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
} as const satisfies Record<string, TextStyle>;

export type TypeScale = typeof type;
