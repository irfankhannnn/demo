// Follow-up Agent Service constants.
//
// Contracts with the CRM and ai-calling-service are documented in
// docs/agency-app/followup-agent/CONTRACTS.md — string values here must match that file.

export const JOB_TYPE = {
  SITE_VISIT_CONFIRMATION: 'site_visit_confirmation',
  POST_VISIT_FEEDBACK: 'post_visit_feedback',
};

export const JOB_STATUS = {
  SCHEDULED: 'scheduled',
  CALLING: 'calling',
  DONE: 'done',
  NEEDS_HUMAN: 'needs_human',
  ESCALATED: 'escalated',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
};

/** Statuses from which nothing further happens. */
export const TERMINAL_JOB_STATUSES = new Set([
  JOB_STATUS.DONE,
  JOB_STATUS.NEEDS_HUMAN,
  JOB_STATUS.ESCALATED,
  JOB_STATUS.CANCELLED,
  JOB_STATUS.FAILED,
]);

export const ATTEMPT_OUTCOME = {
  CONNECTED: 'connected',
  NOT_REACHED: 'not_reached',
  INITIATION_FAILED: 'call_initiation_failed',
  TIMEOUT: 'timeout',
};

export const ESCALATION_REASON = {
  MAX_ATTEMPTS: 'max_attempts_exhausted',
  CALLBACK_REQUESTED: 'callback_requested',
  OPEN_ACTIONS: 'open_actions',
  ERROR: 'error',
};

export const JOB_SOURCE = {
  EVENT_LEAD_CREATED: 'event:lead.created',
  EVENT_MEETING_COMPLETED: 'event:meeting.completed',
  API: 'api',
  CRM_ADAPTER: 'crm-adapter',
};

/** Call purposes this service places and therefore reacts to. */
export const FOLLOWUP_CALL_PURPOSES = new Set([
  JOB_TYPE.SITE_VISIT_CONFIRMATION,
  JOB_TYPE.POST_VISIT_FEEDBACK,
]);

/** EventBridge sources / detail types (default bus). */
export const EVENTS = {
  LEAD_SOURCE: 'crm.leads',
  LEAD_CREATED: 'lead.created',
  MEETING_SOURCE: 'crm.meetings',
  MEETING_COMPLETED: 'meeting.completed',
  MEETING_CANCELLED: 'meeting.cancelled',
  CALL_SOURCE: 'aicalling.calls',
  CALL_ENDED: 'call.ended',
  SCHEDULE_SOURCE: 'aws.events',
};

/** sourceAdapter values that mean "this lead came from Instagram". */
export const INSTAGRAM_ADAPTERS = new Set(['manychat', 'insta-agent', 'insta-excel']);

/**
 * A call shorter than this is treated as not connected (voicemail, an
 * immediate hang-up, or the carrier answering) even when the telephony status
 * says "completed".
 */
export const CONNECTED_MIN_SECONDS = 20;

/** Fallback policy values — tenant config from the CRM overrides these. */
export function defaultPolicy(env = process.env) {
  return {
    maxAttempts: intOr(env.DEFAULT_MAX_ATTEMPTS, 2),
    retryGapMinutes: intOr(env.DEFAULT_RETRY_GAP_MINUTES, 45),
    postVisitDelayMinutes: intOr(env.DEFAULT_POST_VISIT_DELAY_MINUTES, 120),
    businessHoursStart: env.DEFAULT_BUSINESS_HOURS_START || '10:00',
    businessHoursEnd: env.DEFAULT_BUSINESS_HOURS_END || '19:00',
    timezone: env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
    callWatchdogMinutes: intOr(env.CALL_WATCHDOG_MINUTES, 20),
  };
}

/** Finished jobs expire from the table after this long. */
export const FINISHED_JOB_TTL_DAYS = 90;

/** Dedupe guards expire after this long so a lead can be followed up again later. */
export const DEDUPE_TTL_DAYS = 14;

export const API_TIMEOUT_MS = 8000;

function intOr(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}
