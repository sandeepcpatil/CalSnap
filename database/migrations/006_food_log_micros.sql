-- =============================================================
-- 006 · food_logs — sodium, sugar and saturated fat
--
-- The three "negative" nutrients the health-score algorithm already uses.
-- Real values flow from the foods table (IFCT/USDA), barcode and label scans;
-- AI photo estimates fill them in for un-matched items (a population-average
-- guess, like calories). Capturing them unlocks the sodium recap insight and
-- per-meal health scoring.
--
-- DEFAULT 0 so every existing row (and any older client that doesn't send them
-- yet) stays valid.
--
-- Idempotent: safe to re-run.
-- =============================================================

ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS sodium_mg  DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS sugar_g    DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS sat_fat_g  DECIMAL NOT NULL DEFAULT 0;
