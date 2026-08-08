-- =============================================================
-- 004 · barcode_cache — packaged products by barcode
--
-- A write-through cache in front of Open Food Facts. The first person to
-- scan a barcode triggers an OFF lookup; the mapped product is stored here
-- so every later scan of the same pack is instant and works even if OFF is
-- slow or down. The health score is NOT stored — it's recomputed on read
-- from the per-100g values, so improvements to the scoring algorithm apply
-- to already-cached products.
--
-- Only the service-role backend touches this table, so RLS is on with no
-- policy (which denies all client access; the service role bypasses RLS).
--
-- Idempotent: safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS barcode_cache (
  barcode    TEXT PRIMARY KEY,
  -- The mapped product (LabelScanData without the derived health score).
  product    JSONB NOT NULL,
  image_url  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE barcode_cache ENABLE ROW LEVEL SECURITY;
