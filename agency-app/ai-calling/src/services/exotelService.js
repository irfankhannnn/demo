// Exotel Telephony Service — post-call data, number handling, click-to-call.
//
// AI calls are NOT dialled here. ElevenLabs' native Exotel integration places
// the call and bridges the audio in one request (see
// elevenlabsService.initiateOutboundCall), which is what actually connects
// the customer to the agent. What remains in this module is the Exotel
// account-side data ElevenLabs doesn't expose — call detail records and
// recording URLs — plus phone-number normalization and webhook validation.
//
// The one dial that does live here is connectCall(): a plain human-to-human
// bridge (team member → contact) with no agent in the loop, so there is no
// audio for ElevenLabs to own and Exotel's Calls/connect is the right tool.

import axios from 'axios';
import { logger } from '../utils/logger.js';

// Built lazily: Exotel credentials arrive from Secrets Manager during
// cold-start hydration, after this module is imported.
let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.EXOTEL_API_KEY;
    const apiToken = process.env.EXOTEL_API_TOKEN;
    const sid = process.env.EXOTEL_SID;
    const subdomain = process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com';

    if (!apiKey || !apiToken || !sid) {
      throw new Error('Missing required Exotel secrets (EXOTEL_API_KEY / EXOTEL_API_TOKEN / EXOTEL_SID)');
    }

    client = axios.create({
      baseURL: `https://${subdomain}/v1/Accounts/${sid}`,
      timeout: 30000,
      auth: { username: apiKey, password: apiToken },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }
  return client;
}

// Exposed for tests — lets a suite reset the memoized client between cases.
export function resetClient() {
  client = null;
}

// Exposed for tests — swap in a fake axios-like client ({ post, get }) so
// request encoding can be checked without Exotel credentials or a network.
export function setClient(override) {
  client = override || null;
}

/**
 * Click-to-call: ring `from` (a team member), then bridge them to `to`.
 *
 * Exotel's Calls/connect takes form-encoded fields, not JSON — the client's
 * default Content-Type is already x-www-form-urlencoded and URLSearchParams
 * serialises to exactly that. CustomField carries our correlation ids back
 * on the status webhook, the same way ElevenLabs-placed calls correlate via
 * dynamic variables.
 *
 * @param {object} params
 * @param {string} params.from - Team member's phone, E.164 (rings first)
 * @param {string} params.to - Contact's phone, E.164 (bridged second)
 * @param {string} params.callerId - The ExoPhone shown to both parties
 * @param {string} [params.statusCallbackUrl] - Our Exotel status webhook
 * @param {object|string} [params.customField] - Correlation payload
 * @returns {Promise<{callSid: string|null, status: string|null}>}
 */
export async function connectCall(params) {
  const { from, to, callerId, statusCallbackUrl, customField } = params || {};

  if (!from) throw new Error('connectCall: from is required');
  if (!to) throw new Error('connectCall: to is required');
  if (!callerId) throw new Error('connectCall: callerId is required');

  const form = new URLSearchParams();
  form.append('From', from);
  form.append('To', to);
  form.append('CallerId', callerId);
  if (statusCallbackUrl) {
    form.append('StatusCallback', statusCallbackUrl);
    // Only the final state — we don't need Exotel to ring us on every hop.
    form.append('StatusCallbackEvents[0]', 'terminal');
  }
  if (customField) {
    form.append(
      'CustomField',
      typeof customField === 'string' ? customField : JSON.stringify(customField)
    );
  }

  try {
    const response = await getClient().post('/Calls/connect.json', form);
    const call = response.data?.Call || {};
    return {
      callSid: call.Sid || null,
      status: call.Status || null,
    };
  } catch (error) {
    // Exotel puts the useful reason in the body (RestException.Message).
    const detail = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    logger.error('Exotel connect call failed', error, {
      status: error.response?.status,
      detail,
    });
    throw new Error(`Exotel connect call failed: ${detail}`);
  }
}

/**
 * Get call details from Exotel (call detail record).
 */
export async function getCallDetails(callSid) {
  if (!callSid) return null;
  try {
    const response = await getClient().get(`/Calls/${callSid}.json`);
    return response.data?.Call || null;
  } catch (error) {
    logger.error('Failed to get Exotel call details', error, { callSid });
    return null;
  }
}

/**
 * Get call recording URL.
 */
export async function getCallRecording(callSid) {
  if (!callSid) return null;
  try {
    const response = await getClient().get(`/Calls/${callSid}/Recordings.json`);
    const recordings = response.data?.Recordings;
    return recordings?.length ? recordings[0].Uri : null;
  } catch (error) {
    logger.error('Failed to get call recording', error, { callSid });
    return null;
  }
}

/**
 * End an active call at the carrier.
 */
export async function endCall(callSid) {
  if (!callSid) return false;
  try {
    const params = new URLSearchParams();
    params.append('Status', 'completed');
    await getClient().post(`/Calls/${callSid}.json`, params);
    logger.info('Call ended via Exotel', { callSid });
    return true;
  } catch (error) {
    logger.error('Failed to end call', error, { callSid });
    return false;
  }
}

/**
 * Parse Exotel status webhook payload.
 *
 * CustomField is attacker-controllable on an unauthenticated endpoint, so it
 * is parsed defensively — malformed JSON yields no correlation ids rather
 * than throwing and 500-ing the webhook route.
 */
export function parseWebhookPayload(body = {}) {
  let customField = {};
  if (body.CustomField) {
    try {
      const parsed = JSON.parse(body.CustomField);
      if (parsed && typeof parsed === 'object') customField = parsed;
    } catch {
      logger.warn('Exotel webhook CustomField was not valid JSON', { callSid: body.CallSid });
    }
  }

  return {
    callSid: body.CallSid,
    status: body.Status,
    direction: body.Direction,
    from: body.From,
    to: body.To,
    startTime: body.StartTime,
    endTime: body.EndTime,
    duration: parseInt(body.Duration || '0', 10),
    recordingUrl: body.RecordingUrl,
    tenantId: customField.tenantId,
    callSessionId: customField.callSessionId,
  };
}

/**
 * Validate an inbound Exotel webhook by source IP.
 *
 * Exotel does not sign its webhooks — it documents IP allowlisting instead.
 * EXOTEL_WEBHOOK_IPS is a comma-separated allowlist; when it is unset we fail
 * CLOSED in production and open only outside it, so a missing config can't
 * silently leave the endpoint world-writable in a deployed environment.
 *
 * The previous implementation of this function unconditionally returned true.
 *
 * @param {import('express').Request} req
 * @returns {{valid: boolean, reason?: string}}
 */
export function validateWebhookSource(req) {
  const allowlist = (process.env.EXOTEL_WEBHOOK_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (allowlist.length === 0) {
    if (process.env.ENVIRONMENT === 'prod' || process.env.NODE_ENV === 'production') {
      return { valid: false, reason: 'EXOTEL_WEBHOOK_IPS is not configured' };
    }
    logger.warn('Exotel webhook IP allowlist not configured — allowing in non-prod');
    return { valid: true };
  }

  const sourceIp = getSourceIp(req);
  if (!sourceIp) return { valid: false, reason: 'could not determine source IP' };

  // Exact match or CIDR-less prefix match (Exotel publishes plain IPs).
  const allowed = allowlist.some((entry) => sourceIp === entry || sourceIp.endsWith(`:${entry}`));
  return allowed ? { valid: true } : { valid: false, reason: 'source IP not in allowlist' };
}

function getSourceIp(req) {
  // API Gateway puts the true client IP in requestContext; behind it,
  // x-forwarded-for's first entry is the original client.
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/**
 * Normalize an Indian phone number to E.164 (+91XXXXXXXXXX).
 *
 * Returns { valid, e164, reason } rather than silently emitting whatever
 * digits it found — the previous implementation passed malformed numbers
 * straight through to the telephony API, which failed late and opaquely.
 *
 * @param {string} phone
 * @returns {{valid: boolean, e164: string|null, reason?: string}}
 */
export function toE164India(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, e164: null, reason: 'phone number is empty' };
  }

  let cleaned = phone.replace(/\D/g, '');

  // Strip country / trunk prefixes down to the bare 10-digit subscriber number.
  if (cleaned.startsWith('0091')) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = cleaned.slice(2);
  else if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = cleaned.slice(1);

  if (!INDIAN_MOBILE.test(cleaned)) {
    return {
      valid: false,
      e164: null,
      reason: `"${phone}" is not a valid Indian mobile number (expected 10 digits starting 6-9)`,
    };
  }

  return { valid: true, e164: `+91${cleaned}` };
}

export default {
  getCallDetails,
  getCallRecording,
  endCall,
  connectCall,
  parseWebhookPayload,
  validateWebhookSource,
  toE164India,
  resetClient,
  setClient,
};
