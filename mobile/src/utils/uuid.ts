/**
 * RFC 4122 v4 UUID, generated in pure JavaScript.
 *
 * Deliberately avoids `crypto.randomUUID()` (absent in Hermes) and
 * `expo-crypto` (a native module — requires a rebuild to link). This runs
 * anywhere the JS bundle runs, so a Metro reload is enough to ship it.
 *
 * `Math.random` is not cryptographically secure, which is fine here: these ids
 * only group a user's own meal rows together. They are never secrets, never
 * guessable-sensitive, and collisions across 2^122 values are not a practical
 * concern. Do NOT reuse this for tokens or anything security-bearing.
 */
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    // 'y' must be one of 8, 9, a, b — the RFC 4122 variant bits.
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
