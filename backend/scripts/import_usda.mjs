#!/usr/bin/env node
/**
 * USDA FoodData Central (SR Legacy) → CalSnap `foods` table.
 *
 * SR Legacy is the USDA's curated Standard Reference: ~7,800 generic whole
 * foods (nuts, seeds, dairy, grains, produce, meats) with lab-grade per-100g
 * nutrition. It fills the gap IFCT leaves — IFCT is Indian-*dish*-centric, so
 * it has "dal" and "idli" but not "flaxseed" or "greek yogurt".
 *
 * Public domain. Download the CSV bundle from:
 *   https://fdc.nal.usda.gov/download-datasets.html
 *   (FoodData Central → SR Legacy → CSV)
 *
 * This script only TRANSFORMS. It reads the CSVs and writes the mapped rows as
 * NDJSON (one food per line) to <out_file>. `load_foods.mjs` then upserts them
 * with ON CONFLICT (name) DO NOTHING, so the load is idempotent and never
 * overwrites an IFCT row that happens to share a name.
 *
 * Usage:
 *   node import_usda.mjs <csv_dir> <out_file.ndjson>
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const [, , CSV_DIR, OUT_FILE] = process.argv;
if (!CSV_DIR || !OUT_FILE) {
  console.error('Usage: node import_usda.mjs <csv_dir> <out_file.ndjson>');
  process.exit(1);
}

// USDA nutrient ids (per 100 g) → our column names. See nutrient.csv.
const NUTRIENTS = {
  1008: 'energy_kcal',
  1003: 'protein_g',
  1005: 'carbs_g',
  2000: 'sugar_g',
  1004: 'fat_g',
  1258: 'sat_fat_g',
  1079: 'fiber_g',
  1093: 'sodium_mg',
};
// A food missing any of these is nutritionally useless in the app.
const REQUIRED = ['energy_kcal', 'protein_g', 'carbs_g', 'fat_g'];

/** Parse a CSV line that may contain quoted fields with embedded commas. */
function parseCsvLine(line) {
  const out = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { out.push(field); field = ''; }
    else field += c;
  }
  out.push(field);
  return out;
}

function readCsv(file) {
  const [header, ...rows] = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  const cols = parseCsvLine(header);
  return rows.map((r) => {
    const vals = parseCsvLine(r);
    return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
  });
}

const dir = (f) => path.join(CSV_DIR, f);

// ── categories ────────────────────────────────────────────────────────────
const categoryById = new Map(
  readCsv(dir('food_category.csv')).map((r) => [r.id, r.description]),
);

// ── foods ─────────────────────────────────────────────────────────────────
const foodById = new Map();
for (const r of readCsv(dir('food.csv'))) {
  if (r.data_type !== 'sr_legacy_food') continue;
  foodById.set(r.fdc_id, {
    name: r.description,
    category: categoryById.get(r.food_category_id) ?? null,
    nutr: {},
  });
}
console.log(`foods: ${foodById.size}`);

// ── nutrients (streamed — 644k rows, we keep only our 8) ────────────────────
await new Promise((resolve) => {
  const rl = readline.createInterface({ input: fs.createReadStream(dir('food_nutrient.csv')) });
  let first = true;
  rl.on('line', (line) => {
    if (first) { first = false; return; } // header
    // Only the first four columns matter and none contain commas.
    const v = parseCsvLine(line);
    const col = NUTRIENTS[v[2]];
    if (!col) return;
    const food = foodById.get(v[1]);
    if (food) food.nutr[col] = Number(v[3]);
  });
  rl.on('close', resolve);
});

// ── build rows ──────────────────────────────────────────────────────────────
/** "Nuts, almonds" → aliases ["almonds","nuts"] so a plain search still hits. */
function aliasesFor(name) {
  const tokens = name.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  return [...new Set(tokens.reverse())].slice(0, 6);
}

const num0 = (v) => (Number.isFinite(v) ? v : 0);

const seenName = new Set();
const out = [];
let skippedIncomplete = 0;
let skippedDup = 0;

for (const food of foodById.values()) {
  if (!REQUIRED.every((k) => Number.isFinite(food.nutr[k]))) { skippedIncomplete++; continue; }
  const name = food.name.trim();
  const key = name.toLowerCase();
  if (seenName.has(key)) { skippedDup++; continue; }
  seenName.add(key);

  const n = food.nutr;
  out.push({
    name,
    aliases: aliasesFor(food.name),
    category: food.category,
    energy_kcal: n.energy_kcal,
    protein_g: n.protein_g,
    carbs_g: n.carbs_g,
    sugar_g: num0(n.sugar_g),
    fat_g: n.fat_g,
    sat_fat_g: num0(n.sat_fat_g),
    fiber_g: num0(n.fiber_g),
    sodium_mg: num0(n.sodium_mg),
    default_unit: 'g',
    source: 'USDA SR Legacy',
  });
}

console.log(`usable rows: ${out.length} (skipped ${skippedIncomplete} incomplete, ${skippedDup} dup names)`);

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, out.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`wrote ${out.length} rows → ${OUT_FILE}`);
