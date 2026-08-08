/**
 * Standalone tests for the coach's deterministic safety layer.
 * Run with:  npx ts-node --transpile-only src/routes/chat.test.ts
 *
 * The crisis interceptor runs BEFORE any model call, so it is the one guardrail
 * that cannot be jailbroken or hallucinated around. It must catch the real
 * signals and must not fire on ordinary nutrition questions.
 */
import assert from 'assert';
import 'dotenv/config';
import { isCrisisMessage } from './chat';

// ── Must intercept ───────────────────────────────────────────────────────────
const MUST_CATCH = [
  'I want to hurt myself',
  'sometimes I feel suicidal',
  'I think I might be anorexic',
  'is it ok to purge after a big meal',
  'I make myself throw up after dinner',
  'should I just starve myself for a week',
  'I want to stop eating completely to lose weight',
];
for (const m of MUST_CATCH) {
  assert.strictEqual(isCrisisMessage(m), true, `should intercept: "${m}"`);
}

// ── Must NOT intercept (ordinary questions) ──────────────────────────────────
const MUST_PASS = [
  'how much protein did I eat today',
  'what should I have for dinner',
  'why is my sodium high',
  'I am trying to lose weight, any tips',
  'can I eat rice at night',
  'I skipped lunch today, should I eat more at dinner',
  'how many calories are in 2 rotis',
  'my weight is not dropping, what am I doing wrong',
];
for (const m of MUST_PASS) {
  assert.strictEqual(isCrisisMessage(m), false, `should NOT intercept: "${m}"`);
}

// eslint-disable-next-line no-console
console.log(`✓ chat safety — ${MUST_CATCH.length} intercepted, ${MUST_PASS.length} passed through`);
