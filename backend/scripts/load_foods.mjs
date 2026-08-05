#!/usr/bin/env node
/**
 * Upsert NDJSON food rows (from import_usda.mjs) into the `foods` table.
 *
 * Uses the service-role key so it bypasses RLS, and `onConflict: 'name',
 * ignoreDuplicates: true` — the DB's ON CONFLICT (name) DO NOTHING — so a
 * re-run is a no-op and existing IFCT rows are never touched.
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment. Run
 * from the backend package so @supabase/supabase-js resolves:
 *   cd backend && node --env-file=.env scripts/load_foods.mjs foods.ndjson
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const [, , FILE] = process.argv;
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!FILE) { console.error('Usage: node load_foods.mjs <file.ndjson>'); process.exit(1); }
if (!URL || !KEY) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'); process.exit(1); }

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const rows = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
console.log(`loading ${rows.length} rows…`);

const CHUNK = 500;
let inserted = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  const { error, count } = await supabase
    .from('foods')
    .upsert(chunk, { onConflict: 'name', ignoreDuplicates: true, count: 'exact' });
  if (error) { console.error(`chunk ${i / CHUNK} failed:`, error.message); process.exit(1); }
  inserted += count ?? 0;
  process.stdout.write(`\r  ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
}
console.log(`\ndone — ${inserted} new rows inserted (duplicates skipped)`);
