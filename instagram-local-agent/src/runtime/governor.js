/**
 * A13 - the rate governor. Token buckets, jitter, backoff, halt-on-rate-error.
 *
 * Caps are ARCHITECTURE section 7, deliberately far below Meta's ceilings:
 *
 *   bucket           Meta ceiling                 our cap
 *   graph_read       4800 x impressions / 24h     200 / hour
 *   dm_send          100 / second                 200 / hour
 *   private_reply    750 / hour                   150 / hour
 *   comment_reply    -                            150 / hour
 *   publish          50 / 24h                     20 / 24h
 *
 * A bucket refills continuously across its window rather than resetting on the
 * hour, so a burst cannot ride the boundary and double the effective rate.
 *
 * `halt(bucket)` stops a bucket until the next window and is called on any of
 * Meta's codes 4 / 613 / 80007 / 2018001.
 */
import { now, jitter } from '../util/time.js';
import { audit } from '../store/repos.js';
import { logger } from '../util/logger.js';

const log = logger('runtime/governor');

export const BUCKETS = {
  graph_read:    { capacity: 200, windowMs: 3600_000,  metaCeiling: '4800 x impressions / 24h' },
  dm_send:       { capacity: 200, windowMs: 3600_000,  metaCeiling: '100 / second' },
  private_reply: { capacity: 150, windowMs: 3600_000,  metaCeiling: '750 / hour' },
  comment_reply: { capacity: 150, windowMs: 3600_000,  metaCeiling: 'undocumented' },
  publish:       { capacity: 20,  windowMs: 86_400_000, metaCeiling: '50 / 24h' },
};

export class RateLimitError extends Error {
  constructor(bucket, retryAfterMs, reason = 'bucket empty') {
    super(`Rate governor refused "${bucket}": ${reason}. Retry in ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.name = 'RateLimitError';
    this.bucket = bucket;
    this.retryAfterMs = retryAfterMs;
    this.reason = reason;
  }
}

export class RateGovernor {
  /**
   * @param {object} opts
   * @param {object} [opts.limits] - per-bucket overrides, same shape as BUCKETS
   * @param {function} [opts.clock] - injectable time source (tests)
   * @param {boolean} [opts.audit] - write refusals to audit_log (default true)
   */
  constructor({ limits = null, clock = now, audit: doAudit = true } = {}) {
    this.clock = clock;
    this.doAudit = doAudit;
    this.buckets = new Map();
    const merged = { ...BUCKETS };
    if (limits) {
      for (const [name, cfg] of Object.entries(limits)) {
        merged[name] = { ...(merged[name] ?? {}), ...cfg };
      }
    }
    for (const [name, cfg] of Object.entries(merged)) {
      this.buckets.set(name, {
        name,
        capacity: cfg.capacity,
        windowMs: cfg.windowMs,
        tokens: cfg.capacity,
        lastRefill: this.clock(),
        haltedUntil: 0,
        haltReason: null,
        spent: 0,
      });
    }
  }

  get(bucket) {
    const b = this.buckets.get(bucket);
    if (!b) throw new Error(`Unknown rate bucket "${bucket}". Known: ${[...this.buckets.keys()].join(', ')}`);
    return b;
  }

  /** Continuous refill: capacity tokens spread evenly across windowMs. */
  refill(b, at = this.clock()) {
    const elapsed = at - b.lastRefill;
    if (elapsed <= 0) return;
    const perMs = b.capacity / b.windowMs;
    b.tokens = Math.min(b.capacity, b.tokens + elapsed * perMs);
    b.lastRefill = at;
  }

  /** Non-mutating view for the console's rate-budget panel. */
  status(at = this.clock()) {
    const out = {};
    for (const b of this.buckets.values()) {
      this.refill(b, at);
      out[b.name] = {
        capacity: b.capacity,
        windowMs: b.windowMs,
        remaining: Math.floor(b.tokens),
        spent: b.spent,
        halted: b.haltedUntil > at,
        haltedUntil: b.haltedUntil > at ? b.haltedUntil : null,
        haltReason: b.haltedUntil > at ? b.haltReason : null,
      };
    }
    return out;
  }

  /** True when one token is available right now. Does not consume. */
  canSpend(bucket, at = this.clock()) {
    const b = this.get(bucket);
    if (b.haltedUntil > at) return false;
    this.refill(b, at);
    return b.tokens >= 1;
  }

  /**
   * Consume one token or throw RateLimitError. This is the only way traffic is
   * allowed out; there is no bypass and no "force" flag on purpose.
   */
  spend(bucket, { cost = 1, at = this.clock() } = {}) {
    const b = this.get(bucket);
    if (b.haltedUntil > at) {
      const err = new RateLimitError(bucket, b.haltedUntil - at, b.haltReason ?? 'halted');
      this.#auditRefusal(bucket, err);
      throw err;
    }
    this.refill(b, at);
    if (b.tokens < cost) {
      const deficit = cost - b.tokens;
      const waitMs = Math.ceil(deficit * (b.windowMs / b.capacity));
      const err = new RateLimitError(bucket, waitMs, `over cap (${b.capacity} per ${b.windowMs / 60000}min)`);
      this.#auditRefusal(bucket, err);
      throw err;
    }
    b.tokens -= cost;
    b.spent += cost;
    return { bucket, remaining: Math.floor(b.tokens) };
  }

  /**
   * Halt a bucket until the next window. Called on Meta codes 4/613/80007/2018001.
   */
  halt(bucket, reason = 'meta rate error', at = this.clock()) {
    const b = this.get(bucket);
    b.haltedUntil = at + b.windowMs;
    b.haltReason = reason;
    b.tokens = 0;
    log.warn('bucket halted until the next window', { bucket, reason, until: b.haltedUntil });
    if (this.doAudit) {
      try {
        audit({ scope: 'governor', action: 'bucket.halt', outcome: 'blocked', subjectType: 'bucket',
          subjectId: bucket, detail: { reason, until: b.haltedUntil } });
      } catch { /* audit must never break the caller */ }
    }
    return b.haltedUntil;
  }

  /** Manual release, for the console. */
  release(bucket) {
    const b = this.get(bucket);
    b.haltedUntil = 0;
    b.haltReason = null;
  }

  /** Delay to insert before the next call so traffic does not look metronomic. */
  pacing(bucket, spreadFactor = 0.35) {
    const b = this.get(bucket);
    return jitter(b.windowMs / b.capacity, spreadFactor);
  }

  #auditRefusal(bucket, err) {
    if (!this.doAudit) return;
    try {
      audit({ scope: 'governor', action: 'spend.refused', outcome: 'blocked', subjectType: 'bucket',
        subjectId: bucket, detail: { reason: err.reason, retryAfterMs: err.retryAfterMs } });
    } catch { /* audit must never break the caller */ }
  }
}

let shared = null;

export function getGovernor(config = {}) {
  if (!shared) shared = new RateGovernor({ limits: config.rateLimits ?? null });
  return shared;
}

export function resetGovernor() {
  shared = null;
}
