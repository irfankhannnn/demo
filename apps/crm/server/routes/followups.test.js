/**
 * POST /api/crm/followups/:jobId/cancel proxy (CONTRACTS.md section 5).
 *
 * Pins: the session tenant is what reaches the service, 503 when the service
 * is not configured, the upstream status is preserved, and no phone-shaped
 * key survives in the response.
 *
 * Runs under both `node --test` and jest.
 */

import assert from 'node:assert/strict';
import { createFollowupsRouter } from './followups.js';
import { FollowupServiceError } from '../services/followupService.js';

const isJest = Boolean(process.env.JEST_WORKER_ID);
const { describe, test } = isJest
  ? { describe: globalThis.describe, test: globalThis.test }
  : await import('node:test');

const silentLog = { info() {}, warn() {}, error() {} };

function build(cancelJob) {
  const calls = [];
  const service = {
    cancelJob: cancelJob || (async (tenantId, jobId) => { calls.push({ tenantId, jobId }); return { job: { jobId, status: 'cancelled', context: { leadPhone: '+91' } } }; }),
  };
  const auth = [(req, _res, next) => { req.user = { userId: 'u1', role: 'MEMBER' }; req.tenantId = 'tenant-from-session'; next(); }];
  return { router: createFollowupsRouter({ service, auth, log: silentLog }), calls };
}

function send(router, url) {
  return new Promise((resolve) => {
    const req = { method: 'POST', url, originalUrl: `/api/crm/followups${url}`, body: { tenantId: 'evil' }, query: {}, headers: {}, params: {} };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); return this; },
    };
    router(req, res, () => resolve({ status: 404, body: { error: 'no route matched' } }));
  });
}

describe('POST /:jobId/cancel', () => {
  test('cancels under the session tenant and strips phone keys from the job', async () => {
    const { router, calls } = build();
    const res = await send(router, '/job-1/cancel');
    assert.equal(res.status, 200);
    assert.deepEqual(calls, [{ tenantId: 'tenant-from-session', jobId: 'job-1' }]);
    assert.deepEqual(res.body, { job: { jobId: 'job-1', status: 'cancelled', context: {} } });
  });

  test('503 when the service is not configured, upstream status otherwise', async () => {
    const unset = build(async () => { throw new FollowupServiceError('Follow-up service not configured', { status: 503, code: 'not_configured' }); });
    const res = await send(unset.router, '/job-1/cancel');
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, { error: 'Follow-up service not configured' });

    const missing = build(async () => { throw new FollowupServiceError('job_not_found', { status: 404, code: 'upstream_error' }); });
    assert.equal((await send(missing.router, '/job-x/cancel')).status, 404);
  });
});
