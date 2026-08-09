-- =============================================================
-- 009 · feedback — in-app user feedback
--
-- Deliberately NOT a mailto like Contact Support. A mailto silently fails for
-- anyone without a mail client configured, arrives unstructured, and can't be
-- counted or filtered. A table gives triageable categories, automatic app/device
-- context, and something the admin panel can actually list.
--
-- Idempotent: safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS feedback (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Kept if the account is deleted: feedback about why someone left is exactly
  -- the feedback worth keeping, so this is SET NULL rather than CASCADE.
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category    TEXT NOT NULL CHECK (category IN ('feature', 'improvement', 'bug', 'other')),
  message     TEXT NOT NULL CHECK (length(trim(message)) >= 3 AND length(message) <= 2000),
  -- Denormalised so feedback stays readable even if the profile changes/vanishes.
  email       TEXT,
  app_version TEXT,
  platform    TEXT,
  -- Snapshot of who they were when they wrote it (Pro? how active?), so a
  -- request can be weighed without re-deriving history later.
  context     JSONB,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'actioned', 'closed')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback (status, created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users may submit, and may read back only their own. Reading everyone's
-- feedback is an admin action and goes through the service-role backend.
DROP POLICY IF EXISTS "feedback_insert_own" ON feedback;
CREATE POLICY "feedback_insert_own" ON feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "feedback_select_own" ON feedback;
CREATE POLICY "feedback_select_own" ON feedback FOR SELECT USING (auth.uid() = user_id);
