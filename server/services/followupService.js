/**
 * CRM -> followup-agent-service client (CONTRACTS.md section 4).
 *
 * The only module that talks to the follow-up service. Two kinds of caller:
 *
 *  - Adapters (routes/adapterIngestionInternal.js, the ManyChat webhook) hand
 *    over a "please call this lead" hint right after ingesting. They must never
 *    fail because the follow-up stack is down or not yet deployed, so they use
 *    `forwardFollowupJob()`, which swallows every error into `{ ok: false }`.
 *  - The UI proxy routes (routes/leads.js, routes/followups.js) want the
 *    service's own status code back, so they use the throwing variants and map
 *    `FollowupServiceError` to a response.
 *
 * TRUST BOUNDARY (same as routes/aiCalling.js): the service authenticates this
 * backend as a service via FOLLOWUP_CALLER_API_KEY and then trusts the
 * x-tenant-id we send. Every function takes the tenant from the caller, which
 * must derive it from a validated session or an authenticated internal
 * request — never from a browser-supplied value.
 *
 * Config is resolved per call, not at import: ssmBootstrap hydrates
 * process.env on the Lambda cold start.
 */

import axios from 'axios';
import { logger } from '../logger.js';
import { getFollowupServiceBaseUrl } from '../config/serviceUrls.js';

export const FOLLOWUP_JOBS_PATH = '/api/followup/jobs';
export const FOLLOWUP_JOB_TYPES = ['site_visit_confirmation', 'post_visit_feedback'];
export const DEFAULT_FOLLOWUP_JOB_TYPE = 'site_visit_confirmation';
export const NOT_CONFIGURED_MESSAGE = 'Follow-up service not configured';

const DEFAULT_TIMEOUT_MS = 8000;

/** Keys that must never travel back to a browser (CONTRACTS.md section 7). */
const PHONE_KEYS = new Set([
  'phone', 'leadPhone', 'mobile', 'mobileNumber', 'alternatePhone', 'normalizedPhone',
  'contactNumber', 'whatsapp', 'whatsappNumber', 'phoneNumber',
]);

export class FollowupServiceError extends Error {
  constructor(message, { status = 502, body = null, code = 'followup_service_error' } = {}) {
    super(message);
    this.name = 'FollowupServiceError';
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

function clean(value, max = 500) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

/**
 * Normalise an adapter's `followUp` hint (CONTRACTS.md 1.1). Returns null when
 * there is nothing usable, so callers can treat "no hint" and "empty hint"
 * the same way. An unknown `type` falls back to the confirmation call rather
 * than being rejected — the hint is advisory, and a typo in a script should
 * not silently drop a lead who asked to be called.
 */
export function normalizeFollowUpHint(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = FOLLOWUP_JOB_TYPES.includes(raw.type) ? raw.type : DEFAULT_FOLLOWUP_JOB_TYPE;
  const hint = {
    type,
    meetingSchedule: clean(raw.meetingSchedule, 200),
    propertyHint: clean(raw.propertyHint, 300),
    note: clean(raw.note, 1000),
  };
  return hint;
}

/**
 * Turn a normalised hint into the POST /api/followup/jobs body for one lead.
 */
export function buildFollowupJobPayload(leadId, followUp, { requestedBy, source } = {}) {
  const hint = normalizeFollowUpHint(followUp) || { type: DEFAULT_FOLLOWUP_JOB_TYPE };
  const context = {};
  if (hint.meetingSchedule) context.meetingSchedule = hint.meetingSchedule;
  if (hint.propertyHint) context.propertyHint = hint.propertyHint;
  if (hint.note) context.note = hint.note;
  return {
    leadId,
    jobType: hint.type,
    context,
    requestedBy: requestedBy || 'crm-adapter',
    source: source || 'crm-adapter',
  };
}

/**
 * Deep-copy a job with every phone-shaped key removed. The service's job
 * shape carries no phone today; this is belt and braces for the proxy routes,
 * which promise the browser never sees a number through them.
 */
export function stripPhoneFields(value) {
  if (Array.isArray(value)) return value.map(stripPhoneFields);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (PHONE_KEYS.has(key)) continue;
    out[key] = stripPhoneFields(v);
  }
  return out;
}

/**
 * Build a client bound to explicit collaborators. The default export below is
 * the production instance; tests inject `http` and `env`.
 */
export function createFollowupService(deps = {}) {
  const http = deps.http || axios;
  const log = deps.log || logger;
  const getBaseUrl = deps.getBaseUrl || getFollowupServiceBaseUrl;
  const env = deps.env || process.env;

  /** `{ baseUrl, apiKey }` when usable, else null. Logs presence, never values. */
  function resolveConfig(context = {}) {
    let baseUrl = null;
    try {
      baseUrl = getBaseUrl();
    } catch (configError) {
      log.error('followupService.misconfigured', { ...context, error: configError.message });
      return null;
    }
    const apiKey = env.FOLLOWUP_CALLER_API_KEY;
    if (!baseUrl || !apiKey) {
      log.warn('followupService.not_configured', {
        ...context,
        hasBaseUrl: Boolean(baseUrl),
        hasApiKey: Boolean(apiKey),
      });
      return null;
    }
    return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
  }

  function isConfigured() {
    return resolveConfig() !== null;
  }

  async function request(tenantId, { method, path, data, params }) {
    if (!tenantId) {
      throw new FollowupServiceError('tenantId is required', { status: 400, code: 'tenant_required' });
    }
    const config = resolveConfig({ tenantId });
    if (!config) {
      throw new FollowupServiceError(NOT_CONFIGURED_MESSAGE, { status: 503, code: 'not_configured' });
    }

    try {
      const response = await http({
        method,
        url: `${config.baseUrl}${path}`,
        data,
        params,
        headers: {
          'x-api-key': config.apiKey,
          'x-tenant-id': tenantId,
        },
        timeout: parseInt(env.FOLLOWUP_SERVICE_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10),
      });
      return response;
    } catch (error) {
      if (error.response) {
        throw new FollowupServiceError(
          error.response.data?.error || 'Follow-up service error',
          { status: error.response.status || 502, body: error.response.data || null, code: 'upstream_error' }
        );
      }
      throw new FollowupServiceError(error.message || 'Follow-up service unreachable', {
        status: 502, code: 'unreachable',
      });
    }
  }

  /** POST /api/followup/jobs. 201 → { job }, 200 → { job, duplicate: true }. */
  async function createJob(tenantId, payload) {
    const response = await request(tenantId, { method: 'post', path: FOLLOWUP_JOBS_PATH, data: payload });
    return {
      job: response.data?.job || null,
      duplicate: response.status === 200 || Boolean(response.data?.duplicate),
    };
  }

  /** GET /api/followup/jobs?leadId=&status=&limit= → { jobs } */
  async function listJobs(tenantId, { leadId, status, limit } = {}) {
    const params = {};
    if (leadId) params.leadId = leadId;
    if (status) params.status = status;
    if (limit) params.limit = limit;
    const response = await request(tenantId, { method: 'get', path: FOLLOWUP_JOBS_PATH, params });
    return { jobs: Array.isArray(response.data?.jobs) ? response.data.jobs : [] };
  }

  /** POST /api/followup/jobs/:jobId/cancel → { job } */
  async function cancelJob(tenantId, jobId) {
    const response = await request(tenantId, {
      method: 'post',
      path: `${FOLLOWUP_JOBS_PATH}/${encodeURIComponent(jobId)}/cancel`,
    });
    return { job: response.data?.job || null };
  }

  /**
   * Fire-and-record variant for adapters. Never throws; the outcome is
   * returned so the caller can put it in its per-item result.
   *
   * @param {string} tenantId
   * @param {{leadId: string, jobType?: string, context?: object, requestedBy?: string, source?: string}} payload
   * @returns {Promise<{ok: boolean, jobId: string|null, job: object|null, duplicate: boolean, reason: string|null}>}
   */
  async function forwardFollowupJob(tenantId, payload = {}) {
    const leadId = payload.leadId;
    if (!leadId) {
      return { ok: false, jobId: null, job: null, duplicate: false, reason: 'missing_lead_id' };
    }
    const body = {
      leadId,
      jobType: FOLLOWUP_JOB_TYPES.includes(payload.jobType) ? payload.jobType : DEFAULT_FOLLOWUP_JOB_TYPE,
      context: payload.context && typeof payload.context === 'object' ? payload.context : {},
      requestedBy: payload.requestedBy || 'crm-adapter',
      source: payload.source || 'crm-adapter',
    };

    try {
      const { job, duplicate } = await createJob(tenantId, body);
      log.info('followupService.job_forwarded', {
        tenantId, leadId, jobType: body.jobType, jobId: job?.jobId || null, duplicate,
      });
      return { ok: true, jobId: job?.jobId || null, job, duplicate, reason: null };
    } catch (err) {
      const reason = err instanceof FollowupServiceError ? err.code : 'error';
      // Not configured is the expected state until the stack is deployed;
      // it is a warn, not an error, and the lead is already safely stored.
      const level = reason === 'not_configured' ? 'warn' : 'error';
      log[level]('followupService.job_forward_failed', {
        tenantId, leadId, jobType: body.jobType, reason, status: err.status || null, error: err.message,
      });
      return { ok: false, jobId: null, job: null, duplicate: false, reason };
    }
  }

  return {
    isConfigured,
    createJob,
    listJobs,
    cancelJob,
    forwardFollowupJob,
  };
}

const defaultService = createFollowupService();

export const isFollowupServiceConfigured = defaultService.isConfigured;
export const createFollowupJob = defaultService.createJob;
export const listFollowupJobs = defaultService.listJobs;
export const cancelFollowupJob = defaultService.cancelJob;
export const forwardFollowupJob = defaultService.forwardFollowupJob;

export default defaultService;
