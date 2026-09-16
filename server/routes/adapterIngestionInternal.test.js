/**
 * Adapter intake: the `followUp` hand-off (CONTRACTS.md 1.1 / APPROVAL-PLAN 3.3).
 *
 * Pins: the hint reaches ingestLead (so it rides on lead.created), the
 * follow-up service is called for a created *and* a phone-matched lead, never
 * for a skipped one, and a failed hand-off is reported per item without
 * failing the item or the batch.
 *
 * Runs under both `node --test` and jest.
 */

import assert from 'node:assert/strict';
import { createAdapterIngestionRouter, safeKeyEquals } from './adapterIngestionInternal.js';

const isJest = Boolean(process.env.JEST_WORKER_ID);
const { describe, test } = isJest
  ? { describe: globalThis.describe, test: globalThis.test }
  : await import('node:test');

const silentLog = { info() {}, warn() {}, error() {} };
const KEY = 'adapter-secret';

function build({ ingestResults = [], forward } = {}) {
  const calls = { ingest: [], forward: [] };
  let i = 0;
  const ingestion = {
    ingestLead: async (tenantId, input, options) => {
      calls.ingest.push({ tenantId, input, options });
      return ingestResults[i++] || { ok: true, lead: { leadId: `lead-${i}` }, created: true };
    },
    intentToLeadType: (intent) => ({ buy: 'buyer', rent: 'tenant', sell: 'seller' }[intent] || null),
    parseBudgetBracket: (v) => (v ? 5000000 : null),
  };
  const followup = {
    forwardFollowupJob: forward || (async (tenantId, payload) => {
      calls.forward.push({ tenantId, payload });
      return { ok: true, jobId: 'job-1', job: { jobId: 'job-1' }, duplicate: false, reason: null };
    }),
  };
  const router = createAdapterIngestionRouter({
    ingestion: async () => ingestion,
    crm: async () => ({ buildLeadPhoneIndex: async () => new Map() }),
    followup: async () => followup,
    log: silentLog,
    env: { ADAPTER_INTERNAL_API_KEY: KEY },
  });
  return { router, calls };
}

function send(router, { body, headers = {} }) {
  return new Promise((resolve) => {
    const req = {
      method: 'POST', url: '/leads', originalUrl: '/api/internal/adapters/leads', body, query: {}, params: {},
      headers: { 'x-api-key': KEY, 'x-tenant-id': 't-1', 'x-adapter': 'insta-excel', ...headers },
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); return this; },
    };
    router(req, res, () => resolve({ status: 404, body: { error: 'no route matched' } }));
  });
}

describe('safeKeyEquals', () => {
  test('compares without leaking on type or length', () => {
    assert.equal(safeKeyEquals('abc', 'abc'), true);
    assert.equal(safeKeyEquals('abc', 'abcd'), false);
    assert.equal(safeKeyEquals(undefined, 'abc'), false);
  });
});

describe('followUp hand-off', () => {
  test('passes the normalised hint into ingestLead and forwards a job for a created lead', async () => {
    const { router, calls } = build();
    const res = await send(router, {
      body: { leads: [{ name: 'Rahul', phone: '9812345678', intent: 'buy', sourceAdapter: 'insta-excel', dedupeKey: 'row-1', followUp: { meetingSchedule: '6 Sep 4pm', propertyHint: 'Lodha Park', note: 'asked for a call' } }] },
    });
    assert.equal(res.status, 200);

    assert.deepEqual(calls.ingest[0].input.followUp, {
      type: 'site_visit_confirmation', meetingSchedule: '6 Sep 4pm', propertyHint: 'Lodha Park', note: 'asked for a call',
    });
    assert.equal(calls.forward.length, 1);
    assert.deepEqual(calls.forward[0], {
      tenantId: 't-1',
      payload: {
        leadId: 'lead-1', jobType: 'site_visit_confirmation',
        context: { meetingSchedule: '6 Sep 4pm', propertyHint: 'Lodha Park', note: 'asked for a call' },
        requestedBy: 'insta-excel', source: 'crm-adapter',
      },
    });
    assert.deepEqual(res.body.results[0].followupJob, { ok: true, jobId: 'job-1', job: { jobId: 'job-1' }, duplicate: false, reason: null });
  });

  test('forwards for a lead matched by phone too, but not for a skipped item or one without a hint', async () => {
    const { router, calls } = build({
      ingestResults: [
        { ok: true, lead: { leadId: 'existing-1' }, updated: true },
        { ok: true, skipped: true, reason: 'missing_name_or_phone' },
        { ok: true, lead: { leadId: 'lead-3' }, created: true },
      ],
    });
    const res = await send(router, {
      body: { leads: [
        { name: 'Asha', phone: '9812345671', intent: 'rent', followUp: { type: 'site_visit_confirmation' } },
        { name: '', phone: '', intent: 'buy', followUp: { note: 'x' } },
        { name: 'Bala', phone: '9812345672', intent: 'buy' },
      ] },
    });
    assert.equal(calls.forward.length, 1);
    assert.equal(calls.forward[0].payload.leadId, 'existing-1');
    assert.equal(res.body.results[0].updated, true);
    assert.equal('followupJob' in res.body.results[1], false);
    assert.equal('followupJob' in res.body.results[2], false);
    assert.equal(calls.ingest[2].input.followUp, null);
  });

  test('a failed hand-off is reported on the item and the item still counts as created', async () => {
    const { router } = build({
      forward: async () => ({ ok: false, jobId: null, job: null, duplicate: false, reason: 'not_configured' }),
    });
    const res = await send(router, {
      body: { leads: [{ name: 'Rahul', phone: '9812345678', intent: 'buy', followUp: { note: 'call' } }] },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.results[0].created, true);
    assert.equal(res.body.results[0].followupJob.ok, false);
    assert.equal(res.body.results[0].followupJob.reason, 'not_configured');
  });

  test('still authenticates with its own key and rejects an empty batch', async () => {
    const { router } = build();
    assert.equal((await send(router, { body: { leads: [] } })).status, 400);
    assert.equal((await send(router, { body: { leads: [{}] }, headers: { 'x-api-key': 'wrong' } })).status, 401);
  });
});
