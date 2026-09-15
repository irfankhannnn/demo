import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.FOLLOWUP_TABLE_NAME = 'test-followup';
process.env.CRM_INTERNAL_API_DOMAIN_NAME = 'services-api.cloudberrysolutions.in';
process.env.CRM_INTERNAL_API_BASE_PATH = 'devrealestatecrm';
process.env.CRM_INTERNAL_API_KEY = 'crm-key';
process.env.AI_CALLING_SERVICE_DOMAIN_NAME = 'services-api.cloudberrysolutions.in';
process.env.AI_CALLING_SERVICE_BASE_PATH = 'devrealestateagencyai';
process.env.AI_CALLING_CALLER_API_KEY = 'calling-key';

const db = await import('../services/dynamodbService.js');
const crm = await import('../services/crmApiService.js');
const calling = await import('../services/callingApiService.js');
const engine = await import('./jobEngine.js');
const { FakeDocClient } = await import('../test/fakeDynamo.js');
const { JOB_STATUS, JOB_TYPE, ATTEMPT_OUTCOME, ESCALATION_REASON } = await import('../config/constants.js');

const TENANT = 't-1';
const LEAD = 'lead-1';

// Window open all day in UTC so "now" is always callable.
function snapshot(overrides = {}) {
  return {
    lead: { leadId: LEAD, name: 'Rahul', phone: '+919812345678', assignedTo: 'user-agent', requirementSummary: '2 BHK Andheri' },
    assignee: { userId: 'user-agent', name: 'Sameer' },
    admins: [{ userId: 'user-admin', name: 'Owner' }],
    upcomingMeeting: { meetingId: 'm-1', meetingDate: '2026-09-20', meetingTime: '16:00', propertyId: 'p-1', propertyName: '2 BHK in Andheri' },
    lastCompletedMeeting: null,
    property: { propertyId: 'p-1', title: '2 BHK in Andheri' },
    agencyName: 'Happy Properties',
    followupConfig: { enabled: true, businessHoursStart: '00:00', businessHoursEnd: '23:59', timezone: 'UTC', maxAttempts: 2, retryGapMinutes: 45 },
    aiEmployeeEnabled: true,
    ...overrides,
  };
}

let fake;
let crmPosts;
let callPosts;
let snapshotOverrides;
let callResponder;

beforeEach(() => {
  fake = new FakeDocClient();
  db.setClient(fake);
  crmPosts = [];
  callPosts = [];
  snapshotOverrides = {};
  // The post is recorded before the responder runs, so length == attempt number.
  callResponder = async () => ({ data: { callSessionId: `cs-${callPosts.length}`, status: 'ringing' } });
  crm.setClient({
    get: async () => ({ data: snapshot(snapshotOverrides) }),
    post: async (url, body) => { crmPosts.push({ url, body }); return { data: { ok: true } }; },
  });
  calling.setClient({
    post: async (url, body) => { callPosts.push({ url, body }); return callResponder(url, body); },
  });
});

async function scheduleConfirmation(extra = {}) {
  return engine.scheduleJob({
    tenantId: TENANT, leadId: LEAD, jobType: JOB_TYPE.SITE_VISIT_CONFIRMATION, context: { note: 'asked for a call' }, ...extra,
  });
}

test('scheduleJob creates a scheduled job and a CRM note', async () => {
  const { job, duplicate } = await scheduleConfirmation();
  assert.equal(duplicate, false);
  assert.equal(job.status, JOB_STATUS.SCHEDULED);
  assert.equal(job.maxAttempts, 2);
  assert.equal(job.context.meetingId, 'm-1');
  assert.equal(job.context.assignedAgentName, 'Sameer');
  assert.ok(new Date(job.dueAt).getTime() <= Date.now() + 1000);
  assert.equal(crmPosts.length, 1);
  assert.match(crmPosts[0].url, /\/notes$/);
});

test('scheduleJob dedupes an open job for the same lead/type/meeting', async () => {
  const first = await scheduleConfirmation();
  const second = await scheduleConfirmation();
  assert.equal(second.duplicate, true);
  assert.equal(second.job.jobId, first.job.jobId);
});

test('scheduleJob refuses a lead without a phone', async () => {
  snapshotOverrides = { lead: { leadId: LEAD, name: 'No Phone', phone: null } };
  await assert.rejects(scheduleConfirmation(), (e) => e.code === 'lead_has_no_phone' && e.statusCode === 400);
});

test('scheduleJob refuses when AI employee is disabled', async () => {
  snapshotOverrides = { aiEmployeeEnabled: false };
  await assert.rejects(scheduleConfirmation(), (e) => e.code === 'ai_employee_disabled');
});

test('post-visit job is delayed by the tenant delay setting', async () => {
  snapshotOverrides = {
    lastCompletedMeeting: { meetingId: 'm-done', propertyId: 'p-1' },
    followupConfig: { businessHoursStart: '00:00', businessHoursEnd: '23:59', timezone: 'UTC', postVisitDelayMinutes: 90 },
  };
  const before = Date.now();
  const { job } = await engine.scheduleJob({ tenantId: TENANT, leadId: LEAD, jobType: JOB_TYPE.POST_VISIT_FEEDBACK, context: { meetingId: 'm-done' } });
  const due = new Date(job.dueAt).getTime();
  assert.ok(due >= before + 89 * 60 * 1000 && due <= before + 91 * 60 * 1000, `dueAt ${job.dueAt} not ~90 min out`);
});

test('dispatch places the call and records the attempt', async () => {
  const { job } = await scheduleConfirmation();
  const results = await engine.dispatchDueJobs(new Date());
  assert.deepEqual(results.map((r) => r.result), ['called']);
  assert.equal(callPosts.length, 1);
  const payload = callPosts[0].body;
  assert.equal(payload.callPurpose, 'site_visit_confirmation');
  assert.equal(payload.leadPhone, '+919812345678');
  assert.equal(payload.metadata.followupJobId, job.jobId);
  assert.equal(payload.context.meeting.meetingId, 'm-1');
  assert.match(payload.context.instructions, /asked for a call/);

  const stored = await db.getJob(TENANT, job.jobId);
  assert.equal(stored.status, JOB_STATUS.CALLING);
  assert.equal(stored.attemptCount, 1);
  assert.equal(stored.lastCallSessionId, 'cs-1');
  const attempts = await db.listAttempts(TENANT, job.jobId);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].callSessionId, 'cs-1');

  // A second tick must not double-dispatch.
  const again = await engine.dispatchDueJobs(new Date());
  assert.equal(again.length, 0);
});

test('connected call marks the job done and writes a note', async () => {
  const { job } = await scheduleConfirmation();
  await engine.dispatchDueJobs(new Date());
  crmPosts.length = 0;
  const result = await engine.handleCallEnded({
    tenantId: TENANT, callSessionId: 'cs-1', followupJobId: job.jobId, status: 'completed', duration: 95, transcriptSummary: 'Confirmed Saturday 4pm',
  });
  assert.equal(result.status, JOB_STATUS.DONE);
  const stored = await db.getJob(TENANT, job.jobId);
  assert.equal(stored.status, JOB_STATUS.DONE);
  assert.ok(stored.ttl > 0);
  assert.ok(crmPosts.some((p) => /\/notes$/.test(p.url) && /Confirmed Saturday/.test(p.body.content)));
  assert.ok(!crmPosts.some((p) => /escalations/.test(p.url)));

  // Duplicate event is ignored.
  const dup = await engine.handleCallEnded({ tenantId: TENANT, callSessionId: 'cs-1', followupJobId: job.jobId, status: 'completed', duration: 95 });
  assert.equal(dup.ignored, 'job_not_calling');
});

test('callback request escalates to assignee and admins', async () => {
  const { job } = await scheduleConfirmation();
  await engine.dispatchDueJobs(new Date());
  crmPosts.length = 0;
  const result = await engine.handleCallEnded({
    tenantId: TENANT, callSessionId: 'cs-1', followupJobId: job.jobId, status: 'completed', duration: 60, needsHuman: true, needsHumanReason: 'wants loan details',
  });
  assert.equal(result.status, JOB_STATUS.NEEDS_HUMAN);
  const esc = crmPosts.find((p) => /escalations/.test(p.url));
  assert.ok(esc);
  assert.equal(esc.body.reason, ESCALATION_REASON.CALLBACK_REQUESTED);
  assert.deepEqual(esc.body.targetUserIds.sort(), ['user-admin', 'user-agent']);
});

test('feedback with open issues escalates as open_actions', async () => {
  snapshotOverrides = { lastCompletedMeeting: { meetingId: 'm-done', propertyId: 'p-1' } };
  const { job } = await engine.scheduleJob({ tenantId: TENANT, leadId: LEAD, jobType: JOB_TYPE.POST_VISIT_FEEDBACK, dueAt: new Date().toISOString(), context: { meetingId: 'm-done' } });
  await engine.dispatchDueJobs(new Date());
  const result = await engine.handleCallEnded({
    tenantId: TENANT, callSessionId: 'cs-1', followupJobId: job.jobId, status: 'completed', duration: 120,
    feedback: { liked: true, issues: ['parking'], clarificationsNeeded: [], tokenTimeline: 'next week' },
  });
  assert.equal(result.reason, ESCALATION_REASON.OPEN_ACTIONS);
});

test('no answer retries once then escalates after max attempts', async () => {
  const { job } = await scheduleConfirmation();
  await engine.dispatchDueJobs(new Date());

  const first = await engine.handleCallEnded({ tenantId: TENANT, callSessionId: 'cs-1', followupJobId: job.jobId, status: 'no_answer', duration: 0 });
  assert.equal(first.status, JOB_STATUS.SCHEDULED);
  let stored = await db.getJob(TENANT, job.jobId);
  assert.equal(stored.lastOutcome, ATTEMPT_OUTCOME.NOT_REACHED);
  const gapMs = new Date(stored.dueAt).getTime() - Date.now();
  assert.ok(gapMs > 40 * 60 * 1000 && gapMs <= 45 * 60 * 1000, `retry gap ${gapMs}`);

  // Second attempt, simulated by dispatching at the retry time.
  const later = new Date(new Date(stored.dueAt).getTime() + 1000);
  const results = await engine.dispatchDueJobs(later);
  assert.deepEqual(results.map((r) => r.result), ['called']);
  stored = await db.getJob(TENANT, job.jobId);
  assert.equal(stored.attemptCount, 2);
  assert.equal(stored.lastCallSessionId, 'cs-2');

  crmPosts.length = 0;
  const second = await engine.handleCallEnded({ tenantId: TENANT, callSessionId: 'cs-2', followupJobId: job.jobId, status: 'busy', duration: 0 });
  assert.equal(second.status, JOB_STATUS.ESCALATED);
  const esc = crmPosts.find((p) => /escalations/.test(p.url));
  assert.equal(esc.body.reason, ESCALATION_REASON.MAX_ATTEMPTS);
  assert.equal(esc.body.attempts, 2);
});

test('a short "completed" call counts as not reached', () => {
  assert.equal(engine.classifyCallEnded({ status: 'completed', duration: 5 }), ATTEMPT_OUTCOME.NOT_REACHED);
  assert.equal(engine.classifyCallEnded({ status: 'completed', duration: 5, meeting: { action: 'confirmed' } }), ATTEMPT_OUTCOME.CONNECTED);
  assert.equal(engine.classifyCallEnded({ status: 'failed', duration: 100 }), ATTEMPT_OUTCOME.NOT_REACHED);
});

test('a late transcript proving the call connected undoes a queued retry', async () => {
  const { job } = await scheduleConfirmation();
  await engine.dispatchDueJobs(new Date());
  await engine.handleCallEnded({ tenantId: TENANT, callSessionId: 'cs-1', followupJobId: job.jobId, status: 'completed', duration: 0, source: 'exotel_status' });
  assert.equal((await db.getJob(TENANT, job.jobId)).status, JOB_STATUS.SCHEDULED);
  const result = await engine.handleCallEnded({ tenantId: TENANT, callSessionId: 'cs-1', followupJobId: job.jobId, status: 'completed', duration: 80, source: 'elevenlabs_post_call' });
  assert.equal(result.status, JOB_STATUS.DONE);
});

test('call initiation failure counts as an attempt', async () => {
  callResponder = async () => { const e = new Error('boom'); e.response = { status: 500, data: { error: 'agent down' } }; throw e; };
  const { job } = await scheduleConfirmation();
  const results = await engine.dispatchDueJobs(new Date());
  assert.deepEqual(results.map((r) => r.result), ['call_initiation_failed']);
  const stored = await db.getJob(TENANT, job.jobId);
  assert.equal(stored.status, JOB_STATUS.SCHEDULED);
  assert.equal(stored.attemptCount, 1);
  const attempts = await db.listAttempts(TENANT, job.jobId);
  assert.equal(attempts[0].callOutcome, ATTEMPT_OUTCOME.INITIATION_FAILED);
});

test('watchdog treats a stuck calling job as not reached', async () => {
  const { job } = await scheduleConfirmation();
  await engine.dispatchDueJobs(new Date());
  const future = new Date(Date.now() + 25 * 60 * 1000);
  const results = await engine.runWatchdog(future);
  assert.equal(results.length, 1);
  assert.equal(results[0].result.status, JOB_STATUS.SCHEDULED);
  const attempts = await db.listAttempts(TENANT, job.jobId);
  assert.equal(attempts[0].callOutcome, ATTEMPT_OUTCOME.TIMEOUT);
});

test('cancel releases the dedupe guard so a new job can be scheduled', async () => {
  const { job } = await scheduleConfirmation();
  const cancelled = await engine.cancelJob(TENANT, job.jobId, 'tester');
  assert.equal(cancelled.status, JOB_STATUS.CANCELLED);
  const again = await scheduleConfirmation();
  assert.equal(again.duplicate, false);
  assert.notEqual(again.job.jobId, job.jobId);
});

test('dispatch outside business hours reschedules instead of calling', async () => {
  const { job } = await scheduleConfirmation();
  snapshotOverrides = { followupConfig: { businessHoursStart: '10:00', businessHoursEnd: '11:00', timezone: 'UTC' } };
  const at = new Date('2026-09-14T15:00:00Z');
  // Force the job due in the past relative to `at`.
  await db.rescheduleJob(TENANT, job.jobId, '2026-09-14T14:00:00.000Z');
  const results = await engine.dispatchDueJobs(at);
  assert.deepEqual(results.map((r) => r.result), ['outside_business_hours']);
  const stored = await db.getJob(TENANT, job.jobId);
  assert.equal(stored.dueAt, '2026-09-15T10:00:00.000Z');
  assert.equal(callPosts.length, 0);
});

test('listJobs filters by lead and status', async () => {
  const { job } = await scheduleConfirmation();
  const jobs = await engine.listJobs(TENANT, { leadId: LEAD, status: JOB_STATUS.SCHEDULED });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].jobId, job.jobId);
  assert.equal((await engine.listJobs(TENANT, { leadId: 'other' })).length, 0);
});
