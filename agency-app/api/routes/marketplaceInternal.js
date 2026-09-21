/**
 * Internal API for the consumer marketplace service (marketplace-api).
 *
 * Mirrors routes/publicPagesInternal.js in spirit — a shared key, allowlist
 * serialisers, no raw items — with one deliberate difference: the READ routes
 * are cross-tenant. A buyer searching "2 BHK in Andheri" gets listings from
 * every opted-in agency, so those routes take no x-tenant-id. Every WRITE
 * route (enquiry, message, ping, site visit) acts on exactly one agency's CRM
 * and requires the header.
 *
 * Own key (`MARKETPLACE_INTERNAL_API_KEY`), separate from the pages key, so a
 * compromised marketplace stack cannot use the branded-pages door or vice
 * versa.
 */

import express from 'express';
import { z } from 'zod';
import { safeKeyEquals, requireTenant } from '../middleware/internalApiKey.js';
import validateBody from '../middleware/validateBody.js';
import { logger as defaultLogger } from '../logger.js';

// Lazy loaders, so the router can be built with fakes in tests without
// pulling the whole DynamoDB/Bedrock surface into the process.
async function loadListing() { return import('../marketplaceListingService.js'); }
async function loadPublicListing() { return import('../publicListingService.js'); }
async function loadIngestion() { return import('../leadIngestion.js'); }
async function loadSiteVisit() { return import('../siteVisitBooking.js'); }
async function loadNotifications() { return import('../leadNotifications.js'); }
async function loadS3() { return import('../s3Service.js'); }


/**
 * @param {object} deps  every dep is an async loader returning the module (or a fake)
 */
export function createMarketplaceInternalRouter({
  listingSvc = loadListing,
  publicListing = loadPublicListing,
  ingestion = loadIngestion,
  siteVisit = loadSiteVisit,
  notifications = loadNotifications,
  s3 = loadS3,
  log = defaultLogger,
  env = process.env,
} = {}) {
  const router = express.Router();
  const logger = log;

  router.use((req, res, next) => {
    const expectedKey = env.MARKETPLACE_INTERNAL_API_KEY;
    if (!expectedKey) {
      logger.error('marketplaceInternal.not_configured', {});
      return res.status(500).json({ error: 'Internal API not configured' });
    }
    if (!safeKeyEquals(req.headers['x-api-key'], expectedKey)) {
      logger.warn('marketplaceInternal.unauthorized', { path: req.path });
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
  });

  /** Public reads are cacheable at the marketplace edge for a minute. */
  function cacheable(res, seconds = 60) {
    res.set('Cache-Control', `public, max-age=0, s-maxage=${seconds}`);
  }

  function numOrNull(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async function resolveSlug(req, res) {
    const tenantId = await (await publicListing()).getTenantIdByAgencySlug(req.params.slug);
    if (!tenantId) {
      res.status(404).json({ error: 'Not found' });
      return null;
    }
    return tenantId;
  }

  // ── reads (cross-tenant) ───────────────────────────────────────────────────

  /** GET /api/internal/marketplace/cities */
  router.get('/cities', async (req, res) => {
    try {
      cacheable(res, 300);
      return res.json({ cities: await (await listingSvc()).listMarketplaceCities() });
    } catch (error) {
      logger.error('marketplaceInternal.cities_failed', { error: error.message });
      return res.status(500).json({ error: 'Lookup failed' });
    }
  });

  /** GET /listings?city&mode&locality&minPrice&maxPrice&bhk&propertyType&furnishing&sort&limit&cursor */
  router.get('/listings', async (req, res) => {
    try {
      if (!req.query.city) return res.status(400).json({ error: 'city is required' });
      const result = await (await listingSvc()).listMarketplaceProperties({
        city: String(req.query.city),
        mode: req.query.mode === 'rent' ? 'rent' : 'sale',
        locality: req.query.locality ? String(req.query.locality) : null,
        minPrice: numOrNull(req.query.minPrice),
        maxPrice: numOrNull(req.query.maxPrice),
        bhk: numOrNull(req.query.bhk),
        minBhk: numOrNull(req.query.minBhk),
        maxBhk: numOrNull(req.query.maxBhk),
        propertyType: req.query.propertyType ? String(req.query.propertyType) : null,
        furnishing: req.query.furnishing ? String(req.query.furnishing) : null,
        sort: ['price_asc', 'price_desc', 'newest'].includes(req.query.sort) ? req.query.sort : 'newest',
        limit: req.query.limit,
        cursor: req.query.cursor || null,
      });
      cacheable(res, 60);
      return res.json(result);
    } catch (error) {
      logger.error('marketplaceInternal.list_failed', { error: error.message });
      return res.status(500).json({ error: 'Lookup failed' });
    }
  });

  const searchSchema = z.object({
    query: z.string().min(2).max(500),
    city: z.string().min(2).max(80),
    mode: z.enum(['sale', 'rent']).optional().nullable(),
    locality: z.string().max(80).optional().nullable(),
    propertyType: z.string().max(40).optional().nullable(),
    minPrice: z.number().nonnegative().optional().nullable(),
    maxPrice: z.number().nonnegative().optional().nullable(),
    bhk: z.number().int().min(0).max(20).optional().nullable(),
    minBhk: z.number().int().min(0).max(20).optional().nullable(),
    maxBhk: z.number().int().min(0).max(20).optional().nullable(),
    furnishing: z.string().max(40).optional().nullable(),
    limit: z.number().int().min(1).max(25).optional(),
  }).strict();

  /** POST /search — embed + vector search across agencies in one city. */
  router.post('/search', validateBody(searchSchema), async (req, res) => {
    try {
      const result = await (await listingSvc()).searchMarketplace(req.body);
      return res.json(result);
    } catch (error) {
      logger.error('marketplaceInternal.search_failed', { error: error.message });
      return res.status(500).json({ error: 'Search failed' });
    }
  });

  /** GET /agencies/:slug */
  router.get('/agencies/:slug', async (req, res) => {
    try {
      const agency = await (await listingSvc()).getMarketplaceAgency(req.params.slug);
      if (!agency) return res.status(404).json({ error: 'Not found' });
      cacheable(res, 300);
      return res.json({ agency });
    } catch (error) {
      logger.error('marketplaceInternal.agency_failed', { slug: req.params.slug, error: error.message });
      return res.status(500).json({ error: 'Lookup failed' });
    }
  });

  /** GET /agencies/:slug/listings/:propertyId */
  router.get('/agencies/:slug/listings/:propertyId', async (req, res) => {
    try {
      const tenantId = await resolveSlug(req, res);
      if (!tenantId) return undefined;
      const listing = await (await listingSvc()).getMarketplaceProperty(tenantId, req.params.propertyId);
      if (!listing) return res.status(404).json({ error: 'Not found' });
      cacheable(res, 60);
      return res.json({ listing });
    } catch (error) {
      logger.error('marketplaceInternal.detail_failed', { slug: req.params.slug, error: error.message });
      return res.status(500).json({ error: 'Lookup failed' });
    }
  });

  /** GET /agencies/:slug/listings/:propertyId/similar */
  router.get('/agencies/:slug/listings/:propertyId/similar', async (req, res) => {
    try {
      const tenantId = await resolveSlug(req, res);
      if (!tenantId) return undefined;
      const items = await (await listingSvc()).similarMarketplaceProperties(tenantId, req.params.propertyId, {
        limit: Math.min(Math.max(Number(req.query.limit) || 6, 1), 12),
      });
      cacheable(res, 300);
      return res.json({ items });
    } catch (error) {
      logger.error('marketplaceInternal.similar_failed', { slug: req.params.slug, error: error.message });
      return res.status(500).json({ error: 'Lookup failed' });
    }
  });

  /**
   * GET /agencies/:slug/listings/:propertyId/asset?kind=image|document&index=N
   * Same bounded presign as the pages API: an offset into an allowlisted array,
   * never a caller-supplied key.
   */
  router.get('/agencies/:slug/listings/:propertyId/asset', async (req, res) => {
    try {
      const tenantId = await resolveSlug(req, res);
      if (!tenantId) return undefined;
      const listing = await (await listingSvc()).getMarketplaceProperty(tenantId, req.params.propertyId, { includeAssetKeys: true });
      if (!listing) return res.status(404).json({ error: 'Not found' });

      const index = Number.parseInt(req.query.index, 10);
      if (!Number.isInteger(index) || index < 0) {
        return res.status(400).json({ error: 'index must be a non-negative integer' });
      }
      const kind = req.query.kind === 'document' ? 'document' : 'image';
      const key = kind === 'document'
        ? listing._assetKeys.documents[index]?.s3Key
        : listing._assetKeys.images[index];
      if (!key) return res.status(404).json({ error: 'Not found' });

      const url = await (await s3()).getPresignedUrl(key, 900);
      return res.json({ url, expiresIn: 900 });
    } catch (error) {
      logger.error('marketplaceInternal.asset_failed', { slug: req.params.slug, error: error.message });
      return res.status(500).json({ error: 'Asset lookup failed' });
    }
  });

  /** GET /sitemap-entries */
  router.get('/sitemap-entries', async (req, res) => {
    try {
      cacheable(res, 3600);
      return res.json({ entries: await (await listingSvc()).listMarketplaceSitemapEntries() });
    } catch (error) {
      logger.error('marketplaceInternal.sitemap_failed', { error: error.message });
      return res.status(500).json({ error: 'Lookup failed' });
    }
  });

  // ── writes (single tenant, x-tenant-id required) ───────────────────────────

  const buyerSchema = z.object({
    name: z.string().min(1).max(120),
    phone: z.string().min(6).max(20),
    email: z.string().email().max(200).optional().nullable(),
    marketplaceUserId: z.string().min(1).max(80),
  });

  const enquirySchema = buyerSchema.extend({
    propertyId: z.string().min(1).max(80),
    threadId: z.string().min(1).max(80),
    messageId: z.string().min(1).max(80).optional(),
    kind: z.enum(['enquiry', 'message', 'ping', 'visit_request']).optional(),
    text: z.string().max(2000).optional().nullable(),
    dedupeKey: z.string().max(200).optional(),
  }).strict();

  /**
   * Shared: resolve the listing (must be marketplace-visible for THIS tenant),
   * upsert the lead through ingestLead(), notify. `kind` decides the alert copy.
   */
  async function recordBuyerActivity(tenantId, body) {
    const listing = await (await listingSvc()).getMarketplaceProperty(tenantId, body.propertyId);
    if (!listing) return { ok: false, status: 404, reason: 'property_unavailable' };

    const mode = listing.pricing?.mode === 'rent' ? 'rent' : 'sale';
    const leadResult = await (await ingestion()).ingestLead(
      tenantId,
      {
        name: body.name,
        phone: body.phone,
        email: body.email || undefined,
        leadType: mode === 'rent' ? 'tenant' : 'buyer',
        requirement: {
          requirement: mode === 'rent' ? 'rent' : 'buy',
          preferredArea: listing.locality || undefined,
        },
        source: 'Marketplace',
        sourceAdapter: 'marketplace',
        externalRef: {
          marketplaceUserId: body.marketplaceUserId,
          threadId: body.threadId,
          propertyId: body.propertyId,
          kind: body.kind,
        },
        createdBy: 'Marketplace',
      },
      // Keyed per message so a retried delivery is dropped but a second, distinct
      // enquiry from the same buyer still reaches the lead as new information.
      { dedupeKey: body.dedupeKey ? `marketplace:${tenantId}:${body.dedupeKey}` : undefined },
    );

    if (!leadResult.ok) return { ok: false, status: 500, reason: leadResult.reason || 'lead_failed' };
    if (leadResult.duplicate) return { ok: true, duplicate: true, leadId: null };

    const lead = leadResult.lead;
    try {
      await (await notifications()).notifyMarketplaceActivity(tenantId, {
        kind: body.kind,
        lead,
        propertyTitle: listing.title,
        threadId: body.threadId,
        preview: body.text || null,
        messageId: body.messageId || body.threadId,
      });
    } catch (err) {
      logger.warn('marketplaceInternal.notify_failed', { tenantId, leadId: lead?.leadId, error: err.message });
    }

    return { ok: true, leadId: lead.leadId, leadCreated: Boolean(leadResult.created), propertyTitle: listing.title };
  }

  function writeRoute(kindDefault) {
    return async (req, res) => {
      try {
        const body = { ...req.body, kind: req.body.kind || kindDefault };
        const result = await recordBuyerActivity(req.tenantId, body);
        if (!result.ok) return res.status(result.status).json({ error: 'Request failed', details: result.reason });
        return res.json(result);
      } catch (error) {
        logger.error('marketplaceInternal.write_failed', { tenantId: req.tenantId, error: error.message });
        return res.status(500).json({ error: 'Request failed' });
      }
    };
  }

  /** POST /enquiries — first message of a thread → lead + alert. */
  router.post('/enquiries', requireTenant, validateBody(enquirySchema), writeRoute('enquiry'));
  /** POST /messages — subsequent buyer message → alert (+ lead enrichment). */
  router.post('/messages', requireTenant, validateBody(enquirySchema), writeRoute('message'));
  /** POST /pings — "I'm interested" → lead + alert. */
  router.post('/pings', requireTenant, validateBody(enquirySchema), writeRoute('ping'));

  /** GET /availability?days */
  router.get('/availability', requireTenant, async (req, res) => {
    try {
      const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 14, 1), 30);
      return res.json(await (await siteVisit()).getAvailability(req.tenantId, days));
    } catch (error) {
      logger.error('marketplaceInternal.availability_failed', { tenantId: req.tenantId, error: error.message });
      return res.status(500).json({ error: 'Availability lookup failed' });
    }
  });

  const visitSchema = buyerSchema.extend({
    propertyId: z.string().min(1).max(80),
    threadId: z.string().min(1).max(80).optional(),
    meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    meetingTime: z.string().regex(/^\d{2}:\d{2}$/),
    message: z.string().max(500).optional().nullable(),
    dedupeKey: z.string().max(200).optional(),
  }).strict();

  /** POST /site-visits — reuses the branded-pages booking flow 1:1. */
  router.post('/site-visits', requireTenant, validateBody(visitSchema), async (req, res) => {
    try {
      const b = req.body;
      const result = await (await siteVisit()).bookSiteVisit(req.tenantId, {
        name: b.name,
        phone: b.phone,
        propertyId: b.propertyId,
        meetingDate: b.meetingDate,
        meetingTime: b.meetingTime,
        message: b.message || undefined,
        source: 'Marketplace',
        sourceAdapter: 'marketplace',
        externalRef: { marketplaceUserId: b.marketplaceUserId, threadId: b.threadId || null, propertyId: b.propertyId, kind: 'visit_request' },
        dedupeKey: b.dedupeKey,
      });

      if (!result.ok) {
        const visitorFixable = new Set([
          'missing_name_or_phone', 'invalid_date', 'invalid_time',
          'date_in_past', 'date_too_far', 'slot_unavailable', 'property_unavailable',
        ]);
        return res.status(visitorFixable.has(result.reason) ? 400 : 500)
          .json({ error: 'Booking failed', details: result.reason });
      }

      // bookSiteVisit already fires notifySiteVisitBooked (in-app + assignee
      // email). The marketplace-specific alert adds the configured channels and
      // the inbox deep link.
      if (result.leadId && !result.duplicate) {
        try {
          await (await notifications()).notifyMarketplaceActivity(req.tenantId, {
            kind: 'visit_request',
            lead: { leadId: result.leadId, name: b.name },
            propertyTitle: result.propertyTitle,
            threadId: b.threadId || null,
            preview: `${b.meetingDate} ${b.meetingTime}${b.message ? ` — ${b.message}` : ''}`,
            messageId: result.meetingId,
          });
        } catch (err) {
          logger.warn('marketplaceInternal.visit_notify_failed', { tenantId: req.tenantId, error: err.message });
        }
      }
      return res.json(result);
    } catch (error) {
      logger.error('marketplaceInternal.booking_failed', { tenantId: req.tenantId, error: error.message });
      return res.status(500).json({ error: 'Booking failed' });
    }
  });

  return router;
}

export default createMarketplaceInternalRouter();
