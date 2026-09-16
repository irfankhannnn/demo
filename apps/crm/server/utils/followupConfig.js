/**
 * Tenant settings for the AI follow-up caller (followup-agent-service).
 *
 * One place for the six AgencyConfig keys in CONTRACTS.md section 6 — their
 * defaults, their ranges, and the two shapes they are read in: the settings
 * page (routes/aiEmployeeConfig.js) and the snapshot the follow-up service
 * pulls before every call (routes/followupInternal.js). Keeping both readers
 * on one function is what stops "default 45 minutes" from drifting between
 * them.
 */

export const FOLLOWUP_CONFIG_DEFAULTS = Object.freeze({
  followupCallOnNewInstagramLead: false,
  followupMaxAttempts: 2,
  followupRetryGapMinutes: 45,
  followupPostVisitDelayMinutes: 120,
  followupEscalationUserIds: [],
});

export const FOLLOWUP_CONFIG_RANGES = Object.freeze({
  followupMaxAttempts: [1, 5],
  followupRetryGapMinutes: [10, 240],
  followupPostVisitDelayMinutes: [0, 1440],
});

const DEFAULT_BUSINESS_HOURS_START = '10:00';
const DEFAULT_BUSINESS_HOURS_END = '19:00';
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

function isInt(value) {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * `followupCallsEnabled` has no stored default: when the tenant has never
 * touched it, follow-up calls are on exactly when the AI Employee is on.
 */
export function isFollowupCallsEnabled(config) {
  if (typeof config?.followupCallsEnabled === 'boolean') return config.followupCallsEnabled;
  return Boolean(config?.aiEmployeeEnabled);
}

function intOrDefault(value, key) {
  return isInt(value) ? value : FOLLOWUP_CONFIG_DEFAULTS[key];
}

function idList(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim()) : [];
}

/** The six keys as the settings page returns them (GET /api/crm/config/ai-employee). */
export function followupConfigResponseFields(config) {
  return {
    followupCallsEnabled: isFollowupCallsEnabled(config),
    followupCallOnNewInstagramLead: config?.followupCallOnNewInstagramLead === true,
    followupMaxAttempts: intOrDefault(config?.followupMaxAttempts, 'followupMaxAttempts'),
    followupRetryGapMinutes: intOrDefault(config?.followupRetryGapMinutes, 'followupRetryGapMinutes'),
    followupPostVisitDelayMinutes: intOrDefault(config?.followupPostVisitDelayMinutes, 'followupPostVisitDelayMinutes'),
    followupEscalationUserIds: idList(config?.followupEscalationUserIds),
  };
}

/** The `followupConfig` block of the lead snapshot (CONTRACTS.md 3.1). */
export function resolveFollowupConfig(config) {
  const fields = followupConfigResponseFields(config);
  return {
    enabled: fields.followupCallsEnabled,
    callOnNewInstagramLead: fields.followupCallOnNewInstagramLead,
    maxAttempts: fields.followupMaxAttempts,
    retryGapMinutes: fields.followupRetryGapMinutes,
    postVisitDelayMinutes: fields.followupPostVisitDelayMinutes,
    businessHoursStart: config?.businessHoursStart || DEFAULT_BUSINESS_HOURS_START,
    businessHoursEnd: config?.businessHoursEnd || DEFAULT_BUSINESS_HOURS_END,
    timezone: config?.timezone || DEFAULT_TIMEZONE,
    escalationUserIds: fields.followupEscalationUserIds,
  };
}

/**
 * Validate the follow-up keys of a PATCH body. Keys that are absent are left
 * alone (the route merges only what was sent); keys that are present must be
 * the right type and inside their range.
 *
 * @returns {{ update: object, error: string|null }}
 */
export function validateFollowupConfigPatch(body = {}) {
  const update = {};

  for (const key of ['followupCallsEnabled', 'followupCallOnNewInstagramLead']) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'boolean') {
        return { update: {}, error: `${key} must be a boolean` };
      }
      update[key] = body[key];
    }
  }

  for (const [key, [min, max]] of Object.entries(FOLLOWUP_CONFIG_RANGES)) {
    if (body[key] === undefined) continue;
    const value = typeof body[key] === 'string' && body[key].trim() !== '' ? Number(body[key]) : body[key];
    if (!isInt(value) || value < min || value > max) {
      return { update: {}, error: `${key} must be an integer between ${min} and ${max}` };
    }
    update[key] = value;
  }

  if (body.followupEscalationUserIds !== undefined) {
    const ids = body.followupEscalationUserIds;
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
      return { update: {}, error: 'followupEscalationUserIds must be an array of user ids' };
    }
    if (ids.length > 20) {
      return { update: {}, error: 'followupEscalationUserIds may list at most 20 users' };
    }
    update.followupEscalationUserIds = idList(ids);
  }

  return { update, error: null };
}
