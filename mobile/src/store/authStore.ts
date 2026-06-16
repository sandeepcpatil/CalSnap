import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

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
  scan_count: number;
  is_subscribed: boolean;
  subscription_end_date: string | null;
  onboarding_complete: boolean;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,

  setSession: (session) => {
    set({ session, user: session?.user ?? null, isLoading: false });
  },

  setProfile: (profile) => set({ profile }),

  fetchProfile: async () => {
    const { session } = get();
    if (!session?.user.id) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (!error && data) {
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
      set({ profile: data as Profile });
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
    console.log('[authStore] signOut called');
    try {
      await supabase.auth.signOut();
      console.log('[authStore] supabase.auth.signOut() succeeded');
    } catch (e) {
      console.warn('[authStore] signOut network error (ignored):', e);
    }
    set({ session: null, user: null, profile: null });
    console.log('[authStore] local state cleared');
  },
}));
