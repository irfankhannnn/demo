/**
 * Internal API for followup-agent-service (CONTRACTS.md 3.1–3.3).
 *
 * What matters: its own key, failing closed; the snapshot shape the service
 * reads before dialling (and that a missing side-lookup degrades to null
 * rather than 500); escalation audience = assignee + admins + configured
 * extras; notes land as the AI agent.
 *
 * Runs under both `node --test` and jest.
 */

import assert from 'node:assert/strict';
import { createFollowupInternalRouter, pickMeetings, projectMeeting } from './followupInternal.js';

const isJest = Boolean(process.env.JEST_WORKER_ID);
const { describe, test } = isJest
  ? { describe: globalThis.describe, test: globalThis.test }
  : await import('node:test');

const silentLog = { info() {}, warn() {}, error() {} };
const KEY = 'followup-internal-secret';

const lead = {
  leadId: 'lead-1', name: 'Rahul', phone: '+919812345678', status: 'qualified', leadType: 'buyer',
  assignedTo: 'u-member', source: 'Instagram', sourceAdapter: 'manychat', notes: 'wants 2 BHK',
  buyerRequirement: { requirement: 'buy', budget: 18000000, preferredArea: 'Andheri West' },
};

const meetings = [
  { meetingId: 'm-done', status: 'completed', meetingDate: '2026-09-01', meetingTime: '11:00', meetingType: 'site_visit', propertyId: 'prop-old', propertyName: 'Old flat' },
  { meetingId: 'm-next', status: 'scheduled', meetingDate: '2026-09-20', meetingTime: '16:00', location: 'Lodha Park', meetingType: 'site_visit', propertyId: 'prop-1', propertyName: '2 BHK in Andheri West', title: 'Site Visit' },
  { meetingId: 'm-later', status: 'rescheduled', meetingDate: '2026-09-25', meetingTime: '10:00' },
  { meetingId: 'm-cancelled', status: 'cancelled', meetingDate: '2026-09-15', meetingTime: '10:00' },
];

const members = [
  { userId: 'u-admin', name: 'Owner', email: 'owner@agency.in', phone: '+919800000001', role: 'ADMIN' },
  { userId: 'u-member', name: 'Sameer', email: 'sameer@agency.in', phone: '+919800000002', role: 'MEMBER' },
  { userId: 'u-other', name: 'Other', email: null, phone: null, role: 'MEMBER' },
];

function fakeDeps(overrides = {}) {
  const calls = { notes: [], escalations: [] };
  const crm = {
    getLead: async (_t, id) => (id === 'lead-1' ? lead : null),
    getMeetingsByEntity: async () => meetings,
    getProperty: async (_t, id) => (id === 'prop-1' ? { propertyId: 'prop-1', title: '2 BHK in Andheri West', bhk: 2, saleInfo: { listedPrice: 18000000 }, ownerPhone: 'secret' } : null),
    createLeadNote: async (tenantId, leadId, data) => { calls.notes.push({ tenantId, leadId, data }); return { noteId: 'note-1' }; },
    ...overrides.crm,
  };
  const notifications = {
    listTeamMembers: async () => members,
    isAdminMember: (m) => ['ADMIN', 'FOUNDER', 'OWNER'].includes(m.role),
    notifyFollowupEscalation: async (tenantId, args) => { calls.escalations.push({ tenantId, args }); return { notified: args.targetUserIds }; },
    ...overrides.notifications,
  };
  const config = overrides.config === undefined
    ? { aiEmployeeEnabled: true, agencyName: 'Happy Properties', followupEscalationUserIds: ['u-extra'], businessHoursStart: '09:00' }
    : overrides.config;
  return {
    calls,
    router: createFollowupInternalRouter({
      crm: async () => crm,
      agencyConfig: async () => ({ getAgencyConfig: overrides.getAgencyConfig || (async () => config) }),
      notifications: async () => notifications,
      leadSummary: async () => (l) => `${l.name} wants to buy in ${l.buyerRequirement?.preferredArea}`,
      log: silentLog,
      env: overrides.env || { FOLLOWUP_INTERNAL_API_KEY: KEY },
      today: () => '2026-09-14',
    }),
  };
}

function send(router, { method = 'GET', url, body = {}, headers = {} }) {
  return new Promise((resolve) => {
    const req = {
      method, url, originalUrl: `/api/internal/followups${url}`, body, query: {}, params: {},
      headers: { 'x-api-key': KEY, 'x-tenant-id': 't-1', ...headers },
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); return this; },
    };
    router(req, res, () => resolve({ status: 404, body: { error: 'no route matched' } }));
  });
}

describe('auth', () => {
  test('fails closed with 500 when the key is not configured', async () => {
    const { router } = fakeDeps({ env: {} });
    const res = await send(router, { url: '/leads/lead-1/snapshot' });
    assert.equal(res.status, 500);
  });

  test('rejects a wrong key and a missing tenant header', async () => {
    const { router } = fakeDeps();
    assert.equal((await send(router, { url: '/leads/lead-1/snapshot', headers: { 'x-api-key': 'nope' } })).status, 401);
    assert.equal((await send(router, { url: '/leads/lead-1/snapshot', headers: { 'x-tenant-id': '' } })).status, 400);
  });
});

describe('GET /leads/:leadId/snapshot', () => {
  test('assembles the CONTRACTS 3.1 shape', async () => {
    const { router } = fakeDeps();
    const res = await send(router, { url: '/leads/lead-1/snapshot' });
    assert.equal(res.status, 200);
    const b = res.body;

    assert.deepEqual(b.lead, {
      leadId: 'lead-1', name: 'Rahul', phone: '+919812345678', status: 'qualified', leadType: 'buyer',
      assignedTo: 'u-member', source: 'Instagram', sourceAdapter: 'manychat',
      requirementSummary: 'Rahul wants to buy in Andheri West', notes: 'wants 2 BHK',
    });
    assert.deepEqual(b.assignee, { userId: 'u-member', name: 'Sameer', email: 'sameer@agency.in', phone: '+919800000002' });
    assert.deepEqual(b.admins, [{ userId: 'u-admin', name: 'Owner', email: 'owner@agency.in', phone: '+919800000001' }]);
    assert.equal(b.upcomingMeeting.meetingId, 'm-next');
    assert.equal(b.upcomingMeeting.propertyId, 'prop-1');
    assert.equal(b.lastCompletedMeeting.meetingId, 'm-done');
    assert.equal(b.property.propertyId, 'prop-1');
    assert.equal(b.property.price, 18000000);
    assert.equal('ownerPhone' in b.property, false);
    assert.equal(b.agencyName, 'Happy Properties');
    assert.equal(b.aiEmployeeEnabled, true);
    assert.deepEqual(b.followupConfig, {
      enabled: true, callOnNewInstagramLead: false, maxAttempts: 2, retryGapMinutes: 45, postVisitDelayMinutes: 120,
      businessHoursStart: '09:00', businessHoursEnd: '19:00', timezone: 'Asia/Kolkata', escalationUserIds: ['u-extra'],
    });
  });

  test('404s an unknown lead', async () => {
    const { router } = fakeDeps();
    assert.equal((await send(router, { url: '/leads/nope/snapshot' })).status, 404);
  });

  test('degrades to nulls when the side lookups fail instead of failing the call', async () => {
    const { router } = fakeDeps({
      crm: { getMeetingsByEntity: async () => { throw new Error('ddb down'); } },
      getAgencyConfig: async () => { throw new Error('config down'); },
      notifications: { listTeamMembers: async () => { throw new Error('auth down'); } },
    });
    const res = await send(router, { url: '/leads/lead-1/snapshot' });
    assert.equal(res.status, 200);
    assert.equal(res.body.upcomingMeeting, null);
    assert.equal(res.body.lastCompletedMeeting, null);
    assert.equal(res.body.property, null);
    assert.equal(res.body.assignee, null);
    assert.deepEqual(res.body.admins, []);
    assert.equal(res.body.aiEmployeeEnabled, false);
    assert.equal(res.body.followupConfig.enabled, false);
  });
});

describe('pickMeetings / projectMeeting', () => {
  test('earliest open meeting on or after today wins; latest completed for the visit', () => {
    const { upcoming, lastCompleted } = pickMeetings(meetings, '2026-09-14');
    assert.equal(upcoming.meetingId, 'm-next');
    assert.equal(lastCompleted.meetingId, 'm-done');
  });

  test('falls back to the most recent open meeting when none is in the future', () => {
    const { upcoming } = pickMeetings(meetings, '2026-12-01');
    assert.equal(upcoming.meetingId, 'm-later');
    assert.deepEqual(pickMeetings([], '2026-09-14'), { upcoming: null, lastCompleted: null });
  });

  test('projectMeeting keeps the contract keys only', () => {
    const out = projectMeeting({ ...meetings[1], attendeePhone: '+91', relatedEntityPhone: '+91' });
    assert.equal('attendeePhone' in out, false);
    assert.equal('relatedEntityPhone' in out, false);
    assert.equal(out.location, 'Lodha Park');
    assert.equal(projectMeeting(null), null);
  });
});

describe('POST /escalations', () => {
  test('unions the requested targets with assignee, admins and configured extras', async () => {
    const { router, calls } = fakeDeps();
    const res = await send(router, {
      method: 'POST', url: '/escalations',
      body: { leadId: 'lead-1', jobId: 'job-9', jobType: 'site_visit_confirmation', reason: 'callback_requested', summary: 'Wants a human', attempts: 2, targetUserIds: ['u-svc'], details: { needsHumanReason: 'pricing' } },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.notified.sort(), ['u-admin', 'u-extra', 'u-member', 'u-svc']);
    const { args } = calls.escalations[0];
    assert.equal(args.jobId, 'job-9');
    assert.equal(args.reason, 'callback_requested');
    assert.equal(args.lead.leadId, 'lead-1');
    assert.equal(args.details.needsHumanReason, 'pricing');
    assert.equal(args.details.attempts, 2);
  });

  test('validates the body and the lead', async () => {
    const { router } = fakeDeps();
    assert.equal((await send(router, { method: 'POST', url: '/escalations', body: { leadId: 'lead-1' } })).status, 400);
    assert.equal((await send(router, { method: 'POST', url: '/escalations', body: { leadId: 'lead-1', jobId: 'j', targetUserIds: 'u1' } })).status, 400);
    assert.equal((await send(router, { method: 'POST', url: '/escalations', body: { leadId: 'nope', jobId: 'j' } })).status, 404);
  });
});

describe('POST /notes', () => {
  test('appends a lead note as the AI follow-up agent with the structured trailer', async () => {
    const { router, calls } = fakeDeps();
    const res = await send(router, {
      method: 'POST', url: '/notes',
      body: { leadId: 'lead-1', jobId: 'job-9', callSessionId: 'cs-1', type: 'visit_feedback', content: 'Liked the flat', data: { liked: true, issues: ['parking'], tokenTimeline: 'next week', clarificationsNeeded: [] } },
    });
    assert.deepEqual(res.body, { ok: true, noteId: 'note-1' });
    const { leadId, data } = calls.notes[0];
    assert.equal(leadId, 'lead-1');
    assert.equal(data.createdBy, 'AI Follow-up Agent');
    assert.equal(data.content, '[Site visit feedback] Liked the flat\nliked: true | issues: parking | tokenTimeline: next week | clarificationsNeeded: ');
  });

  test('rejects an unknown type, empty content, and an unknown lead', async () => {
    const { router } = fakeDeps();
    assert.equal((await send(router, { method: 'POST', url: '/notes', body: { leadId: 'lead-1', type: 'x', content: 'y' } })).status, 400);
    assert.equal((await send(router, { method: 'POST', url: '/notes', body: { leadId: 'lead-1', type: 'followup_call', content: ' ' } })).status, 400);
    assert.equal((await send(router, { method: 'POST', url: '/notes', body: { leadId: 'nope', type: 'followup_call', content: 'y' } })).status, 404);
  });
});
