/**
 * Standalone tests for the recap's text trimming.
 * Run with:  npx ts-node --transpile-only src/routes/recap.test.ts
 *
 * Regression: a blunt `slice(0, 200)` shipped an insight that ended
 * "…Focusing on balanced meals can help her" — cut mid-word at exactly 200
 * characters, which reads like the app broke.
 */
import assert from 'assert';
import 'dotenv/config';
import { trimClean } from './recap';

// ── Short enough: returned untouched ─────────────────────────────────────────
assert.strictEqual(trimClean('All good.', 200), 'All good.');
assert.strictEqual(trimClean('  padded  ', 200), 'padded');

// ── The exact regression: never cut mid-word ─────────────────────────────────
const REAL =
  'Your average calorie intake was 1081, quite a bit lower than your goal of 2931. ' +
  'Also, your protein intake averaged 55g, below your 115g goal on all logged days. ' +
  'Focusing on balanced meals can help here and keep your energy steady.';
const trimmed = trimClean(REAL, 200);
assert.ok(trimmed.length <= 201, `too long: ${trimmed.length}`);
assert.ok(!/\bhe$|\bhel$|\bher$/.test(trimmed), `cut mid-word: "${trimmed}"`);
// It should stop at a sentence boundary here, since one falls late enough.
assert.ok(trimmed.endsWith('.'), `expected a clean sentence end, got: "${trimmed}"`);

// ── No sentence boundary available → word boundary + ellipsis ────────────────
const noStop = 'a'.repeat(40) + ' ' + 'b'.repeat(40) + ' ' + 'c'.repeat(40);
const w = trimClean(noStop, 50);
assert.ok(w.endsWith('…'), `expected ellipsis, got: "${w}"`);
assert.ok(!w.includes('b'.repeat(40)), 'should not include a half-cut word');
assert.ok(w.length <= 51, `too long: ${w.length}`);

// ── Never leaves dangling punctuation before the ellipsis ────────────────────
assert.ok(!/[,;:—–-]…$/.test(trimClean('word one, word two, word three here', 20)));

// eslint-disable-next-line no-console
console.log('✓ recap trimClean — no mid-word cuts');
