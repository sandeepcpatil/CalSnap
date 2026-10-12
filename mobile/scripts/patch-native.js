#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Post-install patch for a native library bug that blocks this app on the SDK
 * version it is pinned to. Idempotent: running it on an already patched tree
 * is a no-op, so it is safe for `npm ci` locally and in CI.
 *
 * expo-audio 0.3.x (SDK 52), Android: `record()` is guarded by
 * `if (!ref.isPrepared)`, which is inverted. After a successful
 * `prepareToRecordAsync()` the recorder IS prepared, so `record()` silently
 * does nothing and no recording ever starts. iOS has no such guard. Fixed
 * upstream only in 0.4.x, which needs SDK 53.
 *
 * If expo-audio is upgraded to a version where the file no longer contains the
 * broken line, this script reports "already applied" and exits 0. If the file
 * changed shape in some other way it fails loudly rather than silently
 * shipping a build where voice logging cannot record.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const FILE = 'node_modules/expo-audio/android/src/main/java/expo/modules/audio/AudioModule.kt';
const FROM = 'if (!ref.isPrepared) {\n          ref.record()';
const TO = 'if (ref.isPrepared) {\n          ref.record()';

const abs = path.join(root, FILE);
if (!fs.existsSync(abs)) {
  console.log('[patch-native] expo-audio Android sources not found; nothing to patch.');
  process.exit(0);
}

const src = fs.readFileSync(abs, 'utf8');
if (src.includes(TO) && !src.includes(FROM)) {
  console.log('[patch-native] expo-audio record() guard already correct.');
  process.exit(0);
}
if (!src.includes(FROM)) {
  console.error('[patch-native] expo-audio AudioModule.kt has changed; update scripts/patch-native.js before building.');
  process.exit(1);
}

fs.writeFileSync(abs, src.replace(FROM, TO));
console.log('[patch-native] expo-audio: fixed inverted isPrepared guard in record().');
