/**
 * crm.meetings / meeting.completed | meeting.cancelled (CONTRACTS.md 1.2).
 *
 * Pins: the gate on AGENTS_ENABLED, "only on a real transition into
 * completed/cancelled", the detail shape the follow-up service reads, and
 * that a failed publish never surfaces to updateMeeting's caller.
 *
 * Runs under both `node --test` and jest.
 */

import assert from 'node:assert/strict';
import { publishMeetingStatusEvent, buildMeetingEventDetail, MEETING_EVENT_SOURCE } from './meetingEvents.js';

const isJest = Boolean(process.env.JEST_WORKER_ID);
const { describe, test } = isJest
  ? { describe: globalThis.describe, test: globalThis.test }
  : await import('node:test');

const silentLog = { info() {}, warn() {}, error() {} };

function fakeEventBridge() {
  const client = {
    calls: [],
    error: null,
    async send(command) {
      client.calls.push(command.input);
      if (client.error) throw client.error;
      return {};
    },
  };
  return client;
}

const before = { meetingId: 'm-1', status: 'scheduled', meetingDate: '2026-09-06', meetingTime: '16:00' };
const after = {
  ...before,
  status: 'completed',
  meetingType: 'site_visit',
  title: 'Site Visit - 2 BHK in Andheri West',
  relatedEntityType: 'LEAD',
  relatedEntityId: 'lead-1',
  relatedEntityName: 'Rahul',
  relatedEntityPhone: '+919812345678',
  propertyId: 'prop-1',
  propertyName: '2 BHK in Andheri West',
  outcome: 'Liked it',
  updatedAt: '2026-09-06T11:30:00.000Z',
};

describe('publishMeetingStatusEvent', () => {
  test('publishes meeting.completed with the contract detail on a scheduled -> completed transition', async () => {
    const eventBridge = fakeEventBridge();
    const result = await publishMeetingStatusEvent(
      { tenantId: 't-1', before, after, data: { status: 'completed', updatedBy: 'user-7' } },
      { eventBridge, env: { AGENTS_ENABLED: 'true' }, log: silentLog }
    );
    assert.deepEqual(result, { published: true, detailType: 'meeting.completed' });

    const entry = eventBridge.calls[0].Entries[0];
    assert.equal(entry.Source, MEETING_EVENT_SOURCE);
    assert.equal(entry.DetailType, 'meeting.completed');
    const detail = JSON.parse(entry.Detail);
    assert.deepEqual(detail, {
      tenantId: 't-1',
      meetingId: 'm-1',
      status: 'completed',
      meetingType: 'site_visit',
      title: 'Site Visit - 2 BHK in Andheri West',
      meetingDate: '2026-09-06',
      meetingTime: '16:00',
      relatedEntityType: 'LEAD',
      relatedEntityId: 'lead-1',
      relatedEntityName: 'Rahul',
      propertyId: 'prop-1',
      propertyName: '2 BHK in Andheri West',
      outcome: 'Liked it',
      completedBy: 'user-7',
      completedAt: '2026-09-06T11:30:00.000Z',
    });
    // The lead's phone is on the meeting item but has no business on the bus.
    assert.equal('relatedEntityPhone' in detail, false);
  });

  test('publishes meeting.cancelled and nulls the optional fields it does not have', async () => {
    const eventBridge = fakeEventBridge();
    await publishMeetingStatusEvent(
      { tenantId: 't-1', before, after: { ...before, status: 'cancelled', createdBy: 'system' }, data: { status: 'cancelled' } },
      { eventBridge, env: { AGENTS_ENABLED: 'true' }, log: silentLog }
    );
    const detail = JSON.parse(eventBridge.calls[0].Entries[0].Detail);
    assert.equal(eventBridge.calls[0].Entries[0].DetailType, 'meeting.cancelled');
    assert.equal(detail.meetingType, null);
    assert.equal(detail.propertyId, null);
    assert.equal(detail.completedBy, 'system');
  });

  test('stays silent when AGENTS_ENABLED is off', async () => {
    const eventBridge = fakeEventBridge();
    const result = await publishMeetingStatusEvent(
      { tenantId: 't-1', before, after, data: { status: 'completed' } },
      { eventBridge, env: { AGENTS_ENABLED: 'false' }, log: silentLog }
    );
    assert.equal(result.published, false);
    assert.equal(result.reason, 'agents_disabled');
    assert.equal(eventBridge.calls.length, 0);
  });

  test('does not publish a reschedule, an archive, or an unchanged status', async () => {
    const env = { AGENTS_ENABLED: 'true' };
    const eventBridge = fakeEventBridge();
    const rescheduled = await publishMeetingStatusEvent(
      { tenantId: 't-1', before, after: { ...before, status: 'rescheduled' }, data: { status: 'rescheduled' } },
      { eventBridge, env, log: silentLog }
    );
    const archived = await publishMeetingStatusEvent(
      { tenantId: 't-1', before: { ...before, status: 'completed' }, after: { ...before, status: 'archived' }, data: { status: 'archived' } },
      { eventBridge, env, log: silentLog }
    );
    const unchanged = await publishMeetingStatusEvent(
      { tenantId: 't-1', before: { ...before, status: 'completed' }, after: { ...after }, data: { notes: 'edit' } },
      { eventBridge, env, log: silentLog }
    );
    assert.equal(rescheduled.reason, 'status_not_published');
    assert.equal(archived.reason, 'status_not_published');
    assert.equal(unchanged.reason, 'status_unchanged');
    assert.equal(eventBridge.calls.length, 0);
  });

  test('swallows a publish failure instead of failing the meeting write', async () => {
    const eventBridge = fakeEventBridge();
    eventBridge.error = new Error('AccessDenied');
    const result = await publishMeetingStatusEvent(
      { tenantId: 't-1', before, after, data: { status: 'completed' } },
      { eventBridge, env: { AGENTS_ENABLED: 'true' }, log: silentLog }
    );
    assert.deepEqual(result, { published: false, reason: 'publish_failed' });
  });

  test('buildMeetingEventDetail defaults completedAt when none is given', () => {
    const detail = buildMeetingEventDetail('t-1', after, { completedBy: 'x' });
    assert.ok(Date.parse(detail.completedAt) > 0);
  });
});
