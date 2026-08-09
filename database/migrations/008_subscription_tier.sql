-- =============================================================
-- 008 · profiles.subscription_tier — reconcile schema drift
--
-- schema.sql and the mobile Profile type both declare this column, but the
-- live database never had it. Any backend `select('subscription_tier', …)`
-- therefore ERRORED, returned null, and — in the recap route — wrongly locked
-- the weekly review behind the Pro teaser for real subscribers.
--
-- Adding it makes the database match the committed schema so those selects
-- succeed. DEFAULT 'free' keeps existing rows valid; nothing reads the value
-- today, so back-filling exact tiers isn't required.
--
-- Idempotent: safe to re-run.
-- =============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'monthly', 'annual'));
