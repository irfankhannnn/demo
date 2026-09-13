// Exotel Telephony Service — post-call data and number handling only.
//
// Outbound dialling no longer happens here. ElevenLabs' native Exotel
// integration places the call and bridges the audio in one request (see
// elevenlabsService.initiateOutboundCall), which is what actually connects
// the customer to the agent. What remains in this module is the Exotel
// account-side data ElevenLabs doesn't expose — call detail records and
// recording URLs — plus phone-number normalization and webhook validation.

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
  parseWebhookPayload,
  validateWebhookSource,
  toE164India,
  resetClient,
};
