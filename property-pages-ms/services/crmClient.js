/**
 * The only route this service has to CRM data.
 *
 * Everything goes through `/api/internal/public-pages/*` with a shared key.
 * This service holds no DynamoDB or S3 permissions of its own, so the set of
 * data it can reach is exactly the set that API is willing to serialise — and
 * that API builds every payload from an allowlist. A compromise here therefore
 * yields published listings, which are public anyway, and nothing else.
 *
 * ── caching ────────────────────────────────────────────────────────────────
 * Agency and listing lookups are cached in-process for a short TTL. This is a
 * per-container cache, not a shared one, which is exactly right for the job:
 * it collapses the burst of lookups a single page render causes without ever
 * being the thing that makes stale data visible for long. A tenant editing a
 * listing sees it update within the TTL.
 *
 * Assets are deliberately NOT cached: presigned URLs expire, and serving a
 * cached expired URL means broken images.
 */

import { config } from '../config/env.js';
import { logger } from '../logger.js';

const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value, ttlSeconds) {
  // Bound the map so a crawler walking thousands of listings on a warm
  // container cannot grow it without limit.
  if (cache.size > 500) cache.clear();
  cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function crmFetch(path, { tenantId = null, method = 'GET', body = null } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.crmTimeoutMs);

  const headers = { 'x-api-key': config.crmInternalApiKey };
  if (tenantId) headers['x-tenant-id'] = tenantId;
  if (body) headers['content-type'] = 'application/json';

  try {
    const response = await fetch(`${config.crmInternalApiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 404) return { notFound: true };

    if (!response.ok) {
      let details = null;
      try {
        details = (await response.json())?.details || null;
      } catch {
        // A non-JSON error body is not itself an error worth failing on.
      }
      logger.warn('crmClient.non_ok', { path, status: response.status, details });
      return { error: true, status: response.status, details };
    }

    return { data: await response.json() };
  } catch (err) {
    const timedOut = err.name === 'AbortError';
    logger.error('crmClient.request_failed', { path, timedOut, error: err.message });
    return { error: true, status: timedOut ? 504 : 502 };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Raised when the CRM could not be reached or answered with an error.
 *
 * Distinct from "no such agency" on purpose. Both used to collapse into null,
 * which meant a six-second CRM timeout rendered a 404 — telling every crawler
 * that a real, paying agency's site does not exist. Google acts on that. An
 * upstream failure has to surface as a retryable 5xx instead.
 */
export class CrmUnavailableError extends Error {
  constructor(status) {
    super(`CRM unavailable (${status})`);
    this.name = 'CrmUnavailableError';
    this.status = status;
  }
}

export async function resolveAgencyBySlug(slug) {
  const cacheKey = `agency-slug:${slug}`;
  const hit = cacheGet(cacheKey);
  if (hit !== null) return hit;

  const result = await crmFetch(`/agency/by-slug/${encodeURIComponent(slug)}`);
  if (result.error) throw new CrmUnavailableError(result.status);

  // Cache the miss too, briefly: a crawler hammering a nonexistent subdomain
  // should not turn into one CRM lookup per request. Only a genuine 404 is
  // cached this way — an error never reaches here.
  const value = result.data?.agency || null;
  cacheSet(cacheKey, value, value ? 120 : 30);
  return value;
}

export async function listProperties(tenantId, { limit = 24, cursor = null, city = null } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  if (city) params.set('city', city);

  const cacheKey = `props:${tenantId}:${params.toString()}`;
  const hit = cacheGet(cacheKey);
  if (hit !== null) return hit;

  const result = await crmFetch(`/properties?${params.toString()}`, { tenantId });
  const value = result.data || { items: [], nextCursor: null };
  if (!result.error) cacheSet(cacheKey, value, 60);
  return value;
}

export async function getProperty(tenantId, propertyId) {
  const cacheKey = `prop:${tenantId}:${propertyId}`;
  const hit = cacheGet(cacheKey);
  if (hit !== null) return hit;

  const result = await crmFetch(`/properties/${encodeURIComponent(propertyId)}`, { tenantId });
  const value = result.data?.property || null;
  if (!result.error) cacheSet(cacheKey, value, value ? 60 : 30);
  return value;
}

/** Never cached — the URL returned is short-lived by design. */
export async function getAssetUrl(tenantId, propertyId, { kind = 'image', index = 0 } = {}) {
  const params = new URLSearchParams({ kind, index: String(index) });
  const result = await crmFetch(
    `/properties/${encodeURIComponent(propertyId)}/asset?${params.toString()}`,
    { tenantId },
  );
  return result.data?.url || null;
}

export async function getAvailability(tenantId, days = 14) {
  const cacheKey = `avail:${tenantId}:${days}`;
  const hit = cacheGet(cacheKey);
  if (hit !== null) return hit;

  const result = await crmFetch(`/availability?days=${days}`, { tenantId });
  const value = result.data || { dates: [], timeZone: 'Asia/Kolkata' };
  // Short TTL: slots fall away as the day advances, and offering a slot that
  // the booking endpoint will then reject is a visible bug.
  if (!result.error) cacheSet(cacheKey, value, 60);
  return value;
}

export async function submitSiteVisit(tenantId, payload) {
  const result = await crmFetch('/site-visits', { tenantId, method: 'POST', body: payload });
  if (result.error) {
    return { ok: false, reason: result.details || 'upstream_error', status: result.status };
  }
  if (result.notFound) return { ok: false, reason: 'not_found', status: 404 };
  return result.data;
}
