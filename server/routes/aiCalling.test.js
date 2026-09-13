/**
 * CRM -> ai-calling-service proxy.
 *
 * The properties worth protecting here are all about the trust boundary, not
 * the plumbing:
 *
 *  - **Tenant comes from the session, never the browser.** ai-calling-service
 *    trusts the x-tenant-id we send purely because we hold the shared secret,
 *    so forwarding a client-supplied tenant would hand any caller every
 *    tenant's transcripts and lead phone numbers.
 *
 *  - **The credit gate is here or nowhere.** Calls bill per started minute
 *    after they settle, so this is the last point a call the tenant cannot pay
 *    for can be refused.
 *
 *  - **Fail closed on missing config.** Without the key every forwarded call
 *    would 401 at the service; a clear 503 beats a confusing 502.
 */

import { jest } from '@jest/globals';

const axiosFn = jest.fn();
const getLead = jest.fn();
const getAgencyConfig = jest.fn();
const hasCreditForAiCall = jest.fn();

jest.unstable_mockModule('axios', () => ({ default: axiosFn }));
jest.unstable_mockModule('../middleware/validateToken.js', () => ({
  default: (req, _res, next) => { req.user = { userId: 'u1', role: 'admin' }; next(); },
}));
jest.unstable_mockModule('../tenantMiddleware.js', () => ({
  extractTenantId: (req, _res, next) => { req.tenantId = 'tenant-from-session'; next(); },
  extractTenantIdOptional: (req, _res, next) => next(),
}));
jest.unstable_mockModule('../middleware/requireRole.js', () => ({
  requireCrmMemberOrAbove: (_req, _res, next) => next(),
  requireAdminOrManager: (_req, _res, next) => next(),
}));
jest.unstable_mockModule('../crmDynamodbService.js', () => ({ getLead }));
jest.unstable_mockModule('../agencyConfigService.js', () => ({ getAgencyConfig }));
jest.unstable_mockModule('../aiCallBilling.js', () => ({ hasCreditForAiCall }));
jest.unstable_mockModule('../logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { default: router } = await import('./aiCalling.js');

/** Drive the router directly — express routers are plain middleware. */
function send({ method = 'GET', url, body = {}, query = {} }) {
  return new Promise((resolve) => {
    const req = { method, url, originalUrl: url, body, query, headers: {}, params: {} };
    const res = {
      statusCode: 200,
      body: undefined,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; resolve({ status: this.statusCode, body: payload }); return this; },
    };
    router(req, res, () => resolve({ status: 404, body: { error: 'no route matched' } }));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.AI_CALLING_SERVICE_DOMAIN_NAME = 'ai-calling.example.com';
  process.env.AI_CALLING_SERVICE_BASE_PATH = 'devrealestatecalling';
  process.env.CRM_CALLER_API_KEY = 'test-shared-secret';
  getLead.mockResolvedValue({ leadId: 'lead-1', name: 'Asha', phone: '+919876543210' });
  getAgencyConfig.mockResolvedValue({ aiEmployeeEnabled: true });
  hasCreditForAiCall.mockResolvedValue({ ok: true });
  axiosFn.mockResolvedValue({ data: { callSessionId: 'cs-1', status: 'ringing' } });
});

afterEach(() => {
  delete process.env.AI_CALLING_SERVICE_DOMAIN_NAME;
  delete process.env.AI_CALLING_SERVICE_BASE_PATH;
  delete process.env.CRM_CALLER_API_KEY;
});

describe('service configuration', () => {
  test('returns 503, not 502, when the shared secret is unset', async () => {
    delete process.env.CRM_CALLER_API_KEY;
    const res = await send({ method: 'GET', url: '/calls' });
    expect(res.status).toBe(503);
    expect(axiosFn).not.toHaveBeenCalled();
  });

  test('returns 503 when the service domain is unset', async () => {
    delete process.env.AI_CALLING_SERVICE_DOMAIN_NAME;
    const res = await send({ method: 'GET', url: '/calls' });
    expect(res.status).toBe(503);
    expect(axiosFn).not.toHaveBeenCalled();
  });

  test('refuses a raw API Gateway invoke host instead of calling it', async () => {
    process.env.AI_CALLING_SERVICE_DOMAIN_NAME = 'abc123.execute-api.ap-south-1.amazonaws.com';
    const res = await send({ method: 'GET', url: '/calls' });
    expect(res.status).toBe(503);
    expect(axiosFn).not.toHaveBeenCalled();
  });
});

describe('tenant scoping', () => {
  test('forwards the session tenant and the shared secret on every request', async () => {
    await send({ method: 'GET', url: '/calls' });
    const config = axiosFn.mock.calls[0][0];
    expect(config.headers['x-tenant-id']).toBe('tenant-from-session');
    expect(config.headers['x-api-key']).toBe('test-shared-secret');
  });

  test('ignores a tenantId supplied in the request body', async () => {
    await send({
      method: 'POST',
      url: '/calls/start',
      body: { leadId: 'lead-1', tenantId: 'attacker-tenant' },
    });
    const config = axiosFn.mock.calls[0][0];
    expect(config.headers['x-tenant-id']).toBe('tenant-from-session');
    // The lead is read under the session tenant, never the supplied one.
    expect(getLead).toHaveBeenCalledWith('tenant-from-session', 'lead-1');
  });
});

describe('POST /calls/start', () => {
  test('refuses a tenant that cannot pay, before dialling', async () => {
    hasCreditForAiCall.mockResolvedValue({ ok: false, balance: 2, required: 15 });
    const res = await send({ method: 'POST', url: '/calls/start', body: { leadId: 'lead-1' } });
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('insufficient_credits');
    expect(axiosFn).not.toHaveBeenCalled();
  });

  test('refuses when AI calling is not enabled for the tenant', async () => {
    getAgencyConfig.mockResolvedValue({ aiEmployeeEnabled: false });
    const res = await send({ method: 'POST', url: '/calls/start', body: { leadId: 'lead-1' } });
    expect(res.status).toBe(409);
    expect(axiosFn).not.toHaveBeenCalled();
  });

  test('resolves name and phone server-side rather than trusting the browser', async () => {
    await send({
      method: 'POST',
      url: '/calls/start',
      body: { leadId: 'lead-1', leadPhone: '+910000000000', leadName: 'Spoofed' },
    });
    expect(axiosFn.mock.calls[0][0].data).toMatchObject({
      leadId: 'lead-1',
      leadName: 'Asha',
      leadPhone: '+919876543210',
    });
  });

  test('rejects a lead with no phone number', async () => {
    getLead.mockResolvedValue({ leadId: 'lead-1', name: 'Asha' });
    const res = await send({ method: 'POST', url: '/calls/start', body: { leadId: 'lead-1' } });
    expect(res.status).toBe(400);
    expect(axiosFn).not.toHaveBeenCalled();
  });

  test('404s an unknown lead', async () => {
    getLead.mockResolvedValue(null);
    const res = await send({ method: 'POST', url: '/calls/start', body: { leadId: 'nope' } });
    expect(res.status).toBe(404);
  });

  test('only accepts the two known call purposes', async () => {
    await send({
      method: 'POST',
      url: '/calls/start',
      body: { leadId: 'lead-1', callPurpose: 'something_else' },
    });
    expect(axiosFn.mock.calls[0][0].data.callPurpose).toBe('lead_followup');
  });
});

describe('routing', () => {
  test('metrics/summary is not swallowed by the :callSessionId param route', async () => {
    axiosFn.mockResolvedValue({ data: { totalCalls: 3 } });
    await send({ method: 'GET', url: '/calls/metrics/summary' });
    expect(axiosFn.mock.calls[0][0].url).toBe('https://ai-calling.example.com/devrealestatecalling/api/ai-calling/calls/metrics/summary');
  });

  test('transcript path is forwarded with the session id encoded', async () => {
    axiosFn.mockResolvedValue({ data: [] });
    await send({ method: 'GET', url: '/calls/cs%201/transcript' });
    expect(axiosFn.mock.calls[0][0].url).toBe('https://ai-calling.example.com/devrealestatecalling/api/ai-calling/calls/cs%201/transcript');
  });

  test('slashes around the base path do not produce a double slash', async () => {
    process.env.AI_CALLING_SERVICE_BASE_PATH = '/devrealestatecalling/';
    await send({ method: 'GET', url: '/calls' });
    expect(axiosFn.mock.calls[0][0].url).toBe('https://ai-calling.example.com/devrealestatecalling/api/ai-calling/calls');
  });
});

describe('error propagation', () => {
  test('passes the service status through rather than masking it as 500', async () => {
    axiosFn.mockRejectedValue({
      message: 'rejected',
      response: { status: 401, data: { error: 'Unauthorized' } },
    });
    const res = await send({ method: 'GET', url: '/calls' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  test('a transport failure with no response becomes a 500', async () => {
    axiosFn.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await send({ method: 'GET', url: '/calls' });
    expect(res.status).toBe(500);
  });
});
