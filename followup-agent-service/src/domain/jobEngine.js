// Job engine — the one place that decides when to call, whether a call
// counted, when to retry, and when to give up and tell a human.
//
// Everything here is deterministic on purpose: the voice agent reports what
// happened (via ai-calling-service's call.ended event), the rules below decide
// what to do about it. That keeps retry/escalation behaviour unit-testable
// without a phone or an LLM in the loop.
//
// State machine (docs/CONTRACTS.md section 4):
//   scheduled → calling → connected → done | needs_human
//   calling → not_reached → scheduled (retry) … → escalated
//   any open → cancelled

import * as db from '../services/dynamodbService.js';
import * as crm from '../services/crmApiService.js';
import * as calling from '../services/callingApiService.js';
import {
  JOB_TYPE,
  JOB_STATUS,
  ATTEMPT_OUTCOME,
  ESCALATION_REASON,
  JOB_SOURCE,
  CONNECTED_MIN_SECONDS,
  TERMINAL_JOB_STATUSES,
  defaultPolicy,
} from '../config/constants.js';
import { nextSlotWithinWindow, addMinutes, dueBucketsToScan, zonedParts } from '../utils/time.js';
import { logger } from '../utils/logger.js';

/** Caller-error marker so routes can answer 4xx instead of 500 for bad input. */
export class SchedulingError extends Error {
  constructor(code, statusCode = 400, message) {
    super(message || code);
    this.name = 'SchedulingError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const VALID_JOB_TYPES = new Set(Object.values(JOB_TYPE));

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Tenant policy = CRM AgencyConfig values with service defaults underneath. */
export function resolvePolicy(snapshot) {
  const d = defaultPolicy();
  const c = snapshot?.followupConfig || {};
  return {
    enabled: c.enabled !== false,
    callOnNewInstagramLead: c.callOnNewInstagramLead === true,
    maxAttempts: clampInt(c.maxAttempts, 1, 5, d.maxAttempts),
    retryGapMinutes: clampInt(c.retryGapMinutes, 5, 720, d.retryGapMinutes),
    postVisitDelayMinutes: clampInt(c.postVisitDelayMinutes, 0, 1440, d.postVisitDelayMinutes),
    businessHoursStart: c.businessHoursStart || d.businessHoursStart,
    businessHoursEnd: c.businessHoursEnd || d.businessHoursEnd,
    timezone: c.timezone || d.timezone,
    escalationUserIds: Array.isArray(c.escalationUserIds) ? c.escalationUserIds.filter(Boolean) : [],
    callWatchdogMinutes: d.callWatchdogMinutes,
  };
}

export function buildDedupeKey(leadId, jobType, context = {}) {
  return `${leadId}:${jobType}:${context.meetingId || '-'}`;
}

function formatLocal(date, timezone) {
  const p = zonedParts(date, timezone);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)} (${timezone})`;
}

/**
 * Create a job for a lead. Validates the tenant is allowed to call, picks the
 * due time inside the calling window, and dedupes against open jobs.
 *
 * @returns {Promise<{job: object, duplicate: boolean}>}
 */
export async function scheduleJob({
  tenantId, leadId, jobType, dueAt, context = {}, requestedBy = 'system', source = JOB_SOURCE.API, snapshot: givenSnapshot,
}) {
  if (!tenantId) throw new SchedulingError('tenant_required', 400, 'tenantId is required');
  if (!leadId) throw new SchedulingError('lead_required', 400, 'leadId is required');
  if (!VALID_JOB_TYPES.has(jobType)) {
    throw new SchedulingError('invalid_job_type', 400, `jobType must be one of ${[...VALID_JOB_TYPES].join(', ')}`);
  }

  const snapshot = givenSnapshot || await crm.getLeadSnapshot(tenantId, leadId);
  if (!snapshot) throw new SchedulingError('lead_not_found', 404, 'Lead not found');
  if (!snapshot.aiEmployeeEnabled) throw new SchedulingError('ai_employee_disabled', 409, 'AI Employee is not enabled for this tenant');

  const policy = resolvePolicy(snapshot);
  if (!policy.enabled) throw new SchedulingError('followup_calls_disabled', 409, 'Follow-up calls are disabled for this tenant');
  if (!snapshot.lead?.phone) throw new SchedulingError('lead_has_no_phone', 400, 'Lead has no phone number to call');

  const now = new Date();
  let base = now;
  if (dueAt) {
    base = new Date(dueAt);
    if (Number.isNaN(base.getTime())) throw new SchedulingError('invalid_due_at', 400, 'dueAt must be an ISO date');
  } else if (jobType === JOB_TYPE.POST_VISIT_FEEDBACK) {
    base = addMinutes(now, policy.postVisitDelayMinutes);
  }
  const slot = nextSlotWithinWindow(base, policy);

  // Fill in what the call will need from the snapshot so dispatch can run
  // even if the CRM is briefly unreachable later (it re-fetches when it can).
  const meeting = jobType === JOB_TYPE.POST_VISIT_FEEDBACK
    ? snapshot.lastCompletedMeeting
    : snapshot.upcomingMeeting;
  const mergedContext = {
    ...context,
    meetingId: context.meetingId || meeting?.meetingId || null,
    propertyId: context.propertyId || meeting?.propertyId || snapshot.property?.propertyId || null,
    propertyName: context.propertyName || meeting?.propertyName || snapshot.property?.title || null,
    assignedAgentName: snapshot.assignee?.name || null,
    agencyName: snapshot.agencyName || null,
  };

  const { job, duplicate } = await db.createJob(tenantId, {
    leadId,
    jobType,
    dueAt: slot.toISOString(),
    context: mergedContext,
    dedupeKey: buildDedupeKey(leadId, jobType, mergedContext),
    maxAttempts: policy.maxAttempts,
    retryGapMinutes: policy.retryGapMinutes,
    requestedBy,
    source,
  });

  if (!duplicate) {
    await crm.addNote(tenantId, {
      leadId,
      jobId: job.jobId,
      type: 'followup_status',
      content: `AI follow-up call (${jobType.replace(/_/g, ' ')}) scheduled for ${formatLocal(slot, policy.timezone)}.`,
      data: { jobId: job.jobId, jobType, dueAt: job.dueAt, source },
    });
  }

  return { job, duplicate };
}

/** What we hand ai-calling-service for one attempt (docs/CONTRACTS.md 2.1). */
export function buildCallPayload(job, snapshot, attemptNumber) {
  const lead = snapshot.lead || {};
  const isPostVisit = job.jobType === JOB_TYPE.POST_VISIT_FEEDBACK;
  const meeting = isPostVisit ? snapshot.lastCompletedMeeting : snapshot.upcomingMeeting;
  const property = snapshot.property || null;
  const ctx = job.context || {};

  const instructionParts = [];
  if (ctx.meetingSchedule) instructionParts.push(`In the DM the customer indicated: "${ctx.meetingSchedule}".`);
  if (ctx.propertyHint) instructionParts.push(`Property discussed in the DM: ${ctx.propertyHint}.`);
  if (ctx.note) instructionParts.push(ctx.note);
  if (ctx.instructions) instructionParts.push(ctx.instructions);
  if (attemptNumber > 1) instructionParts.push('This is a repeat attempt; the earlier call did not connect. Keep it brief.');

  return {
    leadId: job.leadId,
    leadName: lead.name || null,
    leadPhone: lead.phone,
    callPurpose: job.jobType,
    context: {
      meeting: meeting || null,
      property: isPostVisit ? null : property,
      visitedProperty: isPostVisit ? property : null,
      assignedAgentName: snapshot.assignee?.name || ctx.assignedAgentName || null,
      dmSummary: lead.requirementSummary || null,
      instructions: instructionParts.join(' ') || null,
    },
    metadata: {
      followupJobId: job.jobId,
      attempt: attemptNumber,
      source: 'followup-agent-service',
    },
  };
}

/** Which jobs are due and place their calls. Returns one result per job touched. */
export async function dispatchDueJobs(now = new Date()) {
  const nowIso = now.toISOString();
  const results = [];
  for (const bucket of dueBucketsToScan(now)) {
    const jobs = await db.queryDueJobs(bucket, nowIso);
    for (const job of jobs) {
      try {
        results.push({ jobId: job.jobId, tenantId: job.tenantId, result: await dispatchJob(job, now) });
      } catch (error) {
        logger.error('dispatch failed', error, { jobId: job.jobId, tenantId: job.tenantId });
        results.push({ jobId: job.jobId, tenantId: job.tenantId, result: 'error', error: error.message });
      }
    }
  }
  return results;
}

async function dispatchJob(job, now) {
  const { tenantId, jobId } = job;
  const nowIso = now.toISOString();

  try {
    await db.claimJob(tenantId, jobId, nowIso);
  } catch (error) {
    if (error instanceof db.ConditionFailedError) return 'claimed_elsewhere';
    throw error;
  }

  let snapshot;
  try {
    snapshot = await crm.getLeadSnapshot(tenantId, job.leadId);
  } catch (error) {
    // CRM down: give the claim back and let the next tick try again.
    await db.rescheduleJob(tenantId, jobId, addMinutes(now, 5).toISOString(), { lastOutcome: 'crm_unavailable' });
    return 'crm_unavailable';
  }

  if (!snapshot) {
    await db.finishJob(tenantId, jobId, JOB_STATUS.FAILED, { lastOutcome: 'lead_not_found' });
    return 'lead_not_found';
  }

  const policy = resolvePolicy(snapshot);
  if (!snapshot.aiEmployeeEnabled || !policy.enabled) {
    await db.finishJob(tenantId, jobId, JOB_STATUS.CANCELLED, { lastOutcome: 'followup_calls_disabled' });
    await db.releaseDedupeGuard(tenantId, job.dedupeKey);
    return 'followup_calls_disabled';
  }

  // Business hours may have changed since scheduling; never call outside them.
  const slot = nextSlotWithinWindow(now, policy);
  if (slot.getTime() > now.getTime()) {
    await db.rescheduleJob(tenantId, jobId, slot.toISOString(), { lastOutcome: 'outside_business_hours' });
    return 'outside_business_hours';
  }

  if (!snapshot.lead?.phone) {
    await db.finishJob(tenantId, jobId, JOB_STATUS.FAILED, { lastOutcome: 'lead_has_no_phone' });
    await escalate(job, snapshot, policy, ESCALATION_REASON.ERROR, { message: 'Lead has no phone number to call' });
    return 'lead_has_no_phone';
  }

  const attemptNumber = (job.attemptCount || 0) + 1;
  const payload = buildCallPayload(job, snapshot, attemptNumber);

  let call;
  try {
    call = await calling.startCall(tenantId, payload);
  } catch (error) {
    await db.putAttempt(tenantId, jobId, attemptNumber, {
      startedAt: nowIso,
      endedAt: nowIso,
      outcome: ATTEMPT_OUTCOME.NOT_REACHED,
      callOutcome: ATTEMPT_OUTCOME.INITIATION_FAILED,
      error: error.message,
      source: 'dispatch',
    });
    const updated = await db.updateJob(tenantId, jobId, { attemptCount: attemptNumber, lastAttemptAt: nowIso });
    logger.jobEvent('CALL_INITIATION_FAILED', updated, { attemptNumber, retryable: error.retryable });
    await handleAttemptResult(updated, snapshot, policy, {
      attemptNumber,
      outcome: ATTEMPT_OUTCOME.NOT_REACHED,
      detail: { outcome: ATTEMPT_OUTCOME.INITIATION_FAILED, error: error.message },
      now,
    });
    return 'call_initiation_failed';
  }

  await db.putAttempt(tenantId, jobId, attemptNumber, {
    startedAt: nowIso,
    callSessionId: call.callSessionId,
    callStatus: call.status || 'ringing',
    source: 'dispatch',
  });
  const updated = await db.updateJob(tenantId, jobId, {
    attemptCount: attemptNumber,
    lastAttemptAt: nowIso,
    lastCallSessionId: call.callSessionId,
    GSI3PK: `CALL#${call.callSessionId}`,
    GSI3SK: 'JOB',
  });
  logger.jobEvent('CALL_PLACED', updated, { attemptNumber, callSessionId: call.callSessionId });
  return 'called';
}

/** Did the customer actually talk to the agent? */
export function classifyCallEnded(detail = {}) {
  const status = String(detail.status || '').toLowerCase();
  const duration = Number(detail.duration) || 0;
  const toolEvidence = Boolean(detail.needsHuman || detail.feedback || detail.meeting);
  if (status === 'completed' && (duration >= CONNECTED_MIN_SECONDS || toolEvidence)) {
    return ATTEMPT_OUTCOME.CONNECTED;
  }
  return ATTEMPT_OUTCOME.NOT_REACHED;
}

/** Anything from a connected call that a human must pick up. */
export function collectEscalationReason(detail = {}) {
  if (detail.needsHuman) return ESCALATION_REASON.CALLBACK_REQUESTED;
  const fb = detail.feedback || {};
  const open = [
    ...(Array.isArray(fb.clarificationsNeeded) ? fb.clarificationsNeeded : []),
    ...(Array.isArray(fb.issues) ? fb.issues : []),
  ].filter(Boolean);
  if (open.length) return ESCALATION_REASON.OPEN_ACTIONS;
  return null;
}

/**
 * Consume an `aicalling.calls` / `call.ended` event. Idempotent: the same
 * session may report twice (Exotel status, then the ElevenLabs transcript),
 * and the second report may carry more data than the first.
 */
export async function handleCallEnded(detail, now = new Date()) {
  const { tenantId, callSessionId, followupJobId } = detail || {};
  if (!tenantId) return { ignored: 'no_tenant' };

  let job = followupJobId ? await db.getJob(tenantId, followupJobId) : null;
  if (!job && callSessionId) job = await db.findJobByCallSession(callSessionId);
  if (!job) return { ignored: 'no_job' };

  const sameSession = !callSessionId || !job.lastCallSessionId || job.lastCallSessionId === callSessionId;
  if (!sameSession) return { ignored: 'stale_session', jobId: job.jobId };

  const attemptNumber = job.attemptCount || 0;
  const outcome = classifyCallEnded(detail);

  // Always enrich the attempt row; the later event usually knows more.
  if (attemptNumber > 0) {
    await db.updateAttempt(tenantId, job.jobId, attemptNumber, {
      endedAt: detail.endedAt || now.toISOString(),
      callStatus: detail.status || null,
      callOutcome: detail.outcome || null,
      duration: detail.duration ?? null,
      transcriptSummary: detail.transcriptSummary || null,
      needsHuman: Boolean(detail.needsHuman),
      needsHumanReason: detail.needsHumanReason || null,
      feedback: detail.feedback || null,
      meeting: detail.meeting || null,
      outcome,
      source: detail.source || null,
    }).catch((error) => logger.warn('attempt enrichment failed', { jobId: job.jobId, error: error.message }));
  }

  let expectedStatus;
  if (job.status === JOB_STATUS.CALLING) {
    expectedStatus = JOB_STATUS.CALLING;
  } else if (job.status === JOB_STATUS.SCHEDULED && outcome === ATTEMPT_OUTCOME.CONNECTED && job.lastCallSessionId === callSessionId) {
    // A quick Exotel "completed, 0s" already queued a retry, and now the
    // transcript proves the customer did talk. Undo the retry.
    expectedStatus = JOB_STATUS.SCHEDULED;
  } else {
    return { ignored: 'job_not_calling', jobId: job.jobId, status: job.status };
  }

  let snapshot = null;
  try {
    snapshot = await crm.getLeadSnapshot(tenantId, job.leadId);
  } catch (error) {
    logger.warn('snapshot unavailable while handling call.ended', { jobId: job.jobId, error: error.message });
  }
  const policy = resolvePolicy(snapshot);

  return handleAttemptResult(job, snapshot, policy, { attemptNumber, outcome, detail, now, expectedStatus });
}

/**
 * Apply the retry / escalate rules after one attempt has a known outcome.
 * `expectedStatus` guards the state transition so a duplicate event loses.
 */
export async function handleAttemptResult(job, snapshot, policy, {
  attemptNumber, outcome, detail = {}, now = new Date(), expectedStatus = JOB_STATUS.CALLING,
}) {
  const { tenantId, jobId, leadId } = job;
  const maxAttempts = job.maxAttempts || policy.maxAttempts;

  try {
    if (outcome === ATTEMPT_OUTCOME.CONNECTED) {
      const reason = collectEscalationReason(detail);
      const summary = detail.transcriptSummary || null;

      if (reason) {
        const finished = await db.finishJob(tenantId, jobId, JOB_STATUS.NEEDS_HUMAN, {
          lastOutcome: ATTEMPT_OUTCOME.CONNECTED,
          escalatedAt: now.toISOString(),
          escalationReason: reason,
        }, { expectedStatus });
        logger.jobEvent('JOB_NEEDS_HUMAN', finished, { reason, attemptNumber });
        await escalate(finished, snapshot, policy, reason, {
          transcriptSummary: summary,
          feedback: detail.feedback || null,
          needsHumanReason: detail.needsHumanReason || null,
          meeting: detail.meeting || null,
        });
        return { status: JOB_STATUS.NEEDS_HUMAN, reason };
      }

      const finished = await db.finishJob(tenantId, jobId, JOB_STATUS.DONE, {
        lastOutcome: ATTEMPT_OUTCOME.CONNECTED,
      }, { expectedStatus });
      logger.jobEvent('JOB_DONE', finished, { attemptNumber });
      await crm.addNote(tenantId, {
        leadId,
        jobId,
        callSessionId: job.lastCallSessionId,
        type: 'followup_call',
        content: `AI follow-up call (${job.jobType.replace(/_/g, ' ')}) completed on attempt ${attemptNumber}.${summary ? ` Summary: ${summary}` : ''}`,
        data: { jobId, attemptNumber, outcome: detail.outcome || null, meeting: detail.meeting || null, feedback: detail.feedback || null },
      });
      return { status: JOB_STATUS.DONE };
    }

    // Not reached.
    if (attemptNumber < maxAttempts) {
      const next = nextSlotWithinWindow(addMinutes(now, job.retryGapMinutes || policy.retryGapMinutes), policy);
      const rescheduled = await db.rescheduleJob(tenantId, jobId, next.toISOString(), {
        lastOutcome: ATTEMPT_OUTCOME.NOT_REACHED,
      });
      logger.jobEvent('JOB_RETRY_SCHEDULED', rescheduled, { attemptNumber, nextDueAt: next.toISOString() });
      await crm.addNote(tenantId, {
        leadId,
        jobId,
        type: 'followup_status',
        content: `AI follow-up call attempt ${attemptNumber} of ${maxAttempts} did not connect (${detail.outcome || detail.status || 'no answer'}). Retrying at ${formatLocal(next, policy.timezone)}.`,
        data: { jobId, attemptNumber, nextDueAt: next.toISOString() },
      });
      return { status: JOB_STATUS.SCHEDULED, nextDueAt: next.toISOString() };
    }

    const finished = await db.finishJob(tenantId, jobId, JOB_STATUS.ESCALATED, {
      lastOutcome: ATTEMPT_OUTCOME.NOT_REACHED,
      escalatedAt: now.toISOString(),
      escalationReason: ESCALATION_REASON.MAX_ATTEMPTS,
    }, { expectedStatus });
    logger.jobEvent('JOB_ESCALATED', finished, { attemptNumber });
    await escalate(finished, snapshot, policy, ESCALATION_REASON.MAX_ATTEMPTS, {
      lastCallStatus: detail.status || detail.outcome || null,
    });
    return { status: JOB_STATUS.ESCALATED, reason: ESCALATION_REASON.MAX_ATTEMPTS };
  } catch (error) {
    if (error instanceof db.ConditionFailedError) {
      return { ignored: 'already_handled', jobId };
    }
    throw error;
  }
}

/** Tell the assignee + owner. Never throws. */
export async function escalate(job, snapshot, policy, reason, details = {}) {
  const targetUserIds = [...new Set([
    snapshot?.lead?.assignedTo,
    ...((snapshot?.admins || []).map((a) => a.userId)),
    ...policy.escalationUserIds,
  ].filter(Boolean))];

  const leadName = snapshot?.lead?.name || 'the lead';
  const jobLabel = job.jobType.replace(/_/g, ' ');
  const summaryByReason = {
    [ESCALATION_REASON.MAX_ATTEMPTS]: `AI could not reach ${leadName} after ${job.attemptCount} call attempt(s) for ${jobLabel}. Please call them.`,
    [ESCALATION_REASON.CALLBACK_REQUESTED]: `${leadName} asked for a human during the ${jobLabel} call${details.needsHumanReason ? `: ${details.needsHumanReason}` : ''}.`,
    [ESCALATION_REASON.OPEN_ACTIONS]: `${leadName} raised points on the ${jobLabel} call that need your follow-up.`,
    [ESCALATION_REASON.ERROR]: `The AI follow-up for ${leadName} could not proceed${details.message ? `: ${details.message}` : ''}.`,
  };

  const result = await crm.escalate(job.tenantId, {
    leadId: job.leadId,
    jobId: job.jobId,
    jobType: job.jobType,
    reason,
    summary: summaryByReason[reason] || `Follow-up needs attention (${reason}).`,
    attempts: job.attemptCount || 0,
    lastCallSessionId: job.lastCallSessionId || null,
    targetUserIds,
    details,
  });
  logger.jobEvent('ESCALATION_SENT', job, { reason, targets: targetUserIds.length, ok: result?.ok !== false });
  return result;
}

/** Jobs stuck in "calling" with no terminal event: count the attempt as failed. */
export async function runWatchdog(now = new Date()) {
  const minutes = defaultPolicy().callWatchdogMinutes;
  const before = addMinutes(now, -minutes).toISOString();
  const stuck = await db.queryStuckCallingJobs(before);
  const results = [];
  for (const job of stuck) {
    try {
      const attemptNumber = job.attemptCount || 0;
      if (attemptNumber > 0) {
        await db.updateAttempt(job.tenantId, job.jobId, attemptNumber, {
          endedAt: now.toISOString(),
          outcome: ATTEMPT_OUTCOME.NOT_REACHED,
          callOutcome: ATTEMPT_OUTCOME.TIMEOUT,
          source: 'watchdog',
        }).catch(() => {});
      }
      let snapshot = null;
      try { snapshot = await crm.getLeadSnapshot(job.tenantId, job.leadId); } catch { /* policy defaults */ }
      const policy = resolvePolicy(snapshot);
      logger.jobEvent('CALL_WATCHDOG_TIMEOUT', job, { attemptNumber, claimedAt: job.claimedAt });
      results.push({
        jobId: job.jobId,
        result: await handleAttemptResult(job, snapshot, policy, {
          attemptNumber,
          outcome: ATTEMPT_OUTCOME.NOT_REACHED,
          detail: { outcome: ATTEMPT_OUTCOME.TIMEOUT },
          now,
        }),
      });
    } catch (error) {
      logger.error('watchdog failed for job', error, { jobId: job.jobId });
      results.push({ jobId: job.jobId, result: 'error', error: error.message });
    }
  }
  return results;
}

export async function cancelJob(tenantId, jobId, cancelledBy = 'api') {
  const job = await db.getJob(tenantId, jobId);
  if (!job) throw new SchedulingError('job_not_found', 404, 'Job not found');
  if (TERMINAL_JOB_STATUSES.has(job.status)) return job;
  try {
    const finished = await db.finishJob(tenantId, jobId, JOB_STATUS.CANCELLED, {
      lastOutcome: 'cancelled',
      cancelledBy,
    }, { expectedStatus: [JOB_STATUS.SCHEDULED, JOB_STATUS.CALLING] });
    await db.releaseDedupeGuard(tenantId, job.dedupeKey);
    logger.jobEvent('JOB_CANCELLED', finished, { cancelledBy });
    return finished;
  } catch (error) {
    if (error instanceof db.ConditionFailedError) return db.getJob(tenantId, jobId);
    throw error;
  }
}

/** Cancel every open job of a given type for a lead (used when a meeting is cancelled). */
export async function cancelOpenJobsForLead(tenantId, leadId, { jobType, meetingId } = {}, cancelledBy = 'system') {
  const jobs = await db.listJobs(tenantId, { leadId, status: JOB_STATUS.SCHEDULED, limit: 50 });
  const cancelled = [];
  for (const job of jobs) {
    if (jobType && job.jobType !== jobType) continue;
    if (meetingId && job.context?.meetingId && job.context.meetingId !== meetingId) continue;
    cancelled.push(await cancelJob(tenantId, job.jobId, cancelledBy));
  }
  return cancelled;
}

export async function runNow(tenantId, jobId) {
  const job = await db.getJob(tenantId, jobId);
  if (!job) throw new SchedulingError('job_not_found', 404, 'Job not found');
  if (job.status !== JOB_STATUS.SCHEDULED) {
    throw new SchedulingError('job_not_scheduled', 409, `Job is ${job.status}, only scheduled jobs can be run now`);
  }
  return db.rescheduleJob(tenantId, jobId, new Date().toISOString(), { requestedRunNowAt: new Date().toISOString() });
}

export async function getJobWithAttempts(tenantId, jobId) {
  const job = await db.getJob(tenantId, jobId);
  if (!job) return null;
  const attempts = await db.listAttempts(tenantId, jobId);
  return { job, attempts };
}

export const listJobs = db.listJobs;

export default {
  scheduleJob,
  dispatchDueJobs,
  handleCallEnded,
  handleAttemptResult,
  runWatchdog,
  cancelJob,
  cancelOpenJobsForLead,
  runNow,
  getJobWithAttempts,
  listJobs,
  resolvePolicy,
  buildCallPayload,
  classifyCallEnded,
  collectEscalationReason,
  SchedulingError,
};
