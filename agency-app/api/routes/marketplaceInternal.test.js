/**
 * Internal API for marketplace-api.
 *
 * What matters: its own key, failing closed; cross-tenant reads need no tenant
 * header while writes do; an enquiry becomes a lead with source Marketplace
 * and fires the marketplace alert; a listing the tenant has not put on the
 * marketplace cannot receive an enquiry; site visits reuse the booking flow
 * and tag the marketplace adapter.
 *
 * Runs under both `node --test` and jest.
 */

import assert from 'node:assert/strict';
import { createMarketplaceInternalRouter } from './marketplaceInternal.js';

const isJest = Boolean(process.env.JEST_WORKER_ID);
const { describe, test } = isJest
  ? { describe: globalThis.describe, test: globalThis.test }
  : await import('node:test');

const silentLog = { info() {}, warn() {}, error() {} };
const KEY = 'marketplace-internal-secret';

const listing = {
  propertyId: 'p-1', title: '2 BHK Andheri', locality: 'Andheri West', city: 'Mumbai',
  pricing: { mode: 'sale', amount: 8500000, deposit: null }, tenantId: 't-1', agencySlug: 'sharma',
};

function build(overrides = {}) {
  const calls = { ingest: [], notify: [], visits: [], searches: [] };
  const listingSvc = {
    listMarketplaceCities: async () => [{ name: 'Mumbai', cityKey: 'mumbai', sale: 3, rent: 1, total: 4 }],
    listMarketplaceProperties: async (args) => ({ items: [listing], nextCursor: null, cityKey: 'mumbai', mode: args.mode }),
    searchMarketplace: async (args) => { calls.searches.push(args); return { items: [{ ...listing, matchScore: 0.8 }], cityKey: 'mumbai' }; },
    getMarketplaceAgency: async (slug) => (slug === 'sharma' ? { slug: 'sharma', name: 'Sharma Realty', marketplaceEnabled: true } : null),
    getMarketplaceProperty: async (tenantId, propertyId, opts) => {
      if (tenantId !== 't-1' || propertyId !== 'p-1') return null;
      return opts?.includeAssetKeys ? { ...listing, _assetKeys: { images: ['img/0.jpg'], documents: [] } } : listing;
    },
    similarMarketplaceProperties: async () => [],
    listMarketplaceSitemapEntries: async () => [],
    ...overrides.listing,
  };
  const publicListing = { getTenantIdByAgencySlug: async (slug) => (slug === 'sharma' ? 't-1' : null) };
  const ingestion = {
    ingestLead: async (tenantId, input, options) => {
      calls.ingest.push({ tenantId, input, options });
      return overrides.ingestResult || { ok: true, lead: { leadId: 'lead-1', name: input.name, assignedTo: null }, created: true };
    },
  };
  const siteVisit = {
    getAvailability: async () => ({ timeZone: 'Asia/Kolkata', dates: [] }),
    bookSiteVisit: async (tenantId, input) => {
      calls.visits.push({ tenantId, input });
      return overrides.visitResult || { ok: true, meetingId: 'm-1', leadId: 'lead-1', meetingDate: input.meetingDate, meetingTime: input.meetingTime, propertyTitle: '2 BHK Andheri' };
    },
  };
  const notifications = {
    notifyMarketplaceActivity: async (tenantId, args) => { calls.notify.push({ tenantId, args }); return { notified: [], channels: ['in_app'] }; },
  };
  const s3 = { getPresignedUrl: async (key) => `https://signed/${key}` };

  const router = createMarketplaceInternalRouter({
    listingSvc: async () => listingSvc,
    publicListing: async () => publicListing,
    ingestion: async () => ingestion,
    siteVisit: async () => siteVisit,
    notifications: async () => notifications,
    s3: async () => s3,
    log: silentLog,
    env: overrides.env || { MARKETPLACE_INTERNAL_API_KEY: KEY },
  });
  return { router, calls };
}

function send(router, { method = 'GET', url, body, headers = {}, query = {} }) {
  return new Promise((resolve) => {
    const req = {
      method, url, originalUrl: `/api/internal/marketplace${url}`, body: body || {}, query, params: {},
      headers: { 'x-api-key': KEY, ...headers },
    };
    const res = {
      statusCode: 200, headers: {},
      status(code) { this.statusCode = code; return this; },
      set(k, v) { this.headers[k] = v; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload, headers: this.headers }); return this; },
    };
    router(req, res, () => resolve({ status: 404, body: { error: 'no route matched' } }));
  });
}

describe('auth', () => {
  test('rejects a wrong key and a missing key', async () => {
    const { router } = build();
    assert.equal((await send(router, { url: '/cities', headers: { 'x-api-key': 'nope' } })).status, 401);
    assert.equal((await send(router, { url: '/cities', headers: { 'x-api-key': undefined } })).status, 401);
  });
  test('fails closed when the key is not configured', async () => {
    const { router } = build({ env: {} });
    assert.equal((await send(router, { url: '/cities' })).status, 500);
  });
});

describe('cross-tenant reads', () => {
  test('cities needs no tenant header and is cacheable', async () => {
    const { router } = build();
    const res = await send(router, { url: '/cities' });
    assert.equal(res.status, 200);
    assert.equal(res.body.cities[0].cityKey, 'mumbai');
    assert.match(res.headers['Cache-Control'], /s-maxage=300/);
  });
  test('listings requires a city', async () => {
    const { router } = build();
    assert.equal((await send(router, { url: '/listings', query: {} })).status, 400);
    const ok = await send(router, { url: '/listings', query: { city: 'Mumbai', mode: 'rent', minPrice: '10000', sort: 'price_asc' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.mode, 'rent');
  });
  test('search validates the body and forwards filters', async () => {
    const { router, calls } = build();
    const bad = await send(router, { method: 'POST', url: '/search', body: { query: 'x' } });
    assert.equal(bad.status, 400);
    const ok = await send(router, { method: 'POST', url: '/search', body: { query: '2 bhk andheri', city: 'Mumbai', maxPrice: 8000000, bhk: 2 } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.items[0].matchScore, 0.8);
    assert.equal(calls.searches[0].maxPrice, 8000000);
  });
  test('agency + listing by slug; unknown slug is 404', async () => {
    const { router } = build();
    assert.equal((await send(router, { url: '/agencies/sharma' })).body.agency.name, 'Sharma Realty');
    assert.equal((await send(router, { url: '/agencies/nobody' })).status, 404);
    const detail = await send(router, { url: '/agencies/sharma/listings/p-1' });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.listing.propertyId, 'p-1');
    assert.equal((await send(router, { url: '/agencies/sharma/listings/p-404' })).status, 404);
  });
  test('asset presigns only an index into the allowlisted arrays', async () => {
    const { router } = build();
    const ok = await send(router, { url: '/agencies/sharma/listings/p-1/asset', query: { kind: 'image', index: '0' } });
    assert.equal(ok.body.url, 'https://signed/img/0.jpg');
    assert.equal((await send(router, { url: '/agencies/sharma/listings/p-1/asset', query: { kind: 'image', index: '5' } })).status, 404);
    assert.equal((await send(router, { url: '/agencies/sharma/listings/p-1/asset', query: { kind: 'image', index: '-1' } })).status, 400);
  });
});

const buyer = { name: 'Rahul', phone: '9812345678', marketplaceUserId: 'u-1', propertyId: 'p-1', threadId: 'th-1', messageId: 'msg-1', text: 'Is it still available?', dedupeKey: 'msg-1' };

describe('writes', () => {
  test('require x-tenant-id', async () => {
    const { router } = build();
    const res = await send(router, { method: 'POST', url: '/enquiries', body: buyer });
    assert.equal(res.status, 400);
  });

  test('enquiry → lead with source Marketplace + alert of kind enquiry', async () => {
    const { router, calls } = build();
    const res = await send(router, { method: 'POST', url: '/enquiries', body: buyer, headers: { 'x-tenant-id': 't-1' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.leadId, 'lead-1');
    assert.equal(res.body.propertyTitle, '2 BHK Andheri');

    const { tenantId, input, options } = calls.ingest[0];
    assert.equal(tenantId, 't-1');
    assert.equal(input.source, 'Marketplace');
    assert.equal(input.sourceAdapter, 'marketplace');
    assert.equal(input.leadType, 'buyer');
    assert.equal(input.requirement.requirement, 'buy');
    assert.equal(input.requirement.preferredArea, 'Andheri West');
    assert.deepEqual(input.externalRef, { marketplaceUserId: 'u-1', threadId: 'th-1', propertyId: 'p-1', kind: 'enquiry' });
    assert.equal(options.dedupeKey, 'marketplace:t-1:msg-1');

    assert.equal(calls.notify.length, 1);
    assert.equal(calls.notify[0].args.kind, 'enquiry');
    assert.equal(calls.notify[0].args.threadId, 'th-1');
    assert.equal(calls.notify[0].args.preview, 'Is it still available?');
  });

  test('rental listing → tenant lead; ping and message set their kinds', async () => {
    const rental = { ...listing, pricing: { mode: 'rent', amount: 45000, deposit: null } };
    const { router, calls } = build({ listing: { getMarketplaceProperty: async () => rental } });
    await send(router, { method: 'POST', url: '/pings', body: buyer, headers: { 'x-tenant-id': 't-1' } });
    await send(router, { method: 'POST', url: '/messages', body: buyer, headers: { 'x-tenant-id': 't-1' } });
    assert.equal(calls.ingest[0].input.leadType, 'tenant');
    assert.equal(calls.ingest[0].input.requirement.requirement, 'rent');
    assert.equal(calls.notify[0].args.kind, 'ping');
    assert.equal(calls.notify[1].args.kind, 'message');
  });

  test('a listing not on the marketplace for this tenant is 404 and creates nothing', async () => {
    const { router, calls } = build();
    const res = await send(router, { method: 'POST', url: '/enquiries', body: buyer, headers: { 'x-tenant-id': 't-other' } });
    assert.equal(res.status, 404);
    assert.equal(res.body.details, 'property_unavailable');
    assert.equal(calls.ingest.length, 0);
  });

  test('a replayed delivery is reported as duplicate without notifying', async () => {
    const { router, calls } = build({ ingestResult: { ok: true, duplicate: true } });
    const res = await send(router, { method: 'POST', url: '/enquiries', body: buyer, headers: { 'x-tenant-id': 't-1' } });
    assert.equal(res.body.duplicate, true);
    assert.equal(calls.notify.length, 0);
  });

  test('site visit reuses bookSiteVisit with the marketplace adapter and alerts', async () => {
    const { router, calls } = build();
    const body = { name: 'Rahul', phone: '9812345678', marketplaceUserId: 'u-1', propertyId: 'p-1', threadId: 'th-1', meetingDate: '2026-10-01', meetingTime: '11:00', message: 'morning works' };
    const res = await send(router, { method: 'POST', url: '/site-visits', body, headers: { 'x-tenant-id': 't-1' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.meetingId, 'm-1');
    const { input } = calls.visits[0];
    assert.equal(input.sourceAdapter, 'marketplace');
    assert.equal(input.source, 'Marketplace');
    assert.equal(input.externalRef.kind, 'visit_request');
    assert.equal(calls.notify[0].args.kind, 'visit_request');
    assert.equal(calls.notify[0].args.messageId, 'm-1');
  });

  test('visitor-fixable booking failures are 400 with the reason', async () => {
    const { router } = build({ visitResult: { ok: false, reason: 'slot_unavailable' } });
    const body = { name: 'R', phone: '9812345678', marketplaceUserId: 'u-1', propertyId: 'p-1', meetingDate: '2026-10-01', meetingTime: '03:00' };
    const res = await send(router, { method: 'POST', url: '/site-visits', body, headers: { 'x-tenant-id': 't-1' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.details, 'slot_unavailable');
  });
});
