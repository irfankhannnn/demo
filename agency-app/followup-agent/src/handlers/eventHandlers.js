// EventBridge consumers — turn CRM and calling-service events into jobs or
// job outcomes. Payload shapes: docs/agency-app/followup-agent/CONTRACTS.md section 1.
//
// Errors are deliberate: a SchedulingError (business reason not to call) is
// logged and swallowed, while a transport failure (CRM unreachable) is thrown
// so Lambda's async retry + DLQ get a second chance at the event.

import * as engine from '../domain/jobEngine.js';
import * as crm from '../services/crmApiService.js';
import {
  JOB_TYPE,
  JOB_SOURCE,
  INSTAGRAM_ADAPTERS,
  FOLLOWUP_CALL_PURPOSES,
} from '../config/constants.js';
import { logger } from '../utils/logger.js';

function skipped(reason, extra = {}) {
  return { skipped: true, reason, ...extra };
}

function isBusinessSkip(error) {
  return error instanceof engine.SchedulingError;
}

export async function onLeadCreated(detail = {}) {
  const { tenantId, leadId, phone, sourceAdapter, followUp } = detail;
  if (!tenantId || !leadId) return skipped('missing_ids');

  try {
    if (followUp && typeof followUp === 'object') {
      const jobType = Object.values(JOB_TYPE).includes(followUp.type) ? followUp.type : JOB_TYPE.SITE_VISIT_CONFIRMATION;
      const { job, duplicate } = await engine.scheduleJob({
        tenantId,
        leadId,
        jobType,
        context: {
          meetingSchedule: followUp.meetingSchedule || null,
          propertyHint: followUp.propertyHint || null,
          note: followUp.note || null,
        },
        requestedBy: 'system',
        source: JOB_SOURCE.EVENT_LEAD_CREATED,
      });
      return { scheduled: !duplicate, duplicate, jobId: job.jobId };
    }

    if (!INSTAGRAM_ADAPTERS.has(sourceAdapter) || !phone) {
      return skipped('no_followup_hint');
    }

    // No explicit hint — only call if the tenant opted into calling every new
    // Instagram lead. The snapshot fetch doubles as the tenant config read.
    const snapshot = await crm.getLeadSnapshot(tenantId, leadId);
    if (!snapshot) return skipped('lead_not_found');
    const policy = engine.resolvePolicy(snapshot);
    if (!policy.callOnNewInstagramLead) return skipped('auto_call_disabled');

    const { job, duplicate } = await engine.scheduleJob({
      tenantId,
      leadId,
      jobType: JOB_TYPE.SITE_VISIT_CONFIRMATION,
      context: { note: 'New Instagram lead; confirm interest and offer a site visit.' },
      requestedBy: 'system',
      source: JOB_SOURCE.EVENT_LEAD_CREATED,
      snapshot,
    });
    return { scheduled: !duplicate, duplicate, jobId: job.jobId };
  } catch (error) {
    if (isBusinessSkip(error)) {
      logger.info('lead.created: not scheduling', { tenantId, leadId, reason: error.code });
      return skipped(error.code);
    }
    throw error;
  }
}

function isSiteVisit(detail) {
  if (String(detail.meetingType || '').toLowerCase() === 'site_visit') return true;
  return /site\s*visit/i.test(String(detail.title || ''));
}

export async function onMeetingCompleted(detail = {}) {
  const { tenantId, meetingId, relatedEntityType, relatedEntityId } = detail;
  if (!tenantId || !meetingId || !relatedEntityId) return skipped('missing_ids');
  if (String(relatedEntityType || '').toUpperCase() !== 'LEAD') return skipped('not_a_lead_meeting');
  if (!isSiteVisit(detail)) return skipped('not_a_site_visit');

  try {
    const { job, duplicate } = await engine.scheduleJob({
      tenantId,
      leadId: relatedEntityId,
      jobType: JOB_TYPE.POST_VISIT_FEEDBACK,
      context: {
        meetingId,
        propertyId: detail.propertyId || null,
        propertyName: detail.propertyName || null,
        visitDate: detail.meetingDate || null,
        visitTime: detail.meetingTime || null,
        visitOutcome: detail.outcome || null,
        completedBy: detail.completedBy || null,
      },
      requestedBy: 'system',
      source: JOB_SOURCE.EVENT_MEETING_COMPLETED,
    });
    return { scheduled: !duplicate, duplicate, jobId: job.jobId };
  } catch (error) {
    if (isBusinessSkip(error)) {
      logger.info('meeting.completed: not scheduling', { tenantId, meetingId, reason: error.code });
      return skipped(error.code);
    }
    throw error;
  }
}

export async function onMeetingCancelled(detail = {}) {
  const { tenantId, meetingId, relatedEntityType, relatedEntityId } = detail;
  if (!tenantId || !relatedEntityId) return skipped('missing_ids');
  if (String(relatedEntityType || '').toUpperCase() !== 'LEAD') return skipped('not_a_lead_meeting');
  const cancelled = await engine.cancelOpenJobsForLead(tenantId, relatedEntityId, { meetingId }, 'event:meeting.cancelled');
  return { cancelled: cancelled.map((j) => j.jobId) };
}

export async function onCallEnded(detail = {}) {
  if (!detail.followupJobId && !FOLLOWUP_CALL_PURPOSES.has(detail.callPurpose)) {
    return skipped('not_a_followup_call');
  }
  return engine.handleCallEnded(detail);
}

export default { onLeadCreated, onMeetingCompleted, onMeetingCancelled, onCallEnded };
