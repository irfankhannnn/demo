// The bridge that promotes captured Instagram enquiries into CRM leads.
//
// What these tests protect:
//  - retry safety: a failed forward must be reported so the agent's upload
//    queue retries, and every enquiry must carry its enquiryId as a dedupeKey
//    so that retry cannot create duplicate leads;
//  - the standalone case: with no CRM configured the Instagram feature must
//    keep working exactly as it did before the bridge existed;
//  - enquiries that can't become leads (no phone) must not be sent at all.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const ENV_KEYS = ['CRM_INTERNAL_API_DOMAIN_NAME', 'CRM_INTERNAL_API_BASE_PATH', 'ADAPTER_INTERNAL_API_KEY', 'CRM_INTERNAL_TIMEOUT_MS'];
const saved = {};
let originalFetch;

function stubFetch(impl) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return impl(calls.length);
  };
  return calls;
}

function ok(results) {
  return { ok: true, status: 200, json: async () => ({ ok: true, results }) };
}

const enquiry = (over = {}) => ({
  enquiryId: 'ENQ-1',
  name: 'Rahul Sharma',
  phone: '9876543210',
  intent: 'buy',
  budgetBracket: '80L_1Cr',
  preferredArea: 'Andheri West',
  igUsername: 'rahul.s',
  igSenderId: 'IGSID-1',
  sourceMediaId: 'MEDIA-9',
  ...over,
});

describe('forwardEnquiriesToCrm', () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    originalFetch = globalThis.fetch;
    process.env.CRM_INTERNAL_API_DOMAIN_NAME = 'crm.example.test';
    process.env.CRM_INTERNAL_API_BASE_PATH = 'devrealestatecrm';
    process.env.ADAPTER_INTERNAL_API_KEY = 'test-key';
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    globalThis.fetch = originalFetch;
  });

  test('sends the enquiry as a lead, keyed on enquiryId so retries are safe', async () => {
    const { forwardEnquiriesToCrm } = await import('../services/crmBridge.js');
    const calls = stubFetch(() => ok([{ created: true }]));

    const result = await forwardEnquiriesToCrm('T1', [enquiry()]);

    assert.equal(result.forwarded, true);
    assert.equal(result.created, 1);

    const [call] = calls;
    assert.equal(call.url, 'https://crm.example.test/devrealestatecrm/api/internal/adapters/leads');
    assert.equal(call.options.headers['x-api-key'], 'test-key');
    assert.equal(call.options.headers['x-tenant-id'], 'T1');

    const [lead] = call.body.leads;
    // enquiryId + phone digits: a retry of the same hand-off is dropped, a new
    // number for the same thread is a new hand-off.
    assert.equal(lead.dedupeKey, 'ENQ-1:9876543210');
    assert.equal(lead.sourceAdapter, 'instagram');
    assert.equal(result.results[0].enquiryId, 'ENQ-1');
    assert.equal(lead.source, 'Instagram');
    assert.equal(lead.intent, 'buy');
    // Channel ids travel in one blob, and the media id is mirrored into reelRef
    // because the CRM already renders that for Instagram leads.
    assert.equal(lead.externalRef.igUsername, 'rahul.s');
    assert.equal(lead.externalRef.sourceMediaId, 'MEDIA-9');
    assert.equal(lead.reelRef.postId, 'MEDIA-9');
  });

  test('an enquiry with no phone is never sent — it cannot become a lead', async () => {
    const { forwardEnquiriesToCrm } = await import('../services/crmBridge.js');
    const calls = stubFetch(() => ok([]));

    const result = await forwardEnquiriesToCrm('T1', [enquiry({ phone: null })]);

    assert.equal(result.forwarded, true);
    assert.equal(result.created, 0);
    assert.equal(calls.length, 0, 'no HTTP call should be made for an unusable enquiry');
  });

  test('with no CRM configured the feature runs standalone instead of failing', async () => {
    delete process.env.CRM_INTERNAL_API_DOMAIN_NAME;
    const { forwardEnquiriesToCrm } = await import('../services/crmBridge.js');
    const calls = stubFetch(() => ok([]));

    const result = await forwardEnquiriesToCrm('T1', [enquiry()]);

    assert.equal(result.forwarded, false);
    assert.equal(result.reason, 'not_configured');
    assert.equal(calls.length, 0);
  });

  test('a CRM error is reported as retryable rather than swallowed', async () => {
    const { forwardEnquiriesToCrm } = await import('../services/crmBridge.js');
    stubFetch(() => ({ ok: false, status: 500, json: async () => ({}) }));

    const result = await forwardEnquiriesToCrm('T1', [enquiry()]);

    assert.equal(result.forwarded, false);
    assert.equal(result.reason, 'crm_status_500');
  });

  test('a network failure is reported as retryable', async () => {
    const { forwardEnquiriesToCrm } = await import('../services/crmBridge.js');
    globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };

    const result = await forwardEnquiriesToCrm('T1', [enquiry()]);

    assert.equal(result.forwarded, false);
    assert.equal(result.reason, 'network_error');
  });

  test('tallies the CRM per-item outcomes so partial batches are visible', async () => {
    const { forwardEnquiriesToCrm } = await import('../services/crmBridge.js');
    stubFetch(() => ok([
      { created: true },
      { duplicate: true },
      { skipped: true, reason: 'unresolved_lead_type' },
      { reason: 'error' },
    ]));

    const result = await forwardEnquiriesToCrm('T1', [
      enquiry({ enquiryId: 'E1' }), enquiry({ enquiryId: 'E2' }),
      enquiry({ enquiryId: 'E3' }), enquiry({ enquiryId: 'E4' }),
    ]);

    assert.deepEqual(
      { created: result.created, duplicates: result.duplicates, skipped: result.skipped, failed: result.failed },
      { created: 1, duplicates: 1, skipped: 1, failed: 1 }
    );
  });

  test('chunks a large upload to stay under the CRM batch cap', async () => {
    const { forwardEnquiriesToCrm } = await import('../services/crmBridge.js');
    const calls = stubFetch(() => ok(Array(100).fill({ created: true })));

    const many = Array.from({ length: 250 }, (_, i) => enquiry({ enquiryId: `E${i}` }));
    await forwardEnquiriesToCrm('T1', many);

    assert.equal(calls.length, 3, '250 enquiries should go out as 100 + 100 + 50');
    assert.equal(calls[0].body.leads.length, 100);
    assert.equal(calls[2].body.leads.length, 50);
  });
});

test('a parsed rupee budget is sent as a figure, never as a purchase-scale bracket', async () => {
  const { toAdapterPayload } = await import('../services/crmBridge.js');
  // A 45k rent bracketed as under_25L made the CRM store a 24 lakh budget.
  const rent = toAdapterPayload(enquiry({ intent: 'rent', budgetRupees: 45000, budgetBracket: 'under_25L' }));
  assert.equal(rent.budget, 45000);
  assert.equal('budgetBracket' in rent, false);

  const unparsed = toAdapterPayload(enquiry({ budgetRupees: null, budgetBracket: '80L_1Cr' }));
  assert.equal(unparsed.budgetBracket, '80L_1Cr');
  assert.equal('budget' in unparsed, false);
});
