import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { logOutPurchases } from '../services/purchases';

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  gender: 'male' | 'female' | 'other' | null;
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | null;
  body_goal: 'lose_weight' | 'maintain' | 'gain_muscle' | null;
  daily_calorie_goal: number | null;
  daily_protein_goal: number | null;
  /** Null until the user sets one — the app derives a goal from weight instead. */
  daily_water_ml_goal: number | null;
  /** The user's own reusable bottle, saved once and offered as a one-tap vessel. */
  custom_vessel_ml: number | null;
  /** Optional goal weight, so weight tracking can show an ETA. */
  target_weight_kg: number | null;
  /** Beta access to the AI nutrition coach. */
  chat_beta: boolean;
  scan_count: number;
  daily_scan_count: number;
  daily_scan_reset_at: string;
  is_subscribed: boolean;
  subscription_tier: 'free' | 'monthly' | 'annual';
  subscription_end_date: string | null;
  trial_end_date: string | null;
  onboarding_complete: boolean;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  /** True when the profile shown came from cache and hasn't been refreshed yet. */
  profileStale: boolean;
  /** Disk cache has finished loading. */
  hydrated: boolean;
  /** A first profile fetch has settled (succeeded OR failed). */
  profileResolved: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setHydrated: () => void;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * The profile is cached to disk so a cold start with no network still knows the
 * user is subscribed. Without it, `fetchProfile` fails offline, `profile` stays
 * null, and `useSubscriptionGate` reads `is_subscribed ?? false` — showing a
 * paying subscriber the Pro upsell.
 *
 * Safe to trust locally because it is only a UI signal: the scan limit is
 * enforced server-side in `enforceScanGate`, which reads the database directly.
 * A tampered cache unlocks nothing real.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  profileStale: false,
  hydrated: false,
  profileResolved: false,

  setSession: (session) => {
    // Drop a cached profile that belongs to a different account — otherwise a
    // second user signing in on this device would briefly inherit the previous
    // user's Pro status from disk.
    const cached = get().profile;
    const mismatched = !!cached && !!session?.user.id && cached.id !== session.user.id;
    set({
      session,
      user: session?.user ?? null,
      isLoading: false,
      ...(mismatched ? { profile: null, profileStale: false } : {}),
    });
  },

  setProfile: (profile) => set({ profile }),

  setHydrated: () => set({ hydrated: true }),

  fetchProfile: async () => {
    const { session } = get();
    if (!session?.user.id) { set({ profileResolved: true }); return; }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error || !data) {
      // Offline or transient failure — keep whatever we cached rather than
      // downgrading the user to "free" until the next successful fetch.
      if (get().profile) set({ profileStale: true });
      set({ profileResolved: true });
      return;
    }

    {
      // If the DB row has no avatar, fall back to Google's metadata
      if (!data.avatar_url) {
        const meta = session.user.user_metadata;
        const googleAvatar =
          meta?.avatar_url || meta?.picture || null;
        if (googleAvatar) {
          data.avatar_url = googleAvatar;
          // Persist it so next fetch doesn't need the fallback
          await supabase
            .from('profiles')
            .update({ avatar_url: googleAvatar })
            .eq('id', session.user.id);
        }
      }
      set({ profile: data as Profile, profileStale: false, profileResolved: true });
    }
  },

  updateProfile: async (updates) => {
    const { session, profile } = get();
    if (!session?.user.id) return;

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id)
      .select()
      .single();

    if (!error && data) {
      set({ profile: { ...profile, ...data } as Profile });
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore network errors — we still clear local state below.
    }
    await logOutPurchases();
    set({ session: null, user: null, profile: null, profileStale: false, profileResolved: false });
  },
    }),
    {
      name: 'calsnap-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // Only the profile is cached. The session is owned by supabase-js, which
      // has its own storage and refresh handling — duplicating it here would
      // risk resurrecting a signed-out or expired session.
      partialize: (s) => ({ profile: s.profile }),
      // Startup waits on this so gated UI never renders against an unknown
      // subscription state.
      onRehydrateStorage: () => (state) => { state?.setHydrated(); },
    },
  ),
);
