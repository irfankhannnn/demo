/**
 * Anonymous routes: catalogue reads, AI search, assets, share page, SEO.
 *
 * Everything here is a thin, cacheable proxy of the CRM's internal
 * marketplace API except two things — AI search (services/aiSearch.js) and
 * the share page (services/share.js) — which are the reason this service
 * exists rather than the SPA calling the CRM directly.
 *
 * The CRM's own error copy never reaches the browser: an upstream failure is
 * a 503 with `details: 'upstream_unavailable'`, a missing listing is a plain
 * 404. Both use the repo-wide `{ error, details? }` shape.
 */

import express from 'express';
import { config } from '../config/env.js';
import * as crm from '../services/crmClient.js';
import { CrmUnavailableError } from '../services/crmClient.js';
import { aiSearch } from '../services/aiSearch.js';
import { renderShareHtml } from '../services/share.js';
import { buildSitemapXml, buildRobotsTxt } from '../services/sitemap.js';
import { isSaved } from '../services/usersRepo.js';
import { authOptional } from '../middleware/auth.js';
import { publicReadGuard, aiSearchGuard } from '../middleware/rateLimit.js';
import { logger } from '../logger.js';

const router = express.Router();

/** Scheme + host this API is reached on (CloudFront viewer host when present). */
export function apiOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const base = config.apiBasePath && process.env.ENABLE_BASE_PATH_STRIP === 'true' && !req.headers['x-forwarded-host']
    ? `/${config.apiBasePath.replace(/^\/+|\/+$/g, '')}`
    : '';
  return `${proto}://${host}${base}`;
}

function publicCache(res, seconds = config.publicCacheSeconds) {
  res.set('Cache-Control', `public, max-age=0, s-maxage=${seconds}`);
}

function upstreamFailed(res, err) {
  logger.error('public.upstream_failed', { status: err.status });
  res.set('Cache-Control', 'no-store');
  res.set('Retry-After', '15');
  return res.status(503).json({ error: 'Service temporarily unavailable', details: 'upstream_unavailable' });
}

/** Route helper: run `fn`, map CRM outages to 503, everything else to the error handler. */
function guarded(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      if (err instanceof CrmUnavailableError) return upstreamFailed(res, err);
      return next(err);
    }
  };
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;
const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;

/** Reject junk before it becomes a CRM call or a cache key. */
function validListingParams(req, res) {
  if (!SLUG_RE.test(req.params.slug) || !ID_RE.test(req.params.propertyId)) {
    res.status(404).json({ error: 'Not found' });
    return false;
  }
  return true;
}

router.use(publicReadGuard);

// ── catalogue ──────────────────────────────────────────────────────────────

router.get('/cities', guarded(async (_req, res) => {
  publicCache(res, config.citiesCacheSeconds);
  res.json({ cities: await crm.listCities() });
}));

router.get('/listings', guarded(async (req, res) => {
  if (!req.query.city || typeof req.query.city !== 'string') {
    return res.status(400).json({ error: 'city is required' });
  }
  const query = {};
  for (const k of ['city', 'mode', 'locality', 'minPrice', 'maxPrice', 'bhk', 'minBhk', 'maxBhk', 'propertyType', 'furnishing', 'sort', 'limit', 'cursor']) {
    if (typeof req.query[k] === 'string' && req.query[k].length <= 200) query[k] = req.query[k];
  }
  publicCache(res);
  return res.json(await crm.listListings(query));
}));

router.get('/agencies/:slug', guarded(async (req, res) => {
  if (!SLUG_RE.test(req.params.slug)) return res.status(404).json({ error: 'Not found' });
  const agency = await crm.getAgency(req.params.slug);
  if (!agency) return res.status(404).json({ error: 'Not found' });
  publicCache(res, config.citiesCacheSeconds);
  return res.json({ agency });
}));

router.get('/agencies/:slug/listings/:propertyId', authOptional, guarded(async (req, res) => {
  if (!validListingParams(req, res)) return undefined;
  const listing = await crm.getListing(req.params.slug, req.params.propertyId);
  if (!listing) return res.status(404).json({ error: 'Not found' });

  if (req.user) {
    // Per-user answer: must not be shared through the edge cache.
    res.set('Cache-Control', 'private, no-store');
    let saved = false;
    try {
      saved = await isSaved(req.user.userId, listing.propertyId);
    } catch (err) {
      logger.warn('public.saved_check_failed', { error: err.message });
    }
    return res.json({ listing, saved });
  }
  publicCache(res);
  return res.json({ listing, saved: false });
}));

router.get('/agencies/:slug/listings/:propertyId/similar', guarded(async (req, res) => {
  if (!validListingParams(req, res)) return undefined;
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 6, 1), 12);
  publicCache(res, config.citiesCacheSeconds);
  res.json({ items: await crm.getSimilar(req.params.slug, req.params.propertyId, limit) });
}));

// ── AI search ──────────────────────────────────────────────────────────────

router.post('/search/ai', authOptional, aiSearchGuard, guarded(async (req, res) => {
  const body = req.body || {};
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (query.length < 2 || query.length > 500) {
    return res.status(400).json({ error: 'query must be 2-500 characters' });
  }
  const city = typeof body.city === 'string' && body.city.trim() ? body.city.trim().slice(0, 80) : null;
  const filters = body.filters && typeof body.filters === 'object' && !Array.isArray(body.filters) ? body.filters : {};

  const result = await aiSearch.run({ query, city, filters });
  res.set('Cache-Control', 'no-store');
  return res.json(result);
}));

// ── assets ─────────────────────────────────────────────────────────────────

/**
 * Redirect to a freshly presigned S3 URL. The stable path lets the SPA and
 * the share page cache for minutes while each image request still gets a
 * live signature; the redirect itself is cached well under the signature's
 * 15-minute life.
 */
function serveAsset(kind) {
  return guarded(async (req, res) => {
    if (!validListingParams(req, res)) return undefined;
    const index = Number.parseInt(req.params.index, 10);
    if (!Number.isInteger(index) || index < 0 || index > 40) return res.status(404).end();

    const url = await crm.getAssetUrl(req.params.slug, req.params.propertyId, { kind, index });
    if (!url) return res.status(404).end();

    res.set('Cache-Control', `public, max-age=${config.assetCacheSeconds}`);
    return res.redirect(302, url);
  });
}

router.get('/i/:slug/:propertyId/:index', serveAsset('image'));
router.get('/d/:slug/:propertyId/:index', serveAsset('document'));

// ── share page ─────────────────────────────────────────────────────────────

router.get('/share/p/:slug/:propertyId', guarded(async (req, res) => {
  if (!validListingParams(req, res)) return undefined;
  const listing = await crm.getListing(req.params.slug, req.params.propertyId);
  if (!listing) return res.status(404).type('html').send('<!doctype html><title>Not found</title><p>This listing is no longer available.</p>');
  publicCache(res);
  return res.type('html').send(renderShareHtml({ listing, slug: req.params.slug, apiOrigin: apiOrigin(req) }));
}));

// ── SEO ────────────────────────────────────────────────────────────────────

router.get('/sitemap.xml', guarded(async (req, res) => {
  const entries = await crm.listSitemapEntries();
  res.set('Cache-Control', 'public, max-age=0, s-maxage=3600');
  res.type('application/xml').send(buildSitemapXml({ entries, apiOrigin: apiOrigin(req) }));
}));

router.get('/robots.txt', (req, res) => {
  res.set('Cache-Control', 'public, max-age=0, s-maxage=3600');
  res.type('text/plain').send(buildRobotsTxt({ apiOrigin: apiOrigin(req) }));
});

export default router;
