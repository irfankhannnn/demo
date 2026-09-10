/**
 * Internal read/write API for the public property-pages microservice.
 *
 * `property-pages-ms` renders tenant-branded listing pages to anonymous
 * visitors. It reaches CRM data only through this router — it holds no
 * DynamoDB permissions on the CRM table and no S3 permissions on the documents
 * bucket. That boundary is the whole design: the internet-facing service can
 * be fully compromised without giving up read access to owner phone numbers,
 * KYC fields or title deeds, because it never had them.
 *
 * Auth mirrors routes/adapterIngestionInternal.js — a dedicated shared key plus
 * an explicit tenant header, never a user JWT. The key is its own
 * (`PUBLIC_PAGES_INTERNAL_API_KEY`) so compromising the pages service does not
 * hand over the lead-adapter's access, or vice versa.
 *
 * Every property/agency payload leaving here is built by
 * `publicListingService.js`'s allowlist serialisers. No route in this file may
 * return a raw DynamoDB item.
 */

import express from 'express';
import crypto from 'crypto';
import {
  getTenantIdByAgencySlug,
  getPublicAgency,
  getPublicProperty,
  listPublicProperties,
} from '../publicListingService.js';
import { bookSiteVisit, getAvailability } from '../siteVisitBooking.js';
import { getPresignedUrl } from '../s3Service.js';
import { logger } from '../logger.js';

const router = express.Router();

/**
 * Constant-time comparison over digests, so unequal-length keys don't throw
 * and response timing doesn't leak key material byte by byte.
 */
function safeKeyEquals(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const ah = crypto.createHash('sha256').update(provided).digest();
  const bh = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(ah, bh);
}

router.use((req, res, next) => {
  const expectedKey = process.env.PUBLIC_PAGES_INTERNAL_API_KEY;
  if (!expectedKey) {
    logger.error('publicPagesInternal.not_configured', {});
    return res.status(500).json({ error: 'Public pages API not configured' });
  }
  if (!safeKeyEquals(req.headers['x-api-key'], expectedKey)) {
    logger.warn('publicPagesInternal.unauthorized', { path: req.path });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
});

/**
 * Tenant comes from the header on every route except the slug lookup, which is
 * how a tenant gets resolved in the first place.
 */
function requireTenant(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }
  req.tenantId = tenantId;
  return next();
}

/**
 * GET /api/internal/public-pages/agency/by-slug/:slug
 *
 * Resolves a subdomain label to a tenant. Returns 404 for an unknown slug and
 * for a tenant that has not enabled public pages — the two are deliberately
 * indistinguishable, so this cannot be used to enumerate which agencies exist.
 */
router.get('/agency/by-slug/:slug', async (req, res) => {
  try {
    const tenantId = await getTenantIdByAgencySlug(req.params.slug);
    if (!tenantId) return res.status(404).json({ error: 'Not found' });

    const agency = await getPublicAgency(tenantId);
    if (!agency) return res.status(404).json({ error: 'Not found' });

    return res.json({ agency });
  } catch (error) {
    logger.error('publicPagesInternal.by_slug_failed', { slug: req.params.slug, error: error.message });
    return res.status(500).json({ error: 'Lookup failed' });
  }
});

/** GET /agency — branding for an already-resolved tenant. */
router.get('/agency', requireTenant, async (req, res) => {
  try {
    const agency = await getPublicAgency(req.tenantId);
    if (!agency) return res.status(404).json({ error: 'Not found' });
    return res.json({ agency });
  } catch (error) {
    logger.error('publicPagesInternal.agency_failed', { tenantId: req.tenantId, error: error.message });
    return res.status(500).json({ error: 'Lookup failed' });
  }
});

/** GET /properties?limit&cursor&city — the agency's published listings. */
router.get('/properties', requireTenant, async (req, res) => {
  try {
    const { items, nextCursor } = await listPublicProperties(req.tenantId, {
      limit: req.query.limit,
      cursor: req.query.cursor || null,
      city: req.query.city || null,
    });
    return res.json({ items, nextCursor });
  } catch (error) {
    logger.error('publicPagesInternal.list_failed', { tenantId: req.tenantId, error: error.message });
    return res.status(500).json({ error: 'Lookup failed' });
  }
});

/** GET /properties/:propertyId — one published listing, or 404. */
router.get('/properties/:propertyId', requireTenant, async (req, res) => {
  try {
    const property = await getPublicProperty(req.tenantId, req.params.propertyId);
    if (!property) return res.status(404).json({ error: 'Not found' });
    return res.json({ property });
  } catch (error) {
    logger.error('publicPagesInternal.detail_failed', {
      tenantId: req.tenantId, propertyId: req.params.propertyId, error: error.message,
    });
    return res.status(500).json({ error: 'Lookup failed' });
  }
});

/**
 * GET /properties/:propertyId/asset?kind=image|document&index=N
 *
 * Mints a short-lived presigned URL for one published asset.
 *
 * The pages service asks per asset rather than receiving S3 keys in the
 * listing payload, so the set of objects it can reach is bounded by what this
 * route is willing to sign: an index into the *public* image list, or an index
 * into the *marketing* document list. There is no code path here that can be
 * steered toward `titleDeedS3Key` or any other stored key, because the caller
 * never supplies a key — only an offset into an allowlisted array.
 */
router.get('/properties/:propertyId/asset', requireTenant, async (req, res) => {
  try {
    const property = await getPublicProperty(req.tenantId, req.params.propertyId, { includeAssetKeys: true });
    if (!property) return res.status(404).json({ error: 'Not found' });

    const index = Number.parseInt(req.query.index, 10);
    if (!Number.isInteger(index) || index < 0) {
      return res.status(400).json({ error: 'index must be a non-negative integer' });
    }

    const kind = req.query.kind === 'document' ? 'document' : 'image';
    const key = kind === 'document'
      ? property._assetKeys.documents[index]?.s3Key
      : property._assetKeys.images[index];

    if (!key) return res.status(404).json({ error: 'Not found' });

    // Short expiry: the pages service redirects to this immediately and caches
    // the redirect for minutes, not hours, so a leaked URL has a small window.
    const url = await getPresignedUrl(key, 900);
    return res.json({ url, expiresIn: 900 });
  } catch (error) {
    logger.error('publicPagesInternal.asset_failed', {
      tenantId: req.tenantId, propertyId: req.params.propertyId, error: error.message,
    });
    return res.status(500).json({ error: 'Asset lookup failed' });
  }
});

/** GET /availability — bookable dates and slots for this tenant. */
router.get('/availability', requireTenant, async (req, res) => {
  try {
    const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 14, 1), 30);
    return res.json(await getAvailability(req.tenantId, days));
  } catch (error) {
    logger.error('publicPagesInternal.availability_failed', { tenantId: req.tenantId, error: error.message });
    return res.status(500).json({ error: 'Availability lookup failed' });
  }
});

/**
 * POST /site-visits — create the lead + meeting pair.
 *
 * Abuse controls (rate limiting, captcha, honeypot, session signing) all live
 * in the pages microservice at the edge, not here: by the time a request
 * reaches this route it has already been authenticated as coming from that
 * service. This route still validates every field itself, because "the caller
 * already checked" is not something a write path should assume.
 */
router.post('/site-visits', requireTenant, async (req, res) => {
  try {
    const result = await bookSiteVisit(req.tenantId, req.body || {});

    if (!result.ok) {
      const visitorFixable = new Set([
        'missing_name_or_phone', 'invalid_date', 'invalid_time',
        'date_in_past', 'date_too_far', 'slot_unavailable', 'property_unavailable',
      ]);
      const status = visitorFixable.has(result.reason) ? 400 : 500;
      return res.status(status).json({ error: 'Booking failed', details: result.reason });
    }

    return res.json(result);
  } catch (error) {
    logger.error('publicPagesInternal.booking_failed', { tenantId: req.tenantId, error: error.message });
    return res.status(500).json({ error: 'Booking failed' });
  }
});

export default router;
