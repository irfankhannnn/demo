/**
 * Small in-process TTL cache.
 *
 * Per-container, not shared — which is exactly right for the job: it collapses
 * the burst of identical CRM lookups a single page load causes (detail +
 * similar + saved check all want the same listing) without ever being the
 * thing that makes stale data visible for long. Under Lambda each warm
 * container has its own copy and a cold one starts empty; nothing depends on
 * the cache being present.
 *
 * `now` is injectable so the TTL behaviour can be tested without sleeping.
 */

export function createCache({ max = 500, now = Date.now } = {}) {
  const store = new Map();

  function get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key, value, ttlSeconds) {
    // Bound the map so a crawler walking thousands of listings on a warm
    // container cannot grow it without limit. Clearing everything is crude
    // but correct: every entry is re-fetchable and short-lived anyway.
    if (store.size >= max) store.clear();
    store.set(key, { value, expiresAt: now() + ttlSeconds * 1000 });
    return value;
  }

  function del(key) {
    store.delete(key);
  }

  /** Delete every key starting with `prefix` (e.g. after a write invalidates a listing). */
  function delPrefix(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  }

  function clear() {
    store.clear();
  }

  return {
    get, set, del, delPrefix, clear, get size() { return store.size; },
  };
}
