-- =============================================================
-- 010 · scan_feedback — "Was this estimate right?" on a scan result
--
-- One row per saved scan where the user tapped Right / Close / Wrong. Counts
-- only: no food names, no images, no free text. The public accuracy stat
-- (GET /api/stats/accuracy) aggregates verdicts over the last 90 days, and
-- items_edited / kcal_ai vs kcal_final let us see how far the estimate was
-- from what the user actually logged.
--
-- Idempotent: safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS scan_feedback (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  mode          TEXT NOT NULL CHECK (mode IN ('meal', 'label', 'barcode', 'voice')),
  confidence    TEXT,
  verdict       TEXT NOT NULL CHECK (verdict IN ('right', 'close', 'wrong')),
  items_total   INTEGER NOT NULL DEFAULT 0,
  items_edited  INTEGER NOT NULL DEFAULT 0,
  kcal_ai       INTEGER,
  kcal_final    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_scan_feedback_created ON scan_feedback (created_at);

ALTER TABLE scan_feedback ENABLE ROW LEVEL SECURITY;

-- Users may submit, and may read back only their own. No update or delete:
-- a verdict is a point-in-time signal, and the aggregate must not be editable.
-- Cross-user reads happen only through the service-role backend.
DROP POLICY IF EXISTS "scan_feedback_insert_own" ON scan_feedback;
CREATE POLICY "scan_feedback_insert_own" ON scan_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "scan_feedback_select_own" ON scan_feedback;
CREATE POLICY "scan_feedback_select_own" ON scan_feedback FOR SELECT USING (auth.uid() = user_id);
