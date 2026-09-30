import { create } from 'zustand';
import type { ActivityLevel, BodyGoal, Gender } from '../constants/profileLabels';

/**
 * In-memory scratch state for the onboarding flow.
 *
 * Each step writes here instead of to the server, so going Back keeps what
 * was typed and a flaky connection cannot strand the user mid-flow. The
 * SummaryStep computes targets from these values and performs the single
 * profile write; nothing is persisted until that write succeeds.
 *
 * Text fields are kept as the raw strings the user typed so "72.5" survives
 * a round trip; `getOnboardingInputs` turns them into validated numbers.
 */

export const ONBOARDING_LIMITS = {
  age: { min: 10, max: 120 },
  weightKg: { min: 20, max: 300 },
  heightCm: { min: 100, max: 250 },
} as const;

export interface OnboardingFields {
  name: string;
  age: string;
  gender: Gender | null;
  weightKg: string;
  heightCm: string;
  activity: ActivityLevel | null;
  goal: BodyGoal | null;
}

interface OnboardingState extends OnboardingFields {
  setFields: (patch: Partial<OnboardingFields>) => void;
  reset: () => void;
}

const EMPTY: OnboardingFields = {
  name: '',
  age: '',
  gender: null,
  weightKg: '',
  heightCm: '',
  activity: null,
  goal: null,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...EMPTY,
  setFields: (patch) => set(patch),
  reset: () => set(EMPTY),
}));

/** Parses a typed value and checks it against an inclusive range. */
export function parseInRange(raw: string, range: { min: number; max: number }): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n >= range.min && n <= range.max ? n : null;
}

export interface OnboardingInputs {
  name: string;
  age: number;
  gender: Gender;
  weight_kg: number;
  height_cm: number;
  activity_level: ActivityLevel;
  body_goal: BodyGoal;
}

/** Fully validated values, or null while any step is still incomplete. */
export function getOnboardingInputs(s: OnboardingFields): OnboardingInputs | null {
  const name = s.name.trim();
  const age = parseInRange(s.age, ONBOARDING_LIMITS.age);
  const weight_kg = parseInRange(s.weightKg, ONBOARDING_LIMITS.weightKg);
  const height_cm = parseInRange(s.heightCm, ONBOARDING_LIMITS.heightCm);
  if (!name || age === null || weight_kg === null || height_cm === null) return null;
  if (!s.gender || !s.activity || !s.goal) return null;
  return {
    name,
    age,
    gender: s.gender,
    weight_kg,
    height_cm,
    activity_level: s.activity,
    body_goal: s.goal,
  };
}
