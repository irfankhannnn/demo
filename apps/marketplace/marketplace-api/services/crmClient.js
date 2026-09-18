/**
 * The only route this service has to listing data.
 *
 * Everything goes through the CRM's `/api/internal/marketplace/*` with a
 * shared key. This service holds no CRM table or S3 permissions of its own,
 * so the set of data it can reach is exactly the set that API is willing to
 * serialise — and that API builds every payload from an allowlist
 * (`toPublicProperty()`). A compromise here yields published listings, which
 * are public anyway, plus this service's own consumer data, and nothing else.
 *
 * ── no copy ────────────────────────────────────────────────────────────────
 * Nothing returned here is persisted. The marketplace never mirrors property
 * data; the CRM table stays the single owner and decides visibility through
 * its sparse indexes (apps/crm/server/marketplaceIndexing.js). The only
 * property-shaped thing this service stores is a small display snapshot on a
 * saved item or a thread, so a buyer's inbox still makes sense after the
 * listing is sold.
 *
 * ── caching ────────────────────────────────────────────────────────────────
 * GET reads are cached in-process for `LISTING_CACHE_SECONDS` (60 s). That is
 * per-container and short: it collapses the burst of identical lookups one
 * page load causes without ever making stale data visible for long. Assets
 * are deliberately NOT cached — presigned URLs expire, and serving a cached
 * expired URL means broken images. Writes are never cached.
 */

import { config } from '../config/env.js';
import { createCache } from './cache.js';
import { logger } from '../logger.js';

const cache = createCache({ max: 500 });

/** Test hook. */
export function clearCrmCache() {
  cache.clear();
}

/**
 * Raised when the CRM could not be reached or answered with an error.
 *
 * Distinct from "no such listing" on purpose: an upstream failure must
 * surface as a retryable 5xx, never as a 404 that tells a crawler (or a
 * buyer's saved list) that a real listing has gone.
 */
export class CrmUnavailableError extends Error {
  constructor(status, details = null) {
    super(`CRM unavailable (${status})`);
    this.name = 'CrmUnavailableError';
    this.status = status;
    this.details = details;
  }
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
      logger.warn('crmClient.non_ok', { path: path.split('?')[0], status: response.status, details });
      return { error: true, status: response.status, details };
    }

    return { data: await response.json() };
  } catch (err) {
    const timedOut = err.name === 'AbortError';
    logger.error('crmClient.request_failed', { path: path.split('?')[0], timedOut, error: err.message });
    return { error: true, status: timedOut ? 504 : 502 };
  } finally {
    clearTimeout(timeout);
  }
}

/** Cached GET. A genuine 404 is cached briefly too; an error never is. */
async function cachedGet(cacheKey, path, { ttl = config.listingCacheSeconds, pick = (d) => d, missTtl = 30 } = {}) {
  const hit = cache.get(cacheKey);
  if (hit !== undefined) return hit;

  const result = await crmFetch(path);
  if (result.error) throw new CrmUnavailableError(result.status, result.details);
  const value = result.notFound ? null : pick(result.data);
  cache.set(cacheKey, value, value === null ? missTtl : ttl);
  return value;
}

/** Query-string builder that drops empty values so the CRM's parsers see absence, not "". */
function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ── reads (cross-tenant) ───────────────────────────────────────────────────

/** GET /cities → [{ name, cityKey, sale, rent, total }] */
export async function listCities() {
  const value = await cachedGet('cities', '/cities', {
    ttl: config.citiesCacheSeconds,
    pick: (d) => d?.cities || [],
  });
  return value || [];
}

const LISTING_QUERY_KEYS = [
  'city', 'mode', 'locality', 'minPrice', 'maxPrice', 'bhk', 'minBhk', 'maxBhk',
  'propertyType', 'furnishing', 'sort', 'limit', 'cursor',
];

/** GET /listings — the caller's query is passed through on an allowlist of keys. */
export async function listListings(query = {}) {
  const params = {};
  for (const k of LISTING_QUERY_KEYS) if (query[k] !== undefined) params[k] = query[k];
  const path = `/listings${qs(params)}`;
  const value = await cachedGet(`listings:${path}`, path);
  return value || { items: [], nextCursor: null, cityKey: null, mode: params.mode || 'sale' };
}

/**
 * POST /search — embedding + vector search across agencies in one city.
 * Not cached: the query text is free-form and the model-derived filters vary.
 * Only the keys the CRM's strict schema accepts are sent.
 */
export async function search({
  query, city, mode, locality, propertyType, minPrice, maxPrice, bhk, minBhk, maxBhk, furnishing, limit,
}) {
  const body = { query, city };
  const optional = { mode, locality, propertyType, minPrice, maxPrice, bhk, minBhk, maxBhk, furnishing, limit };
  for (const [k, v] of Object.entries(optional)) {
    if (v !== undefined && v !== null && v !== '') body[k] = v;
  }
  const result = await crmFetch('/search', { method: 'POST', body });
  if (result.error) throw new CrmUnavailableError(result.status, result.details);
  if (result.notFound) return { items: [], cityKey: null, reason: 'search_unavailable' };
  return result.data;
}

/** GET /agencies/:slug → agency card or null. */
export async function getAgency(slug) {
  return cachedGet(
    `agency:${slug}`,
    `/agencies/${encodeURIComponent(slug)}`,
    { ttl: config.citiesCacheSeconds, pick: (d) => d?.agency || null },
  );
}

/** GET /agencies/:slug/listings/:propertyId → listing or null. */
export async function getListing(slug, propertyId) {
  return cachedGet(
    `listing:${slug}:${propertyId}`,
    `/agencies/${encodeURIComponent(slug)}/listings/${encodeURIComponent(propertyId)}`,
    { pick: (d) => d?.listing || null },
  );
}

/** GET /agencies/:slug/listings/:propertyId/similar → items[] */
export async function getSimilar(slug, propertyId, limit = 6) {
  const value = await cachedGet(
    `similar:${slug}:${propertyId}:${limit}`,
    `/agencies/${encodeURIComponent(slug)}/listings/${encodeURIComponent(propertyId)}/similar${qs({ limit })}`,
    { ttl: config.citiesCacheSeconds, pick: (d) => d?.items || [] },
  );
  return value || [];
}

/** Never cached — the URL returned is short-lived by design. */
export async function getAssetUrl(slug, propertyId, { kind = 'image', index = 0 } = {}) {
  const result = await crmFetch(
    `/agencies/${encodeURIComponent(slug)}/listings/${encodeURIComponent(propertyId)}/asset${qs({ kind, index })}`,
  );
  if (result.error) throw new CrmUnavailableError(result.status);
  return result.data?.url || null;
}

/** GET /sitemap-entries → [{ agencySlug, propertyId, updatedAt, cityKey, mode }] */
export async function listSitemapEntries() {
  const value = await cachedGet('sitemap', '/sitemap-entries', {
    ttl: 3600,
    pick: (d) => d?.entries || [],
  });
  return value || [];
}

// ── writes (single tenant) ─────────────────────────────────────────────────

/** Shape every write shares; the CRM schema is strict so nothing extra may go. */
function writeResult(result) {
  if (result.error) {
    return { ok: false, reason: result.details || 'upstream_error', status: result.status };
  }
  if (result.notFound) return { ok: false, reason: 'property_unavailable', status: 404 };
  return result.data;
}

function buyerBody({ buyer, propertyId, threadId, messageId, text, dedupeKey }) {
  const body = {
    name: buyer.name,
    phone: buyer.phone,
    marketplaceUserId: buyer.userId,
    propertyId,
    threadId,
  };
  if (buyer.email) body.email = buyer.email;
  if (messageId) body.messageId = messageId;
  if (text) body.text = text;
  if (dedupeKey) body.dedupeKey = dedupeKey;
  return body;
}

/** POST /enquiries — first message of a thread → lead + alert. */
export async function postEnquiry(tenantId, args) {
  return writeResult(await crmFetch('/enquiries', { tenantId, method: 'POST', body: buyerBody(args) }));
}

/** POST /messages — a later buyer message → alert. */
export async function postMessage(tenantId, args) {
  return writeResult(await crmFetch('/messages', { tenantId, method: 'POST', body: buyerBody(args) }));
}

/** POST /pings — "I'm interested". */
export async function postPing(tenantId, args) {
  return writeResult(await crmFetch('/pings', { tenantId, method: 'POST', body: buyerBody(args) }));
}

/** GET /availability?days — cached briefly: slots fall away as the day advances. */
export async function getAvailability(tenantId, days = 14) {
  const cacheKey = `avail:${tenantId}:${days}`;
  const hit = cache.get(cacheKey);
  if (hit !== undefined) return hit;

  const result = await crmFetch(`/availability${qs({ days })}`, { tenantId });
  if (result.error) throw new CrmUnavailableError(result.status);
  const value = result.data || { dates: [], timeZone: 'Asia/Kolkata' };
  cache.set(cacheKey, value, 60);
  return value;
}

/** POST /site-visits → { ok, meetingId, leadId, meetingDate, meetingTime, propertyTitle } */
export async function postSiteVisit(tenantId, {
  buyer, propertyId, threadId, meetingDate, meetingTime, message, dedupeKey,
}) {
  const body = {
    name: buyer.name,
    phone: buyer.phone,
    marketplaceUserId: buyer.userId,
    propertyId,
    meetingDate,
    meetingTime,
  };
  if (buyer.email) body.email = buyer.email;
  if (threadId) body.threadId = threadId;
  if (message) body.message = message;
  if (dedupeKey) body.dedupeKey = dedupeKey;
  return writeResult(await crmFetch('/site-visits', { tenantId, method: 'POST', body }));
}
