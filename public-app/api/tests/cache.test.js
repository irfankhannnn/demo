/**
 * The in-process TTL cache, with an injected clock so expiry is tested
 * without sleeping. Also covers the one behaviour that matters in
 * crmClient: a cached null (a genuine 404) is a hit, not a miss.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { createCache } = await import('../services/cache.js');

describe('createCache', () => {
  test('returns the value inside the TTL and undefined after it', () => {
    let t = 1_000_000;
    const cache = createCache({ now: () => t });
    cache.set('a', { x: 1 }, 60);
    assert.deepEqual(cache.get('a'), { x: 1 });
    t += 59_999;
    assert.deepEqual(cache.get('a'), { x: 1 });
    t += 2;
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.size, 0, 'expired entry is dropped on read');
  });

  test('a cached null is a hit (a 404 must not be re-fetched every request)', () => {
    const cache = createCache({ now: () => 0 });
    cache.set('missing', null, 30);
    assert.equal(cache.get('missing'), null);
    assert.equal(cache.get('never-set'), undefined);
  });

  test('a TTL of 0 expires immediately on the next tick', () => {
    let t = 0;
    const cache = createCache({ now: () => t });
    cache.set('a', 1, 0);
    assert.equal(cache.get('a'), 1);
    t = 1;
    assert.equal(cache.get('a'), undefined);
  });

  test('is bounded: reaching max clears rather than growing without limit', () => {
    const cache = createCache({ max: 3, now: () => 0 });
    cache.set('a', 1, 60);
    cache.set('b', 2, 60);
    cache.set('c', 3, 60);
    assert.equal(cache.size, 3);
    cache.set('d', 4, 60);
    assert.equal(cache.size, 1);
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('d'), 4);
  });

  test('delPrefix removes only matching keys', () => {
    const cache = createCache({ now: () => 0 });
    cache.set('listing:a:1', 1, 60);
    cache.set('listing:a:2', 2, 60);
    cache.set('agency:a', 3, 60);
    cache.delPrefix('listing:a:');
    assert.equal(cache.get('listing:a:1'), undefined);
    assert.equal(cache.get('agency:a'), 3);
  });
});
