/**
 * Tests for the call.ended publisher.
 *
 * The detail shape is a cross-service contract (CONTRACTS.md 1.3) consumed
 * by the follow-up agent service, so every key must be present even when
 * null, and a bus failure must never propagate into a webhook handler.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCallEndedDetail,
  publishCallEnded,
  setClient,
  resetClient,
  EVENT_SOURCE,
  CALL_ENDED_DETAIL_TYPE,
} from './eventPublisher.js';

const CONTRACT_KEYS = [
  'tenantId',
  'callSessionId',
  'leadId',
  'callPurpose',
  'status',
  'outcome',
  'duration',
  'followupJobId',
  'needsHuman',
  'needsHumanReason',
  'feedback',
  'meeting',
  'transcriptSummary',
  'dataCollection',
  'source',
  'endedAt',
];

/** A fake EventBridge client that records what it was sent. */
function fakeClient({ fail = false, reject = false } = {}) {
  const sent = [];
  return {
    sent,
    async send(command) {
      sent.push(command.input);
      if (reject) throw new Error('bus unreachable');
      if (fail) return { FailedEntryCount: 1, Entries: [{ ErrorCode: 'ThrottlingException' }] };
      return { FailedEntryCount: 0, Entries: [{ EventId: 'evt-1' }] };
    },
  };
}

test.afterEach(() => resetClient());

test('buildCallEndedDetail emits every contract key, null where unknown', () => {
  const detail = buildCallEndedDetail({ tenantId: 't1', callSessionId: 'c1', status: 'completed' });

  assert.deepEqual(Object.keys(detail).sort(), [...CONTRACT_KEYS].sort());
  assert.equal(detail.leadId, null);
  assert.equal(detail.outcome, null);
  assert.equal(detail.duration, 0);
  assert.equal(detail.followupJobId, null);
  assert.equal(detail.needsHuman, false);
  assert.equal(detail.feedback, null);
  assert.equal(detail.meeting, null);
  assert.equal(detail.source, null);
  assert.match(detail.endedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('buildCallEndedDetail maps session fields onto the contract', () => {
  const detail = buildCallEndedDetail(
    {
      tenantId: 't1',
      callSessionId: 'c1',
      leadId: 'l1',
      callPurpose: 'post_visit_feedback',
      status: 'completed',
      outcome: 'feedback_recorded',
      duration: '143',
      followupJobId: 'job-1',
      needsHuman: true,
      needsHumanReason: 'wants a price discussion',
      visitFeedback: { liked: true, interestLevel: 'high' },
      meeting: { meetingId: 'm1', action: 'confirmed' },
      transcriptSummary: 'Liked it, wants to proceed next week.',
      endedAt: '2026-09-14T10:00:00.000Z',
    },
    { source: 'elevenlabs_post_call', dataCollection: { budget: '1.8 Cr' } }
  );

  assert.equal(detail.duration, 143);
  assert.equal(detail.followupJobId, 'job-1');
  assert.equal(detail.needsHuman, true);
  assert.deepEqual(detail.feedback, { liked: true, interestLevel: 'high' });
  assert.deepEqual(detail.meeting, { meetingId: 'm1', action: 'confirmed' });
  assert.deepEqual(detail.dataCollection, { budget: '1.8 Cr' });
  assert.equal(detail.source, 'elevenlabs_post_call');
  assert.equal(detail.endedAt, '2026-09-14T10:00:00.000Z');
});

test('buildCallEndedDetail falls back to metadata.followupJobId', () => {
  const detail = buildCallEndedDetail({
    tenantId: 't1',
    callSessionId: 'c1',
    metadata: { followupJobId: 'job-from-metadata' },
  });
  assert.equal(detail.followupJobId, 'job-from-metadata');
});

test('publishCallEnded sends one entry with the contract source and detail-type', async () => {
  const client = fakeClient();
  setClient(client);

  const result = await publishCallEnded(
    { tenantId: 't1', callSessionId: 'c1', status: 'no_answer' },
    { source: 'exotel_status' }
  );

  assert.equal(result.published, true);
  assert.equal(result.eventId, 'evt-1');
  assert.equal(client.sent.length, 1);

  const entry = client.sent[0].Entries[0];
  assert.equal(entry.Source, EVENT_SOURCE);
  assert.equal(entry.DetailType, CALL_ENDED_DETAIL_TYPE);
  assert.equal(EVENT_SOURCE, 'aicalling.calls');
  assert.equal(CALL_ENDED_DETAIL_TYPE, 'call.ended');

  const detail = JSON.parse(entry.Detail);
  assert.equal(detail.callSessionId, 'c1');
  assert.equal(detail.status, 'no_answer');
  assert.equal(detail.source, 'exotel_status');
});

test('publishCallEnded never throws — bus error and rejected entry both resolve', async () => {
  setClient(fakeClient({ reject: true }));
  const rejected = await publishCallEnded({ tenantId: 't1', callSessionId: 'c1' });
  assert.equal(rejected.published, false);

  setClient(fakeClient({ fail: true }));
  const failed = await publishCallEnded({ tenantId: 't1', callSessionId: 'c1' });
  assert.equal(failed.published, false);
});

test('publishCallEnded skips a session with no correlation ids', async () => {
  const client = fakeClient();
  setClient(client);

  const result = await publishCallEnded({ status: 'failed' }, { source: 'initiation' });

  assert.equal(result.published, false);
  assert.equal(client.sent.length, 0);
});
