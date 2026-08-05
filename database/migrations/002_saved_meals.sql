-- =============================================================
-- 002 · saved_meals — named combos the user builds once and re-logs
--
-- Distinct from the automatic "recent / frequent" list, which is
-- derived from `food_logs` and needs no storage. A saved meal is
-- deliberate: "my usual breakfast" = 2 idli + sambar + filter coffee.
--
-- Items are stored as JSONB rather than a child table because they
-- are only ever read and written as a whole meal — there is no query
-- that asks "which saved meals contain sambar". A child table would
-- buy nothing and cost a join on every read.
--
-- Idempotent: safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS saved_meals (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 80),
  -- FoodItem[] — the same shape the scan result editor produces, so a
  -- saved meal can be logged through the exact same code path.
  items        JSONB NOT NULL,
  -- Bumped on every log, so the list can rank by what's actually used
  -- rather than by when it happened to be created.
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- An empty items array would produce a meal that logs nothing.
ALTER TABLE saved_meals DROP CONSTRAINT IF EXISTS saved_meals_items_not_empty;
ALTER TABLE saved_meals ADD CONSTRAINT saved_meals_items_not_empty
  CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0);

-- The list query: this user's meals, most recently used first.
CREATE INDEX IF NOT EXISTS idx_saved_meals_user_used
  ON saved_meals (user_id, last_used_at DESC NULLS LAST);

-- Two meals with the same name are indistinguishable in the picker.
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_meals_user_name
  ON saved_meals (user_id, lower(trim(name)));

ALTER TABLE saved_meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_meals_select_own" ON saved_meals;
CREATE POLICY "saved_meals_select_own"
  ON saved_meals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_meals_insert_own" ON saved_meals;
CREATE POLICY "saved_meals_insert_own"
  ON saved_meals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_meals_update_own" ON saved_meals;
CREATE POLICY "saved_meals_update_own"
  ON saved_meals FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_meals_delete_own" ON saved_meals;
CREATE POLICY "saved_meals_delete_own"
  ON saved_meals FOR DELETE
  USING (auth.uid() = user_id);
