// AI Calling Service Constants

export const CALL_STATUS = {
  INITIATED: 'initiated',
  RINGING: 'ringing',
  CONNECTED: 'connected',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  NO_ANSWER: 'no_answer',
  BUSY: 'busy',
  CANCELLED: 'cancelled',
};

export const CALL_PURPOSE = {
  LEAD_FOLLOWUP: 'lead_followup',
  PROPERTY_INQUIRY: 'property_inquiry',
  SITE_VISIT_REMINDER: 'site_visit_reminder',
  SITE_VISIT_SCHEDULING: 'site_visit_scheduling',
  GENERAL_FAQ: 'general_faq',
  PAYMENT_REMINDER: 'payment_reminder',
  // Part of the Lead Temperature migration — the agent asks a few calibrated
  // questions and reports back HOT/WARM/COLD via call-outcome's `temperature`
  // field. See CRM's server/utils/leadRubric.js for the shared rubric text.
  LEAD_QUALIFICATION: 'lead_qualification',
};

export const INTENT_TYPES = {
  PROPERTY_AVAILABILITY: 'PROPERTY_AVAILABILITY',
  PROPERTY_DETAILS: 'PROPERTY_DETAILS',
  SCHEDULE_SITE_VISIT: 'SCHEDULE_SITE_VISIT',
  FAQ_POLICY: 'FAQ_POLICY',
  AGENCY_INFO: 'AGENCY_INFO',
  PRICING_INFO: 'PRICING_INFO',
  SMALL_TALK: 'SMALL_TALK',
  HANDOFF_HUMAN: 'HANDOFF_HUMAN',
  CALL_END: 'CALL_END',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Monotonic ordering of call statuses, stored on the session as `statusRank`.
 *
 * Telephony webhooks arrive out of order and are retried, so status writes are
 * guarded by a ConditionExpression that only lets a strictly higher rank
 * through — see dynamodbService.updateCallSession. Terminal states share the
 * top rank because whichever lands first is the real outcome.
 */
export const CALL_STATUS_RANK = {
  [CALL_STATUS.INITIATED]: 0,
  [CALL_STATUS.RINGING]: 1,
  [CALL_STATUS.CONNECTED]: 2,
  [CALL_STATUS.IN_PROGRESS]: 3,
  [CALL_STATUS.COMPLETED]: 4,
  [CALL_STATUS.FAILED]: 4,
  [CALL_STATUS.NO_ANSWER]: 4,
  [CALL_STATUS.BUSY]: 4,
  [CALL_STATUS.CANCELLED]: 4,
};

/**
 * Outcome of a lead-qualification call.
 *
 * `failed` is deliberately distinct from `not_applicable`: a qualification
 * call that ended without a usable result is a data-quality problem the CRM
 * should surface, not silently indistinguishable from a call that was never
 * meant to qualify anyone.
 */
export const QUALIFICATION_STATUS = {
  NOT_APPLICABLE: 'not_applicable',
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
};

export const KNOWLEDGE_CATEGORIES = {
  FAQ: 'faq',
  POLICIES: 'policies',
  AGENCY_INFO: 'agency_info',
  PRICING: 'pricing',
};

export const DOCUMENT_STATUS = {
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  INDEXED: 'indexed',
  FAILED: 'failed',
};

export const MAX_CALL_DURATION_MS = 10 * 60 * 1000; // 10 minutes
export const CALL_TIMEOUT_MS = 30 * 1000; // 30 seconds to answer
export const API_TIMEOUT_MS = 5000; // 5 seconds for API calls
