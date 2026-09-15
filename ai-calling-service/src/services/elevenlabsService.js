// ElevenLabs Agents Platform Service — native Exotel telephony integration.
//
// ElevenLabs places the call AND bridges the audio to the agent in a single
// request (POST /v1/convai/exotel/outbound-call). We no longer dial via
// Exotel ourselves and we no longer create a "conversation" as a separate
// REST object — both of those were part of the old split design, which never
// actually connected the customer's audio to the agent.
//
// Per-call personalization is delivered as `dynamic_variables` inside
// `conversation_initiation_client_data`, referenced as {{placeholders}} in the
// single shared agent's system prompt (see elevenlabs-agent-prompt.md). One
// agent serves every tenant; config.agentId remains an optional per-tenant
// override.

import crypto from 'node:crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import {
  normalizeMeetingDetails,
  normalizePropertyBrief,
} from '../utils/responseNormalizer.js';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

// Built lazily: the API key arrives from Secrets Manager during cold-start
// hydration, which happens after this module is imported.
let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('Missing required secret ELEVENLABS_API_KEY');
    }
    client = axios.create({
      baseURL: ELEVENLABS_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
    });
  }
  return client;
}

// Exposed for tests — lets a suite reset the memoized client between cases.
export function resetClient() {
  client = null;
}

// Hot/Warm/Cold rubric — kept in sync by hand with server/utils/leadRubric.js
// in the main CRM repo (LEAD_TEMPERATURE_RUBRIC). Duplicated rather than
// imported because ai-calling-service deploys as its own package/stack and
// can't rely on a relative path into server/ surviving packaging.
//
// This text is passed to the agent as the {{rubric}} dynamic variable rather
// than baked into the prompt, so the CRM stays the single source of truth.
export const LEAD_TEMPERATURE_RUBRIC = `HOT: the customer wants a property immediately AND has already named
a specific area or building (not just "somewhere nice").
WARM: the customer wants to visit a property and decide in person,
but hasn't fixed on one area/building yet.
COLD: the customer's timeline is roughly a couple of months out —
early research, not ready to commit or visit yet.`;

/**
 * Build the dynamic_variables map for one call.
 *
 * Every value must be a string — ElevenLabs substitutes these into the
 * agent's prompt template verbatim. Nulls are replaced with explicit
 * "not known" text so the agent never renders the literal word "null" and
 * never has an unsubstituted {{placeholder}} left in its prompt.
 *
 * @param {object} config - Per-call context
 * @returns {Record<string, string>}
 */
export function buildDynamicVariables(config = {}) {
  const rubricContext = config.rubricContext || {};
  // Follow-up context (CONTRACTS.md 2.1). Every field is optional and most
  // calls carry none of it, so each one renders to explicit "not known" prose.
  const context = config.context || {};

  return {
    agency_name: config.agencyName || 'our real estate agency',
    lead_name: config.leadName || 'there',
    call_purpose: config.callPurpose || 'lead_followup',
    lead_context: config.leadContext || 'No previous interactions on record.',
    rubric: LEAD_TEMPERATURE_RUBRIC,
    has_named_area: rubricContext.hasNamedAreaOrBuilding
      ? 'Yes — they have already named a specific area or building.'
      : 'Not yet — ask them directly.',
    greeting: config.greeting || '',
    escalation_phone: config.escalationPhone || '',
    // Site-visit confirmation / post-visit feedback context. Rendered as
    // spoken prose here (dates as "6 September", prices in lakh/crore) so the
    // prompt never has to teach the agent how to read a JSON blob aloud.
    meeting_details:
      normalizeMeetingDetails(context.meeting) ||
      'No visit is booked on record — ask the customer if one was agreed.',
    property_details:
      normalizePropertyBrief(context.property) ||
      'The specific property is not known — ask which one they were looking at.',
    visit_details:
      normalizePropertyBrief(context.visitedProperty) ||
      normalizePropertyBrief(context.property) ||
      'The property they visited is not on record — ask them which one it was.',
    assigned_agent_name: context.assignedAgentName || 'one of our agents',
    dm_summary: context.dmSummary || 'No earlier chat summary on record.',
    extra_instructions: context.instructions || 'None.',
    // Passed so server tools invoked mid-call can scope themselves to the
    // right tenant/lead without the agent having to know or repeat them.
    // secret__ prefix keeps these out of the LLM provider payload.
    secret__tenant_id: config.tenantId || '',
    secret__lead_id: config.leadId || '',
    secret__call_session_id: config.callSessionId || '',
  };
}

/**
 * Place an outbound call through ElevenLabs' native Exotel integration.
 *
 * This single request dials the customer via Exotel and bridges the audio to
 * the agent over ElevenLabs' websocket — there is no separate Exotel API call
 * and no audio bridge for us to maintain.
 *
 * @param {object} params
 * @param {string} params.agentId - ElevenLabs agent (shared, or tenant override)
 * @param {string} params.agentPhoneNumberId - ElevenLabs-registered ExoPhone id
 * @param {string} params.toNumber - Customer phone, E.164
 * @param {object} params.dynamicVariables - Per-call prompt variables
 * @param {number} [params.maxDurationSeconds]
 * @param {boolean} [params.recordingEnabled]
 * @param {string} params.callSessionId - Ours, for logging correlation
 * @param {string} params.tenantId - Ours, for logging correlation
 * @returns {Promise<{conversationId: string|null, callSid: string|null, success: boolean, message: string}>}
 */
export async function initiateOutboundCall(params) {
  const {
    agentId,
    agentPhoneNumberId,
    toNumber,
    dynamicVariables,
    maxDurationSeconds,
    recordingEnabled,
    callSessionId,
    tenantId,
  } = params;

  if (!agentId) throw new Error('ElevenLabs agent id is not configured');
  if (!agentPhoneNumberId) throw new Error('ElevenLabs agent phone number id is not configured');
  if (!toNumber) throw new Error('Destination phone number is required');

  const body = {
    agent_id: agentId,
    agent_phone_number_id: agentPhoneNumberId,
    to_number: toNumber,
    conversation_initiation_client_data: {
      dynamic_variables: dynamicVariables || {},
    },
    telephony_call_config: {
      ringing_timeout_secs: 60,
    },
  };

  if (maxDurationSeconds) {
    body.conversation_initiation_client_data.conversation_config_override = {
      conversation: { max_duration_seconds: maxDurationSeconds },
    };
  }

  if (recordingEnabled !== undefined) {
    body.telephony_call_config.twilio_call_recording_enabled = !!recordingEnabled;
  }

  try {
    const response = await getClient().post('/convai/exotel/outbound-call', body);
    const data = response.data || {};

    logger.callEvent('ELEVENLABS_EXOTEL_CALL_PLACED', callSessionId, tenantId, {
      conversationId: data.conversation_id,
      callSid: data.callSid,
      agentId,
      success: data.success,
    });

    return {
      success: data.success !== false,
      message: data.message || '',
      conversationId: data.conversation_id || null,
      callSid: data.callSid || null,
    };
  } catch (error) {
    // ElevenLabs returns useful validation detail in the body; surface it
    // rather than only the generic axios status text.
    const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    logger.error('ElevenLabs Exotel outbound call failed', error, {
      callSessionId,
      tenantId,
      status: error.response?.status,
      detail,
    });
    throw new Error(`ElevenLabs outbound call failed: ${detail}`);
  }
}

/**
 * Fetch full conversation details (transcript, metadata, analysis).
 *
 * Replaces the old GET /convai/conversations/:id/transcript, which is not a
 * real endpoint — the transcript is a field on the conversation record.
 *
 * @param {string} conversationId
 * @returns {Promise<object|null>}
 */
export async function getConversation(conversationId) {
  if (!conversationId) return null;
  try {
    const response = await getClient().get(`/convai/conversations/${conversationId}`);
    return response.data || null;
  } catch (error) {
    logger.error('Failed to get ElevenLabs conversation', error, {
      conversationId,
      status: error.response?.status,
    });
    return null;
  }
}

/**
 * Normalize an ElevenLabs transcript into our stored shape.
 *
 * ElevenLabs turns look like { role: 'user'|'agent', message, time_in_call_secs }.
 * Older/alternate shapes use `text` — accept both rather than silently
 * dropping every turn if the field name differs.
 *
 * @param {object} conversation - as returned by getConversation()
 * @returns {Array<{speaker: string, text: string, timeInCallSecs: number|null}>}
 */
export function normalizeTranscript(conversation) {
  const turns = conversation?.transcript;
  if (!Array.isArray(turns)) return [];

  return turns
    .map((turn) => ({
      speaker: turn.role === 'agent' ? 'ai' : 'customer',
      text: turn.message ?? turn.text ?? '',
      timeInCallSecs: turn.time_in_call_secs ?? null,
    }))
    .filter((turn) => turn.text);
}

const QUALIFICATION_RESULT_PATTERN = /\[QUALIFICATION_RESULT:\s*(\{[^}]*\})\s*\]/i;

/**
 * Fallback qualification extraction: scan a normalized transcript for a
 * `[QUALIFICATION_RESULT: {...}]` marker.
 *
 * The primary path is now the `submit_qualification` server tool — the agent
 * calls it and we record the result directly, which is both more reliable and
 * avoids the old design's flaw of the agent literally speaking JSON aloud to
 * the customer. This scanner stays only as a fallback for calls where the tool
 * wasn't invoked but the agent emitted the marker anyway.
 *
 * @param {Array<{text: string}>} transcript
 * @returns {{temperature: string, reasons: string}|null}
 */
export function extractQualificationResult(transcript) {
  if (!Array.isArray(transcript)) return null;

  for (let i = transcript.length - 1; i >= 0; i--) {
    const text = transcript[i]?.text;
    if (!text) continue;
    const match = String(text).match(QUALIFICATION_RESULT_PATTERN);
    if (!match) continue;
    try {
      const parsed = JSON.parse(match[1]);
      const temperature = String(parsed.temperature || '').toUpperCase();
      if (!['HOT', 'WARM', 'COLD'].includes(temperature)) continue;
      return {
        temperature,
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons.join('; ') : String(parsed.reasons || ''),
      };
    } catch {
      // Malformed marker — keep scanning earlier turns rather than failing.
      continue;
    }
  }
  return null;
}

/**
 * Verify an ElevenLabs webhook HMAC signature.
 *
 * ElevenLabs signs webhooks and sends the result in the `elevenlabs-signature`
 * header. Their docs direct you to their SDK's constructEvent() and do not
 * publish the raw scheme, so this implements the standard scheme those SDKs
 * use: a comma-separated header of `t=<unix seconds>,v0=<hex hmac>`, where the
 * HMAC is SHA-256 over `${timestamp}.${rawBody}` keyed with the webhook
 * secret, plus a timestamp freshness window to blunt replay.
 *
 * NOTE FOR FIRST DEPLOY: confirm this against the first real delivery. On
 * mismatch we log the header's shape (never the secret or the computed
 * digest) so a format difference is diagnosable from CloudWatch in one pass
 * rather than guessing. If ElevenLabs' actual format differs, only
 * parseSignatureHeader() and the signed-payload line below need to change.
 *
 * @param {string|Buffer} rawBody - EXACT bytes of the request body
 * @param {string} signatureHeader - value of the elevenlabs-signature header
 * @param {string} secret - ELEVENLABS_WEBHOOK_SECRET
 * @param {number} [toleranceSeconds=1800] - replay window, 30 minutes
 * @returns {{valid: boolean, reason?: string}}
 */
export function verifyWebhookSignature(rawBody, signatureHeader, secret, toleranceSeconds = 1800) {
  if (!secret) return { valid: false, reason: 'webhook secret not configured' };
  if (!signatureHeader) return { valid: false, reason: 'missing signature header' };
  if (rawBody === undefined || rawBody === null) return { valid: false, reason: 'missing raw body' };

  const { timestamp, signature } = parseSignatureHeader(signatureHeader);
  if (!timestamp || !signature) {
    return { valid: false, reason: 'unrecognized signature header format' };
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > toleranceSeconds) {
    return { valid: false, reason: 'signature timestamp outside tolerance window' };
  }

  const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(signature, 'utf8');

  // timingSafeEqual throws on length mismatch, so length-check first.
  if (expectedBuf.length !== receivedBuf.length) {
    return { valid: false, reason: 'signature mismatch' };
  }
  if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    return { valid: false, reason: 'signature mismatch' };
  }

  return { valid: true };
}

/**
 * Parse `t=<ts>,v0=<sig>` in either order, tolerating whitespace and an
 * unprefixed bare signature.
 */
export function parseSignatureHeader(header) {
  const parts = String(header).split(',').map((part) => part.trim()).filter(Boolean);
  let timestamp = null;
  let signature = null;

  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) {
      if (!signature) signature = part;
      continue;
    }
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') timestamp = value;
    else if (key === 'v0' || key === 'v1') signature = value;
  }

  return { timestamp, signature };
}

/**
 * Parse a post-call webhook payload.
 *
 * Shape: { type, event_timestamp, data }, where type is one of
 * post_call_transcription | post_call_audio | call_initiation_failure.
 * Our call correlation rides in the conversation's dynamic variables, which
 * come back under data.conversation_initiation_client_data.dynamic_variables.
 */
export function parsePostCallWebhook(body) {
  const data = body?.data || {};
  const dynamicVars =
    data.conversation_initiation_client_data?.dynamic_variables || {};

  return {
    type: body?.type || null,
    eventTimestamp: body?.event_timestamp || null,
    conversationId: data.conversation_id || null,
    agentId: data.agent_id || null,
    status: data.status || null,
    callDurationSecs:
      data.metadata?.call_duration_secs ?? data.call_duration_secs ?? null,
    // Correlation values we injected at call start.
    tenantId: dynamicVars.secret__tenant_id || dynamicVars.tenant_id || null,
    leadId: dynamicVars.secret__lead_id || dynamicVars.lead_id || null,
    callSessionId:
      dynamicVars.secret__call_session_id || dynamicVars.call_session_id || null,
    transcript: Array.isArray(data.transcript) ? data.transcript : [],
    analysis: data.analysis || null,
    // Only present on call_initiation_failure; kept so the FAILED session
    // records why rather than just that.
    failureReason: data.failure_reason || data.error || data.reason || null,
    raw: data,
  };
}

export default {
  initiateOutboundCall,
  getConversation,
  normalizeTranscript,
  extractQualificationResult,
  verifyWebhookSignature,
  parseSignatureHeader,
  parsePostCallWebhook,
  buildDynamicVariables,
  resetClient,
  LEAD_TEMPERATURE_RUBRIC,
};
