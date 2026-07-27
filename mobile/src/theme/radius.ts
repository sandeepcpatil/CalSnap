/**
 * Corner radii — 13 values (6, 9, 10, 12, 14, 16, 17, 18, 20, 22, 28, 40, 50)
 * collapse to 4.
 */
export const radius = {
  sm: 10,   // chips, tags, small wells
  md: 14,   // buttons, inputs
  lg: 20,   // cards, sheets
  pill: 999, // toggles, badges, avatars
} as const;

export type Radius = typeof radius;
