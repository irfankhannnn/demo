/** Time helpers. Everything internal is unix milliseconds; SQLite stores integers. */
export const HOUR_MS = 3600 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export const now = () => Date.now();
export const iso = (ms = Date.now()) => new Date(ms).toISOString();
export const day = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);

/** Parse Meta's `created_time` / `timestamp` (ISO 8601 with offset) to unix ms. */
export function parseMetaTime(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Randomised delay so our traffic does not look metronomic (A13). */
export function jitter(baseMs, spread = 0.35) {
  const delta = baseMs * spread;
  return Math.max(0, Math.round(baseMs - delta + Math.random() * 2 * delta));
}
