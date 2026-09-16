/**
 * CRM -> followup-agent-service client.
 *
 * What matters: the tenant and the shared secret go on every request, the
 * adapter path never throws whatever the service does, the proxy path keeps
 * the service's status code, and a job never leaks a phone number back out.
 *
 * Runs under both `node --test` and jest (`npm test` globs every *.test.js).
 */

import assert from 'node:assert/strict';
import {
  createFollowupService,
  normalizeFollowUpHint,
  buildFollowupJobPayload,
  stripPhoneFields,
  FollowupServiceError,
} from './followupService.js';

const isJest = Boolean(process.env.JEST_WORKER_ID);
const { describe, test } = isJest
  ? { describe: globalThis.describe, test: globalThis.test }
  : await import('node:test');

const silentLog = { info() {}, warn() {}, error() {} };

function fakeHttp() {
  const fn = async (config) => {
    fn.calls.push(config);
    if (fn.error) throw fn.error;
    return fn.response;
  };
  fn.calls = [];
  fn.response = { status: 201, data: { job: { jobId: 'job-1', status: 'scheduled' } } };
  fn.error = null;
  return fn;
}

function build({ env, http = fakeHttp(), getBaseUrl } = {}) {
  const service = createFollowupService({
    http,
    log: silentLog,
    env: env || { FOLLOWUP_CALLER_API_KEY: 'shared-secret' },
    getBaseUrl: getBaseUrl || (() => 'https://services-api.example.in/devrealestatefollowup'),
  });
  return { service, http };
}

describe('normalizeFollowUpHint', () => {
  test('returns null for nothing usable and defaults an unknown type', () => {
    assert.equal(normalizeFollowUpHint(null), null);
    assert.equal(normalizeFollowUpHint('call me'), null);
    assert.deepEqual(normalizeFollowUpHint({ type: 'typo', meetingSchedule: ' Sat 4pm ' }), {
      type: 'site_visit_confirmation', meetingSchedule: 'Sat 4pm', propertyHint: null, note: null,
    });
    assert.equal(normalizeFollowUpHint({ type: 'post_visit_feedback' }).type, 'post_visit_feedback');
  });

  test('buildFollowupJobPayload keeps only the context keys that were given', () => {
    const payload = buildFollowupJobPayload('lead-1', { note: 'asked for a call' }, { requestedBy: 'insta-excel' });
    assert.deepEqual(payload, {
      leadId: 'lead-1', jobType: 'site_visit_confirmation', context: { note: 'asked for a call' },
      requestedBy: 'insta-excel', source: 'crm-adapter',
    });
  });
});

describe('stripPhoneFields', () => {
  test('removes phone-shaped keys at any depth and leaves the rest', () => {
    const job = { jobId: 'j1', phone: '+91', context: { leadPhone: '+91', note: 'x' }, attempts: [{ phoneNumber: '1', outcome: 'ok' }] };
    assert.deepEqual(stripPhoneFields(job), { jobId: 'j1', context: { note: 'x' }, attempts: [{ outcome: 'ok' }] });
    assert.equal(stripPhoneFields(null), null);
  });
});

describe('request plumbing', () => {
  test('sends the shared secret and the tenant on every call, to the jobs route', async () => {
    const { service, http } = build();
    await service.createJob('tenant-1', { leadId: 'lead-1', jobType: 'site_visit_confirmation' });
    const config = http.calls[0];
    assert.equal(config.url, 'https://services-api.example.in/devrealestatefollowup/api/followup/jobs');
    assert.equal(config.headers['x-api-key'], 'shared-secret');
    assert.equal(config.headers['x-tenant-id'], 'tenant-1');
    assert.equal(config.timeout, 8000);
  });

  test('a 200 from the service means an existing open job (duplicate)', async () => {
    const { service, http } = build();
    http.response = { status: 200, data: { job: { jobId: 'job-1' }, duplicate: true } };
    const result = await service.createJob('tenant-1', { leadId: 'lead-1' });
    assert.equal(result.duplicate, true);
    assert.equal(result.job.jobId, 'job-1');
  });

  test('throws a 503 FollowupServiceError when the key is unset, without calling out', async () => {
    const { service, http } = build({ env: {} });
    await assert.rejects(() => service.listJobs('tenant-1', { leadId: 'lead-1' }), (err) => {
      assert.ok(err instanceof FollowupServiceError);
      assert.equal(err.status, 503);
      assert.equal(err.code, 'not_configured');
      return true;
    });
    assert.equal(http.calls.length, 0);
    assert.equal(service.isConfigured(), false);
  });

  test('treats a raw API Gateway host (getter throws) as not configured', async () => {
    const { service } = build({ getBaseUrl: () => { throw new Error('raw API Gateway URLs are not allowed'); } });
    assert.equal(service.isConfigured(), false);
    await assert.rejects(() => service.cancelJob('tenant-1', 'job-1'), (err) => err.status === 503);
  });

  test('keeps the upstream status and error on a service rejection', async () => {
    const { service, http } = build();
    http.error = { response: { status: 404, data: { error: 'job_not_found' } } };
    await assert.rejects(() => service.cancelJob('tenant-1', 'nope'), (err) => {
      assert.equal(err.status, 404);
      assert.equal(err.message, 'job_not_found');
      assert.equal(err.code, 'upstream_error');
      return true;
    });
  });

  test('listJobs passes only the filters that were given as query params', async () => {
    const { service, http } = build();
    http.response = { status: 200, data: { jobs: [{ jobId: 'j1' }] } };
    const { jobs } = await service.listJobs('tenant-1', { leadId: 'lead-1', limit: 5 });
    assert.deepEqual(http.calls[0].params, { leadId: 'lead-1', limit: 5 });
    assert.equal(jobs.length, 1);
  });
});

describe('forwardFollowupJob (adapter path)', () => {
  test('reports success with the job id', async () => {
    const { service } = build();
    const result = await service.forwardFollowupJob('tenant-1', { leadId: 'lead-1', context: { note: 'x' } });
    assert.deepEqual(result, { ok: true, jobId: 'job-1', job: { jobId: 'job-1', status: 'scheduled' }, duplicate: false, reason: null });
  });

  test('never throws: not configured, network failure, and upstream 500 all come back as ok:false', async () => {
    const unset = build({ env: {} });
    assert.deepEqual(await unset.service.forwardFollowupJob('tenant-1', { leadId: 'lead-1' }), {
      ok: false, jobId: null, job: null, duplicate: false, reason: 'not_configured',
    });

    const down = build();
    down.http.error = new Error('ECONNREFUSED');
    assert.equal((await down.service.forwardFollowupJob('tenant-1', { leadId: 'lead-1' })).reason, 'unreachable');

    const failing = build();
    failing.http.error = { response: { status: 500, data: { error: 'boom' } } };
    assert.equal((await failing.service.forwardFollowupJob('tenant-1', { leadId: 'lead-1' })).reason, 'upstream_error');
  });

  test('refuses to forward without a lead id and clamps an unknown job type', async () => {
    const { service, http } = build();
    assert.equal((await service.forwardFollowupJob('tenant-1', {})).reason, 'missing_lead_id');
    await service.forwardFollowupJob('tenant-1', { leadId: 'lead-1', jobType: 'nonsense' });
    assert.equal(http.calls[0].data.jobType, 'site_visit_confirmation');
    assert.equal(http.calls[0].data.source, 'crm-adapter');
  });
});
