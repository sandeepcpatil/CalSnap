-- =============================================================
-- CalSnap Database Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================

-- ---------------------------------------------------------------
-- 1. profiles — extends auth.users
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id                    UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email                 TEXT,
  name                  TEXT,
  avatar_url            TEXT,
  weight_kg             DECIMAL,
  height_cm             DECIMAL,
  age                   INTEGER,
  gender                TEXT CHECK (gender IN ('male', 'female', 'other')),
  activity_level        TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  body_goal             TEXT CHECK (body_goal IN ('lose_weight', 'maintain', 'gain_muscle')),
  daily_calorie_goal    INTEGER,
  daily_protein_goal    INTEGER,
  scan_count            INTEGER DEFAULT 0 NOT NULL,
  daily_scan_count      INTEGER DEFAULT 0 NOT NULL,
  daily_scan_reset_at   DATE DEFAULT CURRENT_DATE NOT NULL,
  is_subscribed         BOOLEAN DEFAULT false NOT NULL,
  subscription_tier     TEXT CHECK (subscription_tier IN ('free', 'monthly', 'annual')) DEFAULT 'free' NOT NULL,
  subscription_end_date TIMESTAMPTZ,
  trial_end_date        TIMESTAMPTZ,
  razorpay_customer_id  TEXT,
  onboarding_complete   BOOLEAN DEFAULT false NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ---------------------------------------------------------------
-- 2. food_logs
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_logs (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  image_url        TEXT,
  food_name        TEXT NOT NULL,
  calories         INTEGER NOT NULL,
  protein_g        DECIMAL NOT NULL DEFAULT 0,
  carbs_g          DECIMAL NOT NULL DEFAULT 0,
  fat_g            DECIMAL NOT NULL DEFAULT 0,
  fiber_g          DECIMAL NOT NULL DEFAULT 0,
  meal_type        TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  raw_ai_response  JSONB,
  logged_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for dashboard queries (user's logs by date)
CREATE INDEX IF NOT EXISTS idx_food_logs_user_logged_at ON food_logs (user_id, logged_at DESC);

-- ---------------------------------------------------------------
-- 3. subscriptions
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  plan                      TEXT CHECK (plan IN ('monthly', 'annual')) NOT NULL,
  status                    TEXT CHECK (status IN ('active', 'cancelled', 'expired')) NOT NULL DEFAULT 'active',
  razorpay_subscription_id  TEXT UNIQUE,
  amount_paise              INTEGER NOT NULL,
  started_at                TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ends_at                   TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions (user_id, status);

-- ---------------------------------------------------------------
-- 4. admin_users
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id    UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL
);

-- ---------------------------------------------------------------
-- 5. Row Level Security (RLS)
-- ---------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- profiles: users can only see and edit their own row
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- food_logs: users can only see and edit their own rows
CREATE POLICY "food_logs_select_own"
  ON food_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "food_logs_insert_own"
  ON food_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "food_logs_update_own"
  ON food_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "food_logs_delete_own"
  ON food_logs FOR DELETE
  USING (auth.uid() = user_id);

-- subscriptions: users can only see their own
CREATE POLICY "subscriptions_select_own"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- admin_users: only admins can read (checked server-side via service role)
CREATE POLICY "admin_users_no_public_access"
  ON admin_users FOR ALL
  USING (false);

-- ---------------------------------------------------------------
-- 6. Trigger: auto-create profile row on new auth user sign-up
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
    SET avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ---------------------------------------------------------------
-- 7. scan_cache — avoid re-calling AI for identical images
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_cache (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image_hash    TEXT UNIQUE NOT NULL,  -- SHA-256 of the image bytes
  food_name     TEXT NOT NULL,
  calories      INTEGER NOT NULL,
  protein_g     DECIMAL NOT NULL DEFAULT 0,
  carbs_g       DECIMAL NOT NULL DEFAULT 0,
  fat_g         DECIMAL NOT NULL DEFAULT 0,
  fiber_g       DECIMAL NOT NULL DEFAULT 0,
  ai_response   JSONB NOT NULL,
  hit_count     INTEGER DEFAULT 1 NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_hit_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_cache_hash ON scan_cache (image_hash);

-- scan_cache is read by anyone authenticated (no user-scoped data here)
ALTER TABLE scan_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_cache_read_authenticated"
  ON scan_cache FOR SELECT
  USING (auth.role() = 'authenticated');
-- Only service role can insert/update (backend uses service key)

-- ---------------------------------------------------------------
-- 8. RLS policy: gate food_log history for free users
--    Free users can only see logs from the last 3 days
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "food_logs_select_own" ON food_logs;
CREATE POLICY "food_logs_select_own"
  ON food_logs FOR SELECT
  USING (
    auth.uid() = user_id
    AND (
      -- Subscribed users see all history
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND is_subscribed = true
        AND (subscription_end_date IS NULL OR subscription_end_date > NOW())
      )
      OR
      -- Free users only see last 3 days
      logged_at >= NOW() - INTERVAL '3 days'
    )
  );

-- ---------------------------------------------------------------
-- 9. Function: reset daily scan count (call via pg_cron or on-demand)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_daily_scan_counts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET daily_scan_count = 0,
      daily_scan_reset_at = CURRENT_DATE
  WHERE daily_scan_reset_at < CURRENT_DATE;
END;
$$;

-- ---------------------------------------------------------------
-- 10. Function: increment_scan_count (updated to handle daily reset)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_scan_count(user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET
    scan_count = scan_count + 1,
    daily_scan_count = CASE
      WHEN daily_scan_reset_at < CURRENT_DATE THEN 1
      ELSE daily_scan_count + 1
    END,
    daily_scan_reset_at = CURRENT_DATE
  WHERE id = user_id;
END;
$$;

-- ---------------------------------------------------------------
-- 11. Storage bucket setup instructions (run in Supabase Dashboard)
-- ---------------------------------------------------------------
-- In Supabase Storage, create a bucket named "food-images":
--   - Private bucket (not public)
--   - Set a lifecycle rule for 90-day deletion
--
-- Storage policy (allow authenticated users to upload their own files):
-- INSERT policy: (auth.uid()::text = (storage.foldername(name))[1])
-- SELECT policy: (auth.uid()::text = (storage.foldername(name))[1])
