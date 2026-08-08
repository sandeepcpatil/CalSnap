-- =============================================================
-- 005 · recaps — the weekly "your week in review"
--
-- One row per user per completed week (Mon–Sun). Generated lazily the first
-- time the user opens Messages after a week ends, then cached — so Gemini is
-- called at most once per user per week. `stats` holds the computed numbers
-- (the source of truth); `content` holds the Gemini-written prose around them.
--
-- Idempotent: safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS recaps (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  -- Monday (local) of the week this recap covers.
  week_start DATE NOT NULL,
  stats      JSONB NOT NULL,
  content    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recaps_user_week ON recaps (user_id, week_start);

ALTER TABLE recaps ENABLE ROW LEVEL SECURITY;

-- Readable by the owner (the backend uses the service role; this also allows a
-- future direct client read). Writes only ever come from the service role.
DROP POLICY IF EXISTS "recaps_select_own" ON recaps;
CREATE POLICY "recaps_select_own" ON recaps FOR SELECT USING (auth.uid() = user_id);
