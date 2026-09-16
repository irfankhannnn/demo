/**
 * Click-to-call (CONTRACTS.md 2.2 / 5, APPROVAL-PLAN.md 3.6).
 *
 * What matters here is the trust boundary, not the plumbing:
 *  - the browser names an entity, never a number; numbers are resolved under
 *    the session tenant and never appear in any response;
 *  - the caller leg comes from the authenticated profile;
 *  - fail closed with 503 when the calling service is not configured.
 *
 * Runs under both `node --test` and jest (`npm test` globs every *.test.js).
 * Collaborators are injected through createClickToCallRouter(), so no
 * runner-specific module mocking is needed.
 */

import assert from 'node:assert/strict';
import { createClickToCallRouter, toE164India, resolveEntityPhone, ENTITY_TYPES } from './clickToCall.js';

const isJest = Boolean(process.env.JEST_WORKER_ID);
const { describe, test, beforeEach, afterEach } = isJest
  ? {
      describe: globalThis.describe,
      test: globalThis.test,
      beforeEach: globalThis.beforeEach,
      afterEach: globalThis.afterEach,
    }
  : await import('node:test');

const silentLog = { info() {}, warn() {}, error() {} };

/** Records every request and returns a canned response or throws a canned error. */
function fakeHttp() {
  const fn = async (config) => {
    fn.calls.push(config);
    if (fn.error) throw fn.error;
    return fn.response;
  };
  fn.calls = [];
  fn.response = { status: 201, data: { callSessionId: 'cs-1', callSid: 'sid-1', status: 'initiated' } };
  fn.error = null;
  return fn;
}

function fakeCrm(overrides = {}) {
  const activities = [];
  const m = {
    activities,
    getLead: async () => ({ leadId: 'lead-1', name: 'Asha', phone: '+919876543210' }),
    getBuyer: async () => ({ buyerId: 'buyer-1', name: 'Bala', phone: '9876543211' }),
    getOwner: async () => ({ ownerId: 'owner-1', name: 'Omar', phone: '09876543212' }),
    getCustomer: async () => ({ customerId: 'cust-1', name: 'Chitra', phone: '919876543213' }),
    getContact: async () => ({ contactId: 'contact-1', name: 'Dev', mobile: '9876543214' }),
    getProperty: async () => ({ propertyId: 'prop-1', title: '2 BHK', ownerSnapshot: { phone: '9876543215' } }),
    logContactActivity: async (tenantId, data) => { activities.push({ tenantId, data }); return { activityId: 'a1' }; },
    ...overrides,
  };
  return m;
}

const defaultUser = () => ({
  userId: 'user-1',
  role: 'MEMBER',
  displayName: 'Sameer',
  phoneNumber: '+919800000000',
});

function build({ crm = fakeCrm(), http = fakeHttp(), user = defaultUser(), tenantId = 'tenant-from-session' } = {}) {
  const auth = [
    (req, _res, next) => { if (user) req.user = user; req.tenantId = tenantId; next(); },
  ];
  const router = createClickToCallRouter({ crm: async () => crm, http, auth, log: silentLog });
  return { router, crm, http };
}

/** Drive the router directly: an express Router is plain middleware. */
function send(router, { method = 'POST', url = '/click-to-call', body = {} }) {
  return new Promise((resolve) => {
    const req = { method, url, originalUrl: `/api/crm/calls${url}`, body, query: {}, headers: {}, params: {} };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); return this; },
    };
    router(req, res, () => resolve({ status: 404, body: { error: 'no route matched' } }));
  });
}

beforeEach(() => {
  process.env.AI_CALLING_SERVICE_DOMAIN_NAME = 'ai-calling.example.com';
  process.env.AI_CALLING_SERVICE_BASE_PATH = 'devrealestatecalling';
  process.env.CRM_CALLER_API_KEY = 'test-shared-secret';
});

afterEach(() => {
  delete process.env.AI_CALLING_SERVICE_DOMAIN_NAME;
  delete process.env.AI_CALLING_SERVICE_BASE_PATH;
  delete process.env.CRM_CALLER_API_KEY;
});

describe('toE164India', () => {
  test('normalises the usual Indian spellings', () => {
    assert.deepEqual(toE164India('+91 98765 43210'), { valid: true, e164: '+919876543210' });
    assert.deepEqual(toE164India('919876543210'), { valid: true, e164: '+919876543210' });
    assert.deepEqual(toE164India('09876543210'), { valid: true, e164: '+919876543210' });
    assert.deepEqual(toE164India('00919876543210'), { valid: true, e164: '+919876543210' });
    assert.deepEqual(toE164India('9876543210'), { valid: true, e164: '+919876543210' });
  });

  test('rejects empty, short, and non-mobile numbers', () => {
    assert.equal(toE164India('').valid, false);
    assert.equal(toE164India(null).valid, false);
    assert.equal(toE164India('12345').valid, false);
    assert.equal(toE164India('1234567890').valid, false); // does not start 6-9
    assert.equal(toE164India('+14155552671').valid, false);
  });
});

describe('resolveEntityPhone', () => {
  test('uses ownerPhone or ownerSnapshot.phone for properties', () => {
    assert.equal(resolveEntityPhone('property', { ownerPhone: '1' }), '1');
    assert.equal(resolveEntityPhone('property', { ownerSnapshot: { phone: '2' } }), '2');
    assert.equal(resolveEntityPhone('property', { phone: '3' }), null);
  });

  test('uses phone with legacy fallbacks for everything else', () => {
    assert.equal(resolveEntityPhone('lead', { phone: '1' }), '1');
    assert.equal(resolveEntityPhone('contact', { mobile: '2' }), '2');
    assert.equal(resolveEntityPhone('owner', {}), null);
    assert.equal(resolveEntityPhone('owner', null), null);
  });
});

describe('validation', () => {
  test('400 caller_phone_missing when the profile has no phone', async () => {
    const { router, http } = build({ user: { userId: 'u1', role: 'MEMBER', displayName: 'No Phone' } });
    const res = await send(router, { body: { entityType: 'lead', entityId: 'lead-1' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'caller_phone_missing');
    assert.equal(res.body.message, 'Add your mobile number to your profile to place calls');
    assert.equal(http.calls.length, 0);
  });

  test('accepts req.user.phone as a fallback for the caller leg', async () => {
    const { router, http } = build({ user: { userId: 'u1', role: 'MEMBER', phone: '9800000000' } });
    const res = await send(router, { body: { entityType: 'lead', entityId: 'lead-1' } });
    assert.equal(res.status, 202);
    assert.equal(http.calls[0].data.fromPhone, '+919800000000');
  });

  test('400 caller_phone_invalid when the profile phone is not an Indian mobile', async () => {
    const { router, http } = build({ user: { ...defaultUser(), phoneNumber: '+14155552671' } });
    const res = await send(router, { body: { entityType: 'lead', entityId: 'lead-1' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'caller_phone_invalid');
    assert.equal(http.calls.length, 0);
  });

  test('400 for an unknown entityType', async () => {
    const { router, http } = build();
    const res = await send(router, { body: { entityType: 'developer', entityId: 'x' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'invalid_entity');
    assert.equal(http.calls.length, 0);
  });

  test('400 when entityId is missing', async () => {
    const { router } = build();
    const res = await send(router, { body: { entityType: 'lead' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'invalid_entity');
  });

  test('404 when the entity does not exist', async () => {
    const { router, http } = build({ crm: fakeCrm({ getLead: async () => null }) });
    const res = await send(router, { body: { entityType: 'lead', entityId: 'nope' } });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'entity_not_found');
    assert.equal(http.calls.length, 0);
  });

  test('404 when the entity has no phone', async () => {
    const { router, http } = build({ crm: fakeCrm({ getLead: async () => ({ leadId: 'lead-1', name: 'Asha' }) }) });
    const res = await send(router, { body: { entityType: 'lead', entityId: 'lead-1' } });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'entity_phone_missing');
    assert.equal(http.calls.length, 0);
  });

  test('400 callee_phone_invalid when the stored number is unusable', async () => {
    const { router, http } = build({ crm: fakeCrm({ getLead: async () => ({ leadId: 'lead-1', phone: '12345' }) }) });
    const res = await send(router, { body: { entityType: 'lead', entityId: 'lead-1' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'callee_phone_invalid');
    assert.equal(http.calls.length, 0);
  });
});

describe('service configuration', () => {
  test('503 click_to_call_not_configured when the shared secret is unset', async () => {
    delete process.env.CRM_CALLER_API_KEY;
    const { router, http } = build();
    const res = await send(router, { body: { entityType: 'lead', entityId: 'lead-1' } });
    assert.equal(res.status, 503);
    assert.equal(res.body.error, 'click_to_call_not_configured');
    assert.equal(http.calls.length, 0);
  });

  test('503 when the service domain is unset', async () => {
    delete process.env.AI_CALLING_SERVICE_DOMAIN_NAME;
    const { router } = build();
    const res = await send(router, { body: { entityType: 'lead', entityId: 'lead-1' } });
    assert.equal(res.status, 503);
  });

  test('503 when the calling service itself reports EXOTEL_CALLER_ID is not set', async () => {
    const http = fakeHttp();
    http.error = { message: 'rejected', response: { status: 503, data: { error: 'exotel_caller_id_not_configured' } } };
    const { router } = build({ http });
    const res = await send(router, { body: { entityType: 'lead', entityId: 'lead-1' } });
    assert.equal(res.status, 503);
    assert.equal(res.body.error, 'click_to_call_not_configured');
  });
});

describe('success path', () => {
  test('resolves both legs server-side, forwards tenant + secret, responds 202 without any number', async () => {
    const { router, http, crm } = build();
    const res = await send(router, {
      body: { entityType: 'lead', entityId: 'lead-1', toPhone: '+910000000000', fromPhone: '+910000000001' },
    });

    assert.equal(res.status, 202);
    assert.deepEqual(res.body, { callSessionId: 'cs-1', callSid: 'sid-1', status: 'initiated' });
    assert.ok(!JSON.stringify(res.body).includes('98'), 'no phone digits may leak into the response');

    assert.equal(http.calls.length, 1);
    const cfg = http.calls[0];
    assert.equal(cfg.method, 'post');
    assert.equal(cfg.url, 'https://ai-calling.example.com/devrealestatecalling/api/ai-calling/calls/connect');
    assert.equal(cfg.headers['x-tenant-id'], 'tenant-from-session');
    assert.equal(cfg.headers['x-api-key'], 'test-shared-secret');
    assert.deepEqual(cfg.data, {
      fromPhone: '+919800000000',
      toPhone: '+919876543210',
      entityType: 'lead',
      entityId: 'lead-1',
      initiatedByUserId: 'user-1',
      initiatedByName: 'Sameer',
    });

    // Activity logged best-effort, without a phone number in it.
    assert.equal(crm.activities.length, 1);
    const { tenantId, data } = crm.activities[0];
    assert.equal(tenantId, 'tenant-from-session');
    assert.equal(data.activityType, 'click_to_call');
    assert.equal(data.subjectEntityType, 'lead');
    assert.equal(data.subjectEntityId, 'lead-1');
    assert.equal(data.performedBy, 'Sameer');
    assert.deepEqual(data.payload, { callSessionId: 'cs-1', callSid: 'sid-1' });
    assert.ok(!JSON.stringify(data).includes('98765'), 'activity must not contain the callee number');
    assert.ok(!JSON.stringify(data).includes('98000'), 'activity must not contain the caller number');
  });

  test('normalises every entity type, and maps tenant -> customer', async () => {
    const expected = {
      lead: '+919876543210',
      buyer: '+919876543211',
      owner: '+919876543212',
      customer: '+919876543213',
      tenant: '+919876543213',
      contact: '+919876543214',
      property: '+919876543215',
    };
    assert.deepEqual(Object.keys(expected).sort(), [...ENTITY_TYPES].sort());

    for (const [entityType, toPhone] of Object.entries(expected)) {
      const { router, http, crm } = build();
      const res = await send(router, { body: { entityType, entityId: 'id-1' } });
      assert.equal(res.status, 202, `${entityType} should succeed`);
      assert.equal(http.calls[0].data.toPhone, toPhone, `${entityType} callee`);
      assert.equal(http.calls[0].data.entityType, entityType);
      const logged = crm.activities[0].data.subjectEntityType;
      assert.equal(logged, entityType === 'tenant' ? 'customer' : entityType);
    }
  });

  test('entityType is matched case-insensitively', async () => {
    const { router, http } = build();
    const res = await send(router, { body: { entityType: 'Lead', entityId: 'lead-1' } });
    assert.equal(res.status, 202);
    assert.equal(http.calls[0].data.entityType, 'lead');
  });

  test('a failing activity log does not fail the call', async () => {
    const crm = fakeCrm({ logContactActivity: async () => { throw new Error('dynamo down'); } });
    const { router } = build({ crm });
    const res = await send(router, { body: { entityType: 'owner', entityId: 'owner-1' } });
    assert.equal(res.status, 202);
    assert.equal(res.body.callSessionId, 'cs-1');
  });
});

describe('error propagation', () => {
  test('forwards the service status and scrubs any digits from its error string', async () => {
    const http = fakeHttp();
    http.error = {
      message: 'rejected',
      response: { status: 400, data: { error: 'Exotel rejected +919876543210 as the destination' } },
    };
    const { router } = build({ http });
    const res = await send(router, { body: { entityType: 'lead', entityId: 'lead-1' } });
    assert.equal(res.status, 400);
    assert.ok(!res.body.error.includes('9876543210'), res.body.error);
    assert.ok(res.body.error.includes('[redacted]'));
  });

  test('a transport failure with no response becomes a 502', async () => {
    const http = fakeHttp();
    http.error = new Error('ECONNREFUSED');
    const { router } = build({ http });
    const res = await send(router, { body: { entityType: 'lead', entityId: 'lead-1' } });
    assert.equal(res.status, 502);
    assert.equal(res.body.error, 'calling_service_unreachable');
  });

  test('a thrown getter becomes a 500 with a generic message', async () => {
    const { router } = build({ crm: fakeCrm({ getLead: async () => { throw new Error('boom 9876543210'); } }) });
    const res = await send(router, { body: { entityType: 'lead', entityId: 'lead-1' } });
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Internal server error');
  });
});

describe('routing', () => {
  test('only POST /click-to-call is served', async () => {
    const { router } = build();
    assert.equal((await send(router, { method: 'GET', url: '/click-to-call' })).status, 404);
    assert.equal((await send(router, { method: 'POST', url: '/other' })).status, 404);
  });
});
