-- =============================================================
-- 003 · weight_logs — body-weight history + a target to trend toward
--
-- The app stored a single `profiles.weight_kg` (used by the calorie and
-- water goals). That one number can't show a trend, so weigh-ins get
-- their own table. Logging a new weight also updates `profiles.weight_kg`
-- (done app-side) so the goals stay in sync with the latest reading.
--
-- Idempotent: safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS weight_logs (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  -- Bounded so a fat-fingered entry (grams instead of kg, say) can't wreck
  -- the trend line.
  weight_kg  DECIMAL NOT NULL CHECK (weight_kg > 20 AND weight_kg < 500),
  logged_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weight_logs_user_logged_at
  ON weight_logs (user_id, logged_at DESC);

ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weight_logs_select_own" ON weight_logs;
CREATE POLICY "weight_logs_select_own" ON weight_logs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "weight_logs_insert_own" ON weight_logs;
CREATE POLICY "weight_logs_insert_own" ON weight_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "weight_logs_update_own" ON weight_logs;
CREATE POLICY "weight_logs_update_own" ON weight_logs FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "weight_logs_delete_own" ON weight_logs;
CREATE POLICY "weight_logs_delete_own" ON weight_logs FOR DELETE USING (auth.uid() = user_id);

-- Optional goal weight, so progress can show an ETA. Nullable: "no target set".
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_weight_kg DECIMAL;
