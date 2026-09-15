// Shared test scaffolding. Not a test file — the node:test directory runner
// only picks up *.test.js, so this name is safe.
//
// Nothing here touches AWS, Meta or the auth service: the suite runs the real
// dynamoService against the in-process DynamoDB stand-in, a fake Instagram
// (tests/fakeInstagram.js) and a fake JWT middleware.

import { createApp } from '../server.js';
import * as dynamoService from '../services/dynamoService.js';
import { createLocalDocClient } from '../services/localDynamo.js';
import { createInstagramService } from '../services/instagramService.js';

export const TENANT = 'tenant-abc';
export const OTHER_TENANT = 'tenant-xyz';

// getConfig() reads process.env on every call, so setting these once at import
// time is enough for every test file.
process.env.AUTH_SERVICE_DOMAIN_NAME ||= 'http://auth.test';
process.env.INSTA_DATA_TABLE_NAME ||= 'test-realestateflow-insta-data';
process.env.INSTA_AUDIT_TABLE_NAME ||= 'test-realestateflow-insta-audit';
process.env.LOG_LEVEL ||= 'error';
process.env.META_APP_ID ||= 'test-app-id';
process.env.META_APP_SECRET ||= 'test-app-secret';
process.env.META_WEBHOOK_VERIFY_TOKEN ||= 'test-verify-token';
process.env.INSTA_TOKEN_ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.INSTA_API_DOMAIN_NAME ||= 'http://insta.test';
process.env.INSTA_CONSOLE_URL ||= 'http://console.test/insta';
process.env.INSTA_DRY_RUN_SENDS ||= 'false';
process.env.LLM_PROVIDER ||= 'rules';

/** A clean database for one test: the real data layer over a fresh in-memory table. */
export function freshDb() {
  dynamoService.__setDocClient(createLocalDocClient());
  return dynamoService;
}

/**
 * Wraps a db so a test can assert which tenant reached the data layer — the
 * tenancy rule is only meaningful if it is checked at that boundary.
 */
export function recordingDb(db = freshDb(), overrides = {}) {
  const calls = [];
  const wrapped = { calls };
  for (const [name, fn] of Object.entries(db)) {
    if (typeof fn !== 'function') {
      wrapped[name] = fn;
      continue;
    }
    const impl = overrides[name] || fn;
    wrapped[name] = (...args) => {
      calls.push({ name, args });
      return impl(...args);
    };
  }
  return wrapped;
}

/** CRM stand-in: every lead with a phone is "created". */
export function fakeCrm({ fail = false } = {}) {
  const calls = [];
  return {
    calls,
    async forwardEnquiriesToCrm(tenantId, enquiries) {
      calls.push({ tenantId, enquiries });
      if (fail) return { forwarded: false, reason: 'crm_status_500', results: [] };
      return {
        forwarded: true,
        results: enquiries.map((e) => ({ enquiryId: e.enquiryId, created: true, leadId: `lead-${e.enquiryId}` })),
      };
    },
  };
}

/** JWT middleware stand-in. Sets the tenant the same way the real one does:
 *  server-derived, never read from the request. */
export function fakeAuth(tenantId = TENANT) {
  return (req, _res, next) => {
    req.tenantId = tenantId;
    req.user = { userId: 'user-1', tenantId };
    next();
  };
}

export function makeService({ db, api, crm = fakeCrm(), clock } = {}) {
  return createInstagramService({ db, api, crm, ...(clock && { clock }) });
}

/** Runs the whole OAuth round trip against the fake Instagram. */
export async function connectTestAccount(service, tenantId = TENANT) {
  const { authorizeUrl } = service.startConnect({ tenantId, userId: 'user-1' });
  const state = new URL(authorizeUrl).searchParams.get('state');
  return service.completeConnect({ code: 'good-code', state });
}

/** Temporarily set env vars for one block. */
export async function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/**
 * Boots the app on an ephemeral port and returns a `request` helper plus a
 * `close`. Uses the real HTTP stack, so the middleware chain (CORS, body
 * parsing, rawBody capture) is exercised too.
 */
export async function startApp({ tenantId, authMiddleware, ...opts } = {}) {
  const app = createApp({ authMiddleware: authMiddleware || fakeAuth(tenantId), ...opts });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  return {
    origin,
    async request(path, init = {}) {
      const res = await fetch(`${origin}${path}`, {
        redirect: 'manual',
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(init.headers || {}),
        },
      });
      const text = await res.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      return { status: res.status, body, headers: res.headers };
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
