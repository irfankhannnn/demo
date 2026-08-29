// Shared test scaffolding. Not a test file — the node:test directory runner
// only picks up *.test.js, so this name is safe.
//
// Nothing here touches AWS or the auth service: the whole suite runs on a fake
// dynamoService and a fake JWT middleware, which is the only way route tests
// can be part of `npm test` on a laptop with no credentials.

import { createApp } from '../server.js';

export const TENANT = 'tenant-abc';
export const OTHER_TENANT = 'tenant-xyz';

// getConfig() reads process.env on every call, so setting these once at import
// time is enough for every test file.
process.env.AUTH_SERVICE_URL ||= 'http://auth.test';
process.env.INSTA_DATA_TABLE_NAME ||= 'test-realestateflow-insta-data';
process.env.INSTA_AUDIT_TABLE_NAME ||= 'test-realestateflow-insta-audit';
process.env.LOG_LEVEL ||= 'error';

/**
 * A dynamoService stand-in. Every method records its arguments in `calls` so a
 * test can assert on the tenantId that reached the data layer — the tenancy
 * rule is only meaningful if it is checked at that boundary.
 */
export function makeFakeDb(overrides = {}) {
  const calls = [];

  const record = (name, fn) => async (...args) => {
    calls.push({ name, args });
    return fn ? fn(...args) : undefined;
  };

  const base = {
    getDeviceById: async () => null,
    getDevice: async () => null,
    listDevices: async () => [],
    createDevice: async (t, d) => d,
    updateDevice: async (t, id, f) => ({ deviceId: id, status: 'active', ...f }),
    revokeDevice: async (t, id) => ({ deviceId: id, status: 'revoked' }),
    createPairingCode: async (t, { code }) => ({
      code,
      expiresAtIso: new Date(Date.now() + 900_000).toISOString(),
    }),
    getPairingCodeByCode: async () => null,
    consumePairingCode: async () => ({ usedAt: new Date().toISOString() }),
    claimNonce: async () => true,
    putAuditEvent: async () => ({}),
    putAccountSnapshots: async (t, rows) => rows.length,
    listAccountSnapshots: async () => [],
    putMediaItems: async (t, rows) => rows.length,
    listMedia: async () => [],
    getMedia: async () => null,
    putMediaSnapshots: async (t, rows) => rows.length,
    listMediaSnapshots: async () => [],
    putEnquiries: async (t, rows) => rows.length,
    listEnquiries: async () => ({ items: [], cursor: null }),
    getEnquiry: async () => null,
    updateEnquiry: async () => null,
    putThreads: async (t, rows) => rows.length,
    listThreads: async () => [],
    listRules: async () => [],
    putRule: async (t, r) => r,
    deleteRule: async () => true,
  };

  const db = { calls };
  for (const [name, fn] of Object.entries({ ...base, ...overrides })) {
    db[name] = record(name, fn);
  }
  return db;
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

/**
 * Boots the app on an ephemeral port and returns a `request` helper plus a
 * `close`. Uses the real HTTP stack rather than calling handlers directly, so
 * the middleware chain (CORS, body parsing, rawBody capture) is exercised too.
 */
export async function startApp(opts = {}) {
  const app = createApp({ authMiddleware: fakeAuth(opts.tenantId), ...opts });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  return {
    origin,
    async request(path, init = {}) {
      const res = await fetch(`${origin}${path}`, {
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
      return { status: res.status, body };
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
