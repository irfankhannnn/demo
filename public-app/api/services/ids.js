/**
 * ULID-style identifiers: 48-bit millisecond timestamp + 80 bits of
 * randomness, Crockford base32, 26 characters, lexicographically sortable.
 *
 * Implemented here rather than pulled in as a dependency because the one
 * property this service relies on — two ids minted in the same millisecond
 * on the same container still sort in creation order — is easier to
 * guarantee in twenty lines than to audit in a package. Message sort keys
 * are `MSG#<ISO>#<ulid>`, so within one millisecond the ulid is the
 * tiebreak that keeps a thread's messages in the order they were written.
 */

import crypto from 'crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(ms) {
  let out = '';
  let t = ms;
  for (let i = 0; i < 10; i += 1) {
    out = ALPHABET[t % 32] + out;
    t = Math.floor(t / 32);
  }
  return out;
}

function randomChars(n) {
  const bytes = crypto.randomBytes(n);
  let out = '';
  for (let i = 0; i < n; i += 1) out += ALPHABET[bytes[i] % 32];
  return out;
}

/** Increment a base32 string by one, carrying. Returns null on overflow. */
function incrementBase32(str) {
  const chars = str.split('');
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const idx = ALPHABET.indexOf(chars[i]);
    if (idx < 31) {
      chars[i] = ALPHABET[idx + 1];
      return chars.join('');
    }
    chars[i] = ALPHABET[0];
  }
  return null;
}

let lastTime = 0;
let lastRandom = '';

/**
 * Monotonic within a process: a second call in the same millisecond returns
 * the previous random part + 1 rather than fresh randomness, so ordering is
 * preserved even when the clock has not moved.
 */
export function ulid(now = Date.now()) {
  if (now === lastTime && lastRandom) {
    const bumped = incrementBase32(lastRandom);
    lastRandom = bumped || randomChars(16);
  } else {
    lastTime = now;
    lastRandom = randomChars(16);
  }
  return encodeTime(now) + lastRandom;
}

/** Short prefixed ids for things that are not messages. */
export function threadId() {
  return `th_${ulid()}`;
}

export function searchId() {
  return `s_${ulid()}`;
}
