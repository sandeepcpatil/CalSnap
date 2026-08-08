-- =============================================================
-- 007 · chat — the personal nutrition coach (beta)
--
-- `chat_beta` gates access during testing. It is deliberately NOT the
-- admin_users table: adding a beta tester should not hand out admin API
-- access. When the feature graduates, the route swaps this check for the
-- normal Pro check and the column can stay as an override.
--
-- History lives server-side so the coach keeps context across devices and
-- reinstalls, and so the daily fair-use cap can be counted reliably.
--
-- Idempotent: safe to re-run.
-- =============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chat_beta BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  -- Bounded so one runaway message can't blow up the context window or storage.
  content    TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 4000),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- The two access patterns: recent history, and today's count for the cap.
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
  ON chat_messages (user_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Readable and clearable by the owner. Writes come from the service role only,
-- so a client can never forge an assistant turn.
DROP POLICY IF EXISTS "chat_messages_select_own" ON chat_messages;
CREATE POLICY "chat_messages_select_own" ON chat_messages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_messages_delete_own" ON chat_messages;
CREATE POLICY "chat_messages_delete_own" ON chat_messages FOR DELETE USING (auth.uid() = user_id);
