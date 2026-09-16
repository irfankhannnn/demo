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
const { FakeDocClient } = await import('../test/fakeDynamo.js');
const worker = await import('./worker.js');
const { JOB_TYPE, JOB_STATUS } = await import('../config/constants.js');

let cfg;

beforeEach(() => {
  db.setClient(new FakeDocClient());
  cfg = { enabled: true, businessHoursStart: '00:00', businessHoursEnd: '23:59', timezone: 'UTC' };
  crm.setClient({
    get: async () => ({
      data: {
        lead: { leadId: 'lead-1', name: 'Rahul', phone: '+919812345678' },
        admins: [], upcomingMeeting: null, lastCompletedMeeting: { meetingId: 'm-1', propertyId: 'p-1' }, property: null,
        followupConfig: cfg, aiEmployeeEnabled: true,
      },
    }),
    post: async () => ({ data: { ok: true } }),
  });
});

function ebEvent(source, detailType, detail) {
  return { source, 'detail-type': detailType, detail };
}

test('lead.created with a followUp hint schedules a confirmation job', async () => {
  const result = await worker.route(ebEvent('crm.leads', 'lead.created', {
    tenantId: 't-1', leadId: 'lead-1', phone: '+919812345678', sourceAdapter: 'insta-excel',
    followUp: { type: 'site_visit_confirmation', meetingSchedule: 'Saturday 4pm', propertyHint: '2 BHK Andheri' },
  }));
  assert.equal(result.scheduled, true);
  const jobs = await db.listJobs('t-1', { leadId: 'lead-1' });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].jobType, JOB_TYPE.SITE_VISIT_CONFIRMATION);
  assert.equal(jobs[0].context.meetingSchedule, 'Saturday 4pm');
  assert.equal(jobs[0].source, 'event:lead.created');
});

test('lead.created from Instagram without a hint is skipped unless the tenant opted in', async () => {
  const detail = { tenantId: 't-1', leadId: 'lead-1', phone: '+919812345678', sourceAdapter: 'manychat' };
  const skipped = await worker.route(ebEvent('crm.leads', 'lead.created', detail));
  assert.equal(skipped.reason, 'auto_call_disabled');

  cfg.callOnNewInstagramLead = true;
  const scheduled = await worker.route(ebEvent('crm.leads', 'lead.created', detail));
  assert.equal(scheduled.scheduled, true);
});

test('lead.created from a non-Instagram source is ignored', async () => {
  const result = await worker.route(ebEvent('crm.leads', 'lead.created', { tenantId: 't-1', leadId: 'lead-1', phone: '+91981', sourceAdapter: 'website' }));
  assert.equal(result.reason, 'no_followup_hint');
});

test('meeting.completed for a site visit schedules a post-visit job', async () => {
  const result = await worker.route(ebEvent('crm.meetings', 'meeting.completed', {
    tenantId: 't-1', meetingId: 'm-1', status: 'completed', meetingType: 'site_visit',
    relatedEntityType: 'LEAD', relatedEntityId: 'lead-1', propertyId: 'p-1', propertyName: '2 BHK',
  }));
  assert.equal(result.scheduled, true);
  const jobs = await db.listJobs('t-1', { leadId: 'lead-1' });
  assert.equal(jobs[0].jobType, JOB_TYPE.POST_VISIT_FEEDBACK);
  assert.equal(jobs[0].context.meetingId, 'm-1');
});

test('meeting.completed for a non site-visit meeting is skipped', async () => {
  const result = await worker.route(ebEvent('crm.meetings', 'meeting.completed', {
    tenantId: 't-1', meetingId: 'm-2', title: 'Office chat', relatedEntityType: 'LEAD', relatedEntityId: 'lead-1',
  }));
  assert.equal(result.reason, 'not_a_site_visit');
});

test('meeting.cancelled cancels the open job tied to that meeting', async () => {
  await worker.route(ebEvent('crm.meetings', 'meeting.completed', {
    tenantId: 't-1', meetingId: 'm-1', meetingType: 'site_visit', relatedEntityType: 'LEAD', relatedEntityId: 'lead-1',
  }));
  const result = await worker.route(ebEvent('crm.meetings', 'meeting.cancelled', {
    tenantId: 't-1', meetingId: 'm-1', relatedEntityType: 'LEAD', relatedEntityId: 'lead-1',
  }));
  assert.equal(result.cancelled.length, 1);
  const jobs = await db.listJobs('t-1', { leadId: 'lead-1' });
  assert.equal(jobs[0].status, JOB_STATUS.CANCELLED);
});

test('call.ended for a non follow-up purpose is ignored', async () => {
  const result = await worker.route(ebEvent('aicalling.calls', 'call.ended', { tenantId: 't-1', callSessionId: 'x', callPurpose: 'lead_qualification' }));
  assert.equal(result.reason, 'not_a_followup_call');
});

test('schedule tick runs without jobs', async () => {
  const result = await worker.route({ source: 'aws.events', 'detail-type': 'Scheduled Event' });
  assert.deepEqual(result, { dispatched: [], watchdog: [] });
});

test('unknown events are ignored', async () => {
  const result = await worker.route({ source: 'other', 'detail-type': 'x' });
  assert.equal(result.ignored, true);
});
