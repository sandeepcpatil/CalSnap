-- =============================================================
-- 001 · water_logs — hydration tracking
--
-- Water is deliberately NOT a `food_logs` row. Every calorie total,
-- macro chart, streak and CSV export in the app derives from
-- `food_logs`, so a zero-calorie row there would have to be filtered
-- out in a dozen places — and one missed filter silently corrupts a
-- day's nutrition. A separate table keeps the two models honest.
--
-- Idempotent: safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS water_logs (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  -- Bounded so a fat-fingered custom entry can't poison the day's total.
  amount_ml  INTEGER NOT NULL CHECK (amount_ml > 0 AND amount_ml <= 5000),
  logged_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Same access pattern as food_logs: "this user's rows for this day".
CREATE INDEX IF NOT EXISTS idx_water_logs_user_logged_at
  ON water_logs (user_id, logged_at DESC);

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "water_logs_select_own" ON water_logs;
CREATE POLICY "water_logs_select_own"
  ON water_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "water_logs_insert_own" ON water_logs;
CREATE POLICY "water_logs_insert_own"
  ON water_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "water_logs_delete_own" ON water_logs;
CREATE POLICY "water_logs_delete_own"
  ON water_logs FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- profiles — hydration goal + the user's own saved vessel
-- ---------------------------------------------------------------
-- Nullable rather than DEFAULT 3000: the app falls back to a goal
-- derived from body weight when this is unset, and a stamped default
-- would make "never chosen" indistinguishable from "chose 3 L".
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_water_ml_goal INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_vessel_ml    INTEGER;
