import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { Profile } from '../store/authStore';

/**
 * Human-readable labels for the profile enums.
 *
 * The database stores `very_active` and `lose_weight`; nothing the user sees
 * should. Onboarding, the summary card and the profile editor all read from
 * here so the wording stays identical everywhere.
 */

export type BodyGoal = NonNullable<Profile['body_goal']>;
export type ActivityLevel = NonNullable<Profile['activity_level']>;
export type Gender = NonNullable<Profile['gender']>;

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface ProfileLabel {
  /** Short, sentence-case name shown as the row title. */
  label: string;
  /** One line under the title explaining what the choice means. */
  description: string;
  /** Ionicons glyph used in option rows and summary chips. */
  icon: IconName;
}

export const GOAL_LABELS: Record<BodyGoal, ProfileLabel> = {
  lose_weight: {
    label: 'Lose weight',
    description: 'About 500 kcal a day below maintenance for steady fat loss',
    icon: 'trending-down-outline',
  },
  maintain: {
    label: 'Maintain weight',
    description: 'Stay at your current weight',
    icon: 'scale-outline',
  },
  gain_muscle: {
    label: 'Build muscle',
    description: 'About 300 kcal a day above maintenance for lean gains',
    icon: 'barbell-outline',
  },
};

export const ACTIVITY_LABELS: Record<ActivityLevel, ProfileLabel> = {
  sedentary: {
    label: 'Sedentary',
    description: 'Little or no exercise',
    icon: 'bed-outline',
  },
  light: {
    label: 'Lightly active',
    description: 'Light exercise 1 to 3 days a week',
    icon: 'walk-outline',
  },
  moderate: {
    label: 'Moderately active',
    description: 'Moderate exercise 3 to 5 days a week',
    icon: 'bicycle-outline',
  },
  active: {
    label: 'Very active',
    description: 'Hard exercise 6 to 7 days a week',
    icon: 'fitness-outline',
  },
  very_active: {
    label: 'Extra active',
    description: 'Very hard exercise plus a physical job',
    icon: 'flash-outline',
  },
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Prefer not to say',
};

/** Display order for pick-one lists. */
export const GOAL_ORDER: readonly BodyGoal[] = ['lose_weight', 'maintain', 'gain_muscle'];
export const ACTIVITY_ORDER: readonly ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
export const GENDER_ORDER: readonly Gender[] = ['male', 'female', 'other'];
