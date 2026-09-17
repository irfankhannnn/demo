/**
 * Tests for the follow-up agent server tools (CONTRACTS.md 2.3), driven
 * through the real Express router.
 *
 * These are the tools whose side effects the follow-up service reads back
 * off the call.ended event — outcome, meeting, visitFeedback, needsHuman —
 * so the assertions are on what lands on the session, not just on the
 * speech. The CRM and DynamoDB are stood in with fakes via setDependencies.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import toolsRouter from './tools.js';
import { setDependencies } from '../handlers/serverTools.js';

const API_KEY = 'tool-key-test';
const TENANT = 't1';
const LEAD = 'lead-1';
const SESSION = 'call-1';

/** In-memory stand-in for the call-session table. */
function fakeDb(initialSession) {
  const sessions = { [initialSession.callSessionId]: { ...initialSession } };
  const transcript = [];
  return {
    sessions,
    transcript,
    async getCallSession(tenantId, callSessionId) {
      const s = sessions[callSessionId];
      return s && s.tenantId === tenantId ? { ...s } : null;
    },
    async updateCallSession(tenantId, callSessionId, updates) {
      sessions[callSessionId] = { ...sessions[callSessionId], ...updates };
      return { ...sessions[callSessionId] };
    },
    async addTranscriptEntry(tenantId, callSessionId, entry) {
      transcript.push(entry);
    },
  };
}

/** Records CRM calls; `fail` makes updateMeeting throw like a 5xx would. */
function fakeCrm({ fail = false } = {}) {
  const calls = { updateMeeting: [], addFollowupNote: [] };
  return {
    calls,
    async updateMeeting(tenantId, meetingId, payload) {
      calls.updateMeeting.push({ tenantId, meetingId, payload });
      if (fail) throw new Error('CRM unavailable');
      return {
        meetingId,
        meetingDate: payload.meetingDate || '2026-09-06',
        meetingTime: payload.meetingTime || '16:00',
        status: payload.action === 'reschedule' ? 'rescheduled' : 'scheduled',
      };
    },
    async addFollowupNote(tenantId, note) {
      calls.addFollowupNote.push({ tenantId, note });
      return { ok: true, noteId: 'note-1' };
    },
  };
}

function baseSession() {
  return {
    tenantId: TENANT,
    callSessionId: SESSION,
    leadId: LEAD,
    callPurpose: 'site_visit_confirmation',
    status: 'in_progress',
    actionsPerformed: [],
    context: {
      meeting: { meetingId: 'm-1', meetingDate: '2026-09-06', meetingTime: '16:00' },
    },
  };
}

let server;
let baseUrl;

test.before(async () => {
  process.env.SERVER_TOOL_API_KEY = API_KEY;
  const app = express();
  app.use(express.json());
  app.use('/api/ai-calling/tools', toolsRouter);
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/ai-calling/tools`;
});

test.after(async () => {
  setDependencies({});
  await new Promise((resolve) => server.close(resolve));
});

async function callTool(path, body, headers = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'x-tenant-id': TENANT,
      'x-lead-id': LEAD,
      'x-call-session-id': SESSION,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('tool routes reject a missing or wrong API key', async () => {
  const res = await fetch(`${baseUrl}/request-callback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-id': TENANT },
    body: '{}',
  });
  assert.equal(res.status, 401);
});

test('confirm-site-visit confirms the meeting from the session context', async () => {
  const db = fakeDb(baseSession());
  const crmApi = fakeCrm();
  setDependencies({ db, crmApi });

  // No meetingId in the body: the tool must pick it up from context.meeting.
  const { status, body } = await callTool('/confirm-site-visit', { action: 'confirm' });

  assert.equal(status, 200);
  assert.match(body.speech, /confirmed/i);
  assert.equal(body.meeting.meetingId, 'm-1');
  assert.equal(body.meeting.action, 'confirmed');

  assert.equal(crmApi.calls.updateMeeting.length, 1);
  const patch = crmApi.calls.updateMeeting[0];
  assert.equal(patch.tenantId, TENANT);
  assert.equal(patch.meetingId, 'm-1');
  assert.deepEqual(patch.payload, { action: 'confirm', updatedBy: 'AI Calling Agent' });

  const session = db.sessions[SESSION];
  assert.equal(session.outcome, 'site_visit_confirmed');
  assert.deepEqual(session.meeting, {
    meetingId: 'm-1',
    action: 'confirmed',
    meetingDate: '2026-09-06',
    meetingTime: '16:00',
  });
  assert.equal(session.actionsPerformed.at(-1).action, 'SITE_VISIT_CONFIRMED');
});

test('confirm-site-visit reschedules with the new date and time', async () => {
  const db = fakeDb(baseSession());
  const crmApi = fakeCrm();
  setDependencies({ db, crmApi });

  const { status, body } = await callTool('/confirm-site-visit', {
    meetingId: 'm-override',
    action: 'reschedule',
    newDate: '2026-09-08',
    newTime: '11:30',
    note: 'customer travelling on Saturday',
  });

  assert.equal(status, 200);
  assert.match(body.speech, /moved your visit/i);
  assert.match(body.speech, /8 September 2026/);
  assert.equal(body.meeting.action, 'rescheduled');

  const patch = crmApi.calls.updateMeeting[0];
  assert.equal(patch.meetingId, 'm-override', 'an explicit meetingId overrides the context');
  assert.deepEqual(patch.payload, {
    action: 'reschedule',
    meetingDate: '2026-09-08',
    meetingTime: '11:30',
    note: 'customer travelling on Saturday',
    updatedBy: 'AI Calling Agent',
  });

  const session = db.sessions[SESSION];
  assert.equal(session.outcome, 'site_visit_rescheduled');
  assert.equal(session.meeting.meetingDate, '2026-09-08');
  assert.equal(session.meeting.meetingTime, '11:30');
});

test('confirm-site-visit asks for the date before rescheduling, and for the action when unclear', async () => {
  const db = fakeDb(baseSession());
  const crmApi = fakeCrm();
  setDependencies({ db, crmApi });

  const noAction = await callTool('/confirm-site-visit', {});
  assert.equal(noAction.status, 200);
  assert.equal(noAction.body.meeting, null);
  assert.match(noAction.body.speech, /keep the visit|move it/i);

  const noDate = await callTool('/confirm-site-visit', { action: 'reschedule' });
  assert.equal(noDate.body.meeting, null);
  assert.match(noDate.body.speech, /which day/i);

  assert.equal(crmApi.calls.updateMeeting.length, 0, 'nothing should reach the CRM');
  assert.equal(db.sessions[SESSION].outcome, undefined);
});

test('confirm-site-visit with no meeting on record hands off instead of guessing', async () => {
  const session = baseSession();
  session.context = null;
  const db = fakeDb(session);
  const crmApi = fakeCrm();
  setDependencies({ db, crmApi });

  const { status, body } = await callTool('/confirm-site-visit', { action: 'confirm' });

  assert.equal(status, 200);
  assert.equal(body.meeting, null);
  assert.match(body.speech, /team confirm the timing/i);
  assert.equal(crmApi.calls.updateMeeting.length, 0);

  const stored = db.sessions[SESSION];
  assert.equal(stored.needsHuman, true);
  assert.match(stored.needsHumanReason, /no meeting is on record/);
  assert.equal(stored.outcome, 'callback_requested');
});

test('confirm-site-visit answers 200 with speech when the CRM fails mid-call', async () => {
  const db = fakeDb(baseSession());
  setDependencies({ db, crmApi: fakeCrm({ fail: true }) });

  const { status, body } = await callTool('/confirm-site-visit', { action: 'confirm' });

  // A 500 here would be dead air on the phone — the agent needs words.
  assert.equal(status, 200);
  assert.equal(body.error, 'tool_failed');
  assert.match(body.speech, /call you back/i);
});

test('visit-feedback stores structured feedback on the session and as a CRM note', async () => {
  const session = baseSession();
  session.callPurpose = 'post_visit_feedback';
  const db = fakeDb(session);
  const crmApi = fakeCrm();
  setDependencies({ db, crmApi });

  const { status, body } = await callTool('/visit-feedback', {
    liked: true,
    issues: ['parking', ' noise '],
    clarificationsNeeded: 'maintenance charges',
    tokenTimeline: 'next week',
    interestLevel: 'HIGH',
    notes: 'wants to bring wife for a second look',
  });

  assert.equal(status, 200);
  assert.deepEqual(body, { speech: '', recorded: true });

  const stored = db.sessions[SESSION];
  assert.equal(stored.outcome, 'feedback_recorded');
  assert.equal(stored.visitFeedback.liked, true);
  assert.deepEqual(stored.visitFeedback.issues, ['parking', 'noise']);
  assert.deepEqual(stored.visitFeedback.clarificationsNeeded, ['maintenance charges']);
  assert.equal(stored.visitFeedback.tokenTimeline, 'next week');
  assert.equal(stored.visitFeedback.interestLevel, 'high');
  assert.ok(stored.visitFeedback.recordedAt);
  assert.equal(stored.actionsPerformed.at(-1).action, 'VISIT_FEEDBACK_RECORDED');

  assert.equal(crmApi.calls.addFollowupNote.length, 1);
  const { tenantId, note } = crmApi.calls.addFollowupNote[0];
  assert.equal(tenantId, TENANT);
  assert.equal(note.leadId, LEAD);
  assert.equal(note.callSessionId, SESSION);
  assert.equal(note.type, 'visit_feedback');
  assert.match(note.content, /Liked the property/);
  assert.match(note.content, /parking, noise/);
  assert.match(note.content, /Token timeline: next week/);
  assert.equal(note.data.interestLevel, 'high');
});

test('visit-feedback tolerates an empty body and an unknown interest level', async () => {
  const db = fakeDb(baseSession());
  const crmApi = fakeCrm();
  setDependencies({ db, crmApi });

  const { body } = await callTool('/visit-feedback', { interestLevel: 'very keen' });

  assert.deepEqual(body, { speech: '', recorded: true });
  const stored = db.sessions[SESSION];
  assert.equal(stored.visitFeedback.liked, null);
  assert.equal(stored.visitFeedback.interestLevel, null);
  assert.deepEqual(stored.visitFeedback.issues, []);
  assert.match(crmApi.calls.addFollowupNote[0].note.content, /no specifics captured/);
});

test('visit-feedback skips the CRM note when the call has no lead', async () => {
  const db = fakeDb(baseSession());
  const crmApi = fakeCrm();
  setDependencies({ db, crmApi });

  const { body } = await callTool('/visit-feedback', { liked: false }, { 'x-lead-id': '' });

  assert.equal(body.recorded, true);
  assert.equal(crmApi.calls.addFollowupNote.length, 0);
  assert.equal(db.sessions[SESSION].outcome, 'feedback_recorded');
});

test('request-callback marks the session for a human and appends the action', async () => {
  const db = fakeDb(baseSession());
  setDependencies({ db, crmApi: fakeCrm() });

  const { status, body } = await callTool('/request-callback', {
    reason: 'asked about loan tie-ups',
    topic: 'finance',
  });

  assert.equal(status, 200);
  assert.equal(body.recorded, true);
  assert.match(body.speech, /call you back/i);

  const stored = db.sessions[SESSION];
  assert.equal(stored.needsHuman, true);
  assert.equal(stored.needsHumanReason, 'asked about loan tie-ups');
  assert.equal(stored.outcome, 'callback_requested');
  const last = stored.actionsPerformed.at(-1);
  assert.equal(last.action, 'CALLBACK_REQUESTED');
  assert.deepEqual(last.data, { reason: 'asked about loan tie-ups', topic: 'finance' });
  assert.ok(last.timestamp);
});

test('request-callback defaults the reason when the agent gives none', async () => {
  const db = fakeDb(baseSession());
  setDependencies({ db, crmApi: fakeCrm() });

  const { body } = await callTool('/request-callback', {});

  assert.equal(body.recorded, true);
  assert.equal(db.sessions[SESSION].needsHumanReason, 'customer asked for a callback');
});
