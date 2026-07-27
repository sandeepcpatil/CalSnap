/**
 * 4pt spacing scale. Replaces the ad-hoc 6/8/10/12/14/16/18/20/22/24/28/32
 * values that were scattered across screens.
 *
 * Screen gutter is `xl` (20) everywhere — previously 16/20/24/28 were mixed.
 */
export const spacing = {
  xs: 4,    // icon-to-text
  sm: 8,    // chip gaps, tight stacks
  md: 12,   // list row gaps, card gaps
  lg: 16,   // card padding (compact)
  xl: 20,   // screen gutter, card padding
  '2xl': 24, // section spacing
  '3xl': 32, // hero padding
  '4xl': 48, // screen-level breathing room
} as const;

/** Minimum interactive target (accessibility floor). */
export const HIT_TARGET = 44;

export type Spacing = typeof spacing;
