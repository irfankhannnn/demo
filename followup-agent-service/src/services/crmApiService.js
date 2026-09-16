// CRM internal API client — lead snapshot, escalations, notes.
//
// Routes and payloads: docs/CONTRACTS.md section 3. Authenticated with
// CRM_INTERNAL_API_KEY (== the CRM's FOLLOWUP_INTERNAL_API_KEY) plus an
// explicit x-tenant-id header per request.
//
// Built lazily: the key arrives from Secrets Manager during cold-start
// hydration, which happens after this module is imported.

import axios from 'axios';
import { logger } from '../utils/logger.js';
import { API_TIMEOUT_MS } from '../config/constants.js';
import { getCrmInternalApiBaseUrl } from '../config/serviceUrls.js';

let client = null;

function getClient() {
  if (client) return client;
  const baseURL = getCrmInternalApiBaseUrl();
  const apiKey = process.env.CRM_INTERNAL_API_KEY;
  if (!apiKey) throw new Error('Missing required secret CRM_INTERNAL_API_KEY');

  client = axios.create({
    baseURL,
    timeout: API_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-source': 'followup-agent-service',
    },
  });
  return client;
}

/** Test hook. */
export function setClient(fake) {
  client = fake;
}

export function resetClient() {
  client = null;
}

function tenantHeaders(tenantId) {
  return { headers: { 'x-tenant-id': tenantId } };
}

/** Marks a CRM failure as retryable (5xx / network) vs. permanent (4xx). */
export class CrmApiError extends Error {
  constructor(message, { status, retryable } = {}) {
    super(message);
    this.name = 'CrmApiError';
    this.status = status ?? null;
    this.retryable = retryable ?? true;
  }
}

function wrap(error, label) {
  const status = error.response?.status ?? null;
  const retryable = status == null || status >= 500 || status === 429;
  return new CrmApiError(
    `${label} failed${status ? ` (${status})` : ''}: ${error.response?.data?.error || error.message}`,
    { status, retryable },
  );
}

/**
 * Everything the engine needs to decide whether and how to call a lead.
 * Returns null on 404 (lead gone), throws CrmApiError otherwise.
 */
export async function getLeadSnapshot(tenantId, leadId) {
  try {
    const response = await getClient().get(
      `/api/internal/followups/leads/${encodeURIComponent(leadId)}/snapshot`,
      tenantHeaders(tenantId),
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    logger.error('CRM snapshot failed', error, { tenantId, leadId });
    throw wrap(error, 'getLeadSnapshot');
  }
}

/** Notify the assignee + admins. Never throws: an escalation must not be lost to a notify hiccup twice over. */
export async function escalate(tenantId, payload) {
  try {
    const response = await getClient().post('/api/internal/followups/escalations', payload, tenantHeaders(tenantId));
    return response.data;
  } catch (error) {
    logger.error('CRM escalation failed', error, { tenantId, leadId: payload.leadId, jobId: payload.jobId });
    return { ok: false, error: error.message };
  }
}

/** Append a lead note. Best-effort. */
export async function addNote(tenantId, payload) {
  try {
    const response = await getClient().post('/api/internal/followups/notes', payload, tenantHeaders(tenantId));
    return response.data;
  } catch (error) {
    logger.warn('CRM note failed', { tenantId, leadId: payload.leadId, error: error.message });
    return { ok: false, error: error.message };
  }
}

export default { getLeadSnapshot, escalate, addNote, setClient, resetClient, CrmApiError };
