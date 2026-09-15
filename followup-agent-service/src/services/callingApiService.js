// ai-calling-service client — places the actual phone call.
//
// Payload: docs/CONTRACTS.md section 2.1. Authenticated with
// AI_CALLING_CALLER_API_KEY (== that service's CRM_CALLER_API_KEY), a
// tenant-crossing credential; x-tenant-id scopes each request.

import axios from 'axios';
import { logger } from '../utils/logger.js';
import { API_TIMEOUT_MS } from '../config/constants.js';
import { getAiCallingServiceBaseUrl } from '../config/serviceUrls.js';

let client = null;

function getClient() {
  if (client) return client;
  const baseURL = getAiCallingServiceBaseUrl();
  const apiKey = process.env.AI_CALLING_CALLER_API_KEY;
  if (!apiKey) throw new Error('Missing required secret AI_CALLING_CALLER_API_KEY');

  client = axios.create({
    baseURL,
    // Placing a call involves an ElevenLabs round trip on the other side.
    timeout: Math.max(API_TIMEOUT_MS, 15000),
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-source': 'followup-agent-service',
    },
  });
  return client;
}

export function setClient(fake) {
  client = fake;
}

export function resetClient() {
  client = null;
}

export class CallStartError extends Error {
  constructor(message, { status, retryable } = {}) {
    super(message);
    this.name = 'CallStartError';
    this.status = status ?? null;
    // 4xx from the calling service means the request itself is bad (no phone,
    // agent not configured) — retrying the same attempt would not help.
    this.retryable = retryable ?? true;
  }
}

/**
 * Start a call. Resolves `{ callSessionId, status, conversationId, callSid }`.
 * Throws CallStartError with `retryable` set for the engine to decide.
 */
export async function startCall(tenantId, payload) {
  try {
    const response = await getClient().post('/api/ai-calling/calls/start', payload, {
      headers: { 'x-tenant-id': tenantId },
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status ?? null;
    const detail = error.response?.data?.error || error.message;
    logger.error('ai-calling start failed', error, { tenantId, leadId: payload.leadId, status });
    throw new CallStartError(`startCall failed${status ? ` (${status})` : ''}: ${detail}`, {
      status,
      retryable: status == null || status >= 500 || status === 429,
    });
  }
}

export default { startCall, setClient, resetClient, CallStartError };
