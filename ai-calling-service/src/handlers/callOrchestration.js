// Call Orchestration Handler - coordinates the call lifecycle.
//
// ElevenLabs' native Exotel integration places the call and bridges the audio
// in one request, so this handler no longer creates a conversation and dials a
// phone as two separate, unconnected operations. During the call the agent
// fetches its own data through server tools (see handlers/serverTools.js);
// afterwards a signed post-call webhook delivers the transcript.

import {
  CALL_STATUS,
  CALL_PURPOSE,
  CALL_OUTCOME,
  QUALIFICATION_STATUS,
  MAX_CALL_DURATION_MS,
} from '../config/constants.js';
import { logger } from '../utils/logger.js';
import * as db from '../services/dynamodbService.js';
import * as exotel from '../services/exotelService.js';
import * as elevenlabs from '../services/elevenlabsService.js';
import * as crmApi from '../services/crmApiService.js';
import { publishCallEnded } from '../services/eventPublisher.js';

/** Qualification calls are deliberately short — a few questions, not a tour. */
const QUALIFICATION_MAX_DURATION_SECONDS = 180;

/**
 * Follow-up calls (confirm a visit, ask how it went) are a couple of
 * questions long. Seven minutes is the ceiling, not the target.
 */
const FOLLOWUP_DEFAULT_MAX_DURATION_SECONDS = 420;

const FOLLOWUP_PURPOSES = new Set([
  CALL_PURPOSE.SITE_VISIT_CONFIRMATION,
  CALL_PURPOSE.POST_VISIT_FEEDBACK,
]);

/** Longest free-text field we keep from a caller-supplied context. */
const MAX_CONTEXT_TEXT = 2000;

/**
 * Keep only the context fields the prompt knows how to use (CONTRACTS.md 2.1),
 * clipped to sane sizes. The caller is the CRM or the follow-up service, so
 * this is hygiene rather than defence — but the object is persisted on the
 * session and echoed into an LLM prompt, and neither should grow unbounded.
 */
export function trimCallContext(context) {
  if (!context || typeof context !== 'object') return null;

  const text = (value) =>
    value == null ? null : String(value).slice(0, MAX_CONTEXT_TEXT);
  const obj = (value) => (value && typeof value === 'object' ? value : null);

  const trimmed = {
    meeting: obj(context.meeting),
    property: obj(context.property),
    visitedProperty: obj(context.visitedProperty),
    assignedAgentName: text(context.assignedAgentName),
    dmSummary: text(context.dmSummary),
    instructions: text(context.instructions),
  };

  return Object.values(trimmed).some((v) => v != null) ? trimmed : null;
}

/**
 * Keep the metadata fields the contract names. Anything else the caller
 * sends is dropped rather than persisted blind.
 */
export function trimCallMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  const trimmed = {
    followupJobId: metadata.followupJobId ? String(metadata.followupJobId) : null,
    attempt: Number.isFinite(Number(metadata.attempt)) ? Number(metadata.attempt) : null,
    source: metadata.source ? String(metadata.source).slice(0, 100) : null,
  };
  return Object.values(trimmed).some((v) => v != null) ? trimmed : null;
}

/**
 * Start an AI call to a lead.
 *
 * Validation is fail-fast and happens before any external call or DB write, so
 * a bad phone number or unconfigured agent surfaces as a clear 4xx instead of
 * a half-created session and an opaque provider error.
 *
 * @param {object} request
 * @returns {Promise<{callSessionId: string, status: string, conversationId: string|null}>}
 */
export async function startAICall(request) {
  const { tenantId, leadId, leadName, leadPhone, callPurpose, agentConfig } = request;
  const context = trimCallContext(request.context);
  const metadata = trimCallMetadata(request.metadata);

  if (!tenantId) throw new ValidationError('Tenant ID is required');
  if (!leadPhone) throw new ValidationError('Lead phone number is required');

  const phone = exotel.toE164India(leadPhone);
  if (!phone.valid) throw new ValidationError(phone.reason);

  const config = agentConfig || (await db.getAgentConfig(tenantId));
  if (!config) {
    throw new ValidationError('Agent is not configured for this tenant');
  }

  const agentId = config.agentId || process.env.ELEVENLABS_AGENT_ID;
  const agentPhoneNumberId =
    config.agentPhoneNumberId || process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;

  if (!agentId) {
    throw new ValidationError(
      'No ElevenLabs agent configured (set ELEVENLABS_AGENT_ID or a per-tenant agentId)'
    );
  }
  if (!agentPhoneNumberId) {
    throw new ValidationError(
      'No ElevenLabs phone number configured (set ELEVENLABS_AGENT_PHONE_NUMBER_ID or a per-tenant agentPhoneNumberId)'
    );
  }

  const isQualificationCall = callPurpose === CALL_PURPOSE.LEAD_QUALIFICATION;
  const isFollowupCall = FOLLOWUP_PURPOSES.has(callPurpose);

  // 1. Create the call session up front so the conversation, once it exists,
  //    always has somewhere to correlate back to.
  const session = await db.createCallSession(tenantId, {
    leadId,
    leadName,
    leadPhone: phone.e164,
    callPurpose: callPurpose || CALL_PURPOSE.LEAD_FOLLOWUP,
    followupJobId: metadata?.followupJobId || null,
    metadata,
    context,
  });
  const callSessionId = session.callSessionId;

  logger.callEvent('CALL_INITIATED', callSessionId, tenantId, {
    leadId,
    callPurpose,
    followupJobId: metadata?.followupJobId || undefined,
  });

  try {
    // 2. Lead context, best-effort — a CRM hiccup shouldn't block the call,
    //    the agent just runs with less background.
    let leadContext = null;
    if (leadId) {
      leadContext = await crmApi.getLeadContext(tenantId, leadId);
    }

    // 3. Personalization travels as dynamic variables against one shared
    //    agent prompt template, not as a system prompt rebuilt per call.
    const dynamicVariables = elevenlabs.buildDynamicVariables({
      tenantId,
      leadId,
      callSessionId,
      leadName,
      callPurpose: callPurpose || CALL_PURPOSE.LEAD_FOLLOWUP,
      agencyName: config.agencyName,
      greeting: config.greeting,
      escalationPhone: config.escalationPhone,
      leadContext: leadContext?.summary,
      rubricContext: leadContext?.rubricContext,
      context,
    });

    let maxDurationSeconds;
    if (isQualificationCall) {
      maxDurationSeconds = Math.min(
        config.maxCallDuration || 600,
        QUALIFICATION_MAX_DURATION_SECONDS
      );
    } else if (isFollowupCall) {
      maxDurationSeconds = config.maxCallDuration || FOLLOWUP_DEFAULT_MAX_DURATION_SECONDS;
    } else {
      maxDurationSeconds = config.maxCallDuration || Math.floor(MAX_CALL_DURATION_MS / 1000);
    }

    // 4. One request: dials the customer AND bridges them to the agent.
    const call = await elevenlabs.initiateOutboundCall({
      agentId,
      agentPhoneNumberId,
      toNumber: phone.e164,
      dynamicVariables,
      maxDurationSeconds,
      recordingEnabled: config.enableRecording !== false,
      callSessionId,
      tenantId,
    });

    await db.updateCallSession(tenantId, callSessionId, {
      status: CALL_STATUS.RINGING,
      elevenLabsConversationId: call.conversationId,
      exotelCallSid: call.callSid,
    });

    logger.callEvent('CALL_RINGING', callSessionId, tenantId, {
      conversationId: call.conversationId,
      callSid: call.callSid,
    });

    return {
      callSessionId,
      status: CALL_STATUS.RINGING,
      conversationId: call.conversationId,
      callSid: call.callSid,
    };
  } catch (error) {
    // The session exists but the call never got off the ground — record that
    // rather than leaving it stuck at `initiated` forever.
    const failureUpdates = {
      status: CALL_STATUS.FAILED,
      outcome: CALL_OUTCOME.CALL_INITIATION_FAILED,
      endedAt: new Date().toISOString(),
      ...(isQualificationCall && { qualificationStatus: QUALIFICATION_STATUS.FAILED }),
    };
    const failed = await db
      .updateCallSession(tenantId, callSessionId, failureUpdates)
      .catch(() => null);

    // Tell the follow-up service now, not never — nothing downstream will
    // ever fire a webhook for a call that was not placed.
    await publishCallEnded(failed || { ...session, ...failureUpdates }, { source: 'initiation' });

    logger.error('Failed to start AI call', error, { tenantId, leadId, callSessionId });
    throw error;
  }
}

/**
 * Click-to-call: ring a team member, then bridge them to a contact.
 *
 * No agent, no ElevenLabs — Exotel's Calls/connect does the whole thing. A
 * `click_to_call` session is still recorded so the Exotel status webhook has
 * a row to update and the CRM's call history shows the call happened.
 *
 * @param {object} request
 * @returns {Promise<{callSessionId: string, callSid: string|null, status: string}>}
 */
export async function connectCall(request) {
  const {
    tenantId,
    fromPhone,
    toPhone,
    entityType,
    entityId,
    initiatedByUserId,
    initiatedByName,
  } = request;

  if (!tenantId) throw new ValidationError('Tenant ID is required');

  // Blank means the feature is off for this deployment, which is a
  // configuration state rather than a caller mistake — 503, not 400.
  const callerId = (process.env.EXOTEL_CALLER_ID || '').trim();
  if (!callerId) throw new NotConfiguredError('click_to_call_not_configured');

  if (!fromPhone) throw new ValidationError('fromPhone is required');
  if (!toPhone) throw new ValidationError('toPhone is required');

  const from = exotel.toE164India(fromPhone);
  if (!from.valid) throw new ValidationError(`fromPhone: ${from.reason}`);
  const to = exotel.toE164India(toPhone);
  if (!to.valid) throw new ValidationError(`toPhone: ${to.reason}`);

  const session = await db.createCallSession(tenantId, {
    leadId: entityType === 'lead' ? entityId || null : null,
    leadName: null,
    leadPhone: to.e164,
    callPurpose: CALL_PURPOSE.CLICK_TO_CALL,
    entityType: entityType || null,
    entityId: entityId || null,
    initiatedByUserId: initiatedByUserId || null,
    initiatedByName: initiatedByName || null,
  });
  const callSessionId = session.callSessionId;

  logger.callEvent('CLICK_TO_CALL_INITIATED', callSessionId, tenantId, {
    entityType,
    entityId,
    initiatedByUserId,
  });

  const webhookBase = (process.env.WEBHOOK_BASE_URL || '').replace(/\/+$/, '');
  if (!webhookBase) {
    logger.warn('WEBHOOK_BASE_URL is not set — click-to-call status will never be reported', {
      callSessionId,
    });
  }

  try {
    const call = await exotel.connectCall({
      from: from.e164,
      to: to.e164,
      callerId,
      statusCallbackUrl: webhookBase ? `${webhookBase}/webhooks/exotel/status` : undefined,
      customField: { tenantId, callSessionId },
    });

    await db.updateCallSession(tenantId, callSessionId, {
      exotelCallSid: call.callSid,
    });

    logger.callEvent('CLICK_TO_CALL_PLACED', callSessionId, tenantId, {
      callSid: call.callSid,
    });

    return { callSessionId, callSid: call.callSid, status: CALL_STATUS.INITIATED };
  } catch (error) {
    const failureUpdates = {
      status: CALL_STATUS.FAILED,
      outcome: CALL_OUTCOME.CALL_INITIATION_FAILED,
      endedAt: new Date().toISOString(),
    };
    const failed = await db
      .updateCallSession(tenantId, callSessionId, failureUpdates)
      .catch(() => null);
    await publishCallEnded(failed || { ...session, ...failureUpdates }, { source: 'initiation' });

    logger.error('Failed to place click-to-call', error, { tenantId, callSessionId });
    throw error;
  }
}

const EXOTEL_STATUS_MAP = {
  'initiated': CALL_STATUS.INITIATED,
  'ringing': CALL_STATUS.RINGING,
  'in-progress': CALL_STATUS.IN_PROGRESS,
  'completed': CALL_STATUS.COMPLETED,
  'failed': CALL_STATUS.FAILED,
  'busy': CALL_STATUS.BUSY,
  'no-answer': CALL_STATUS.NO_ANSWER,
};

const TERMINAL_EXOTEL_STATUSES = ['completed', 'failed', 'busy', 'no-answer'];

/**
 * Handle Exotel call-status webhooks (ringing / answered / hung up).
 *
 * Status writes are ordering-guarded inside updateCallSession, so a retried or
 * late event can't roll a session back to an earlier state.
 */
export async function handleExotelWebhook(webhookData) {
  const parsed = exotel.parseWebhookPayload(webhookData);
  const { tenantId, callSessionId, status, duration, recordingUrl } = parsed;

  if (!callSessionId || !tenantId) {
    logger.warn('Exotel webhook missing correlation ids', { callSid: parsed.callSid });
    return { success: false };
  }

  const session = await db.getCallSession(tenantId, callSessionId);
  if (!session) {
    logger.error('Call session not found for Exotel webhook', null, { callSessionId, tenantId });
    return { success: false };
  }

  const newStatus = EXOTEL_STATUS_MAP[status] || status;
  const updates = { status: newStatus };

  if (status === 'in-progress' && !session.startedAt) {
    updates.startedAt = new Date().toISOString();
  }

  const isTerminal = TERMINAL_EXOTEL_STATUSES.includes(status);
  if (isTerminal) {
    updates.endedAt = new Date().toISOString();
    updates.duration = duration || 0;
    if (recordingUrl) updates.recordingUrl = recordingUrl;
  }

  // updateCallSession hands back the row as stored, which matters here: if a
  // terminal state already won the race this write is skipped, and the event
  // below must carry the status that actually stuck, not the one we tried.
  const stored = (await db.updateCallSession(tenantId, callSessionId, updates)) || {
    ...session,
    ...updates,
  };

  logger.callEvent('EXOTEL_WEBHOOK', callSessionId, tenantId, { status: newStatus, duration });

  if (isTerminal) {
    await publishCallEnded(stored, { source: 'exotel_status' });
  }

  return { success: true, status: newStatus };
}

/**
 * Handle the ElevenLabs post-call webhook.
 *
 * This is where the transcript lands and where the lead's CRM record is
 * updated. Qualification is normally already recorded by the
 * submit_qualification server tool during the call; the transcript marker is
 * only a fallback, and if neither produced a verdict the call is explicitly
 * marked FAILED so the CRM can tell "we tried and got nothing" apart from
 * "this was never a qualification call".
 */
export async function handleElevenLabsPostCall(body) {
  const parsed = elevenlabs.parsePostCallWebhook(body);

  if (parsed.type === 'call_initiation_failure') {
    return handleCallInitiationFailure(parsed);
  }

  if (parsed.type && parsed.type !== 'post_call_transcription') {
    logger.info('Ignoring non-transcription post-call webhook', { type: parsed.type });
    return { success: true, ignored: parsed.type };
  }

  const { tenantId, callSessionId, conversationId } = parsed;
  if (!tenantId || !callSessionId) {
    logger.warn('ElevenLabs post-call webhook missing correlation ids', { conversationId });
    return { success: false };
  }

  const session = await db.getCallSession(tenantId, callSessionId);
  if (!session) {
    logger.error('Call session not found for post-call webhook', null, { callSessionId, tenantId });
    return { success: false };
  }

  // Persist the transcript turns the agent and customer actually exchanged.
  const transcript = elevenlabs.normalizeTranscript({ transcript: parsed.transcript });
  for (const turn of transcript) {
    await db.addTranscriptEntry(tenantId, callSessionId, {
      speaker: turn.speaker,
      text: turn.text,
    });
  }

  const isQualificationCall = session.callPurpose === CALL_PURPOSE.LEAD_QUALIFICATION;

  // The tool may already have recorded a verdict mid-call.
  let temperature = session.qualificationTemperature || null;
  let reasons = session.qualificationReasons || null;
  let qualificationStatus = session.qualificationStatus;

  if (isQualificationCall && !temperature) {
    const fallback = elevenlabs.extractQualificationResult(transcript);
    if (fallback) {
      temperature = fallback.temperature;
      reasons = fallback.reasons;
      qualificationStatus = QUALIFICATION_STATUS.SUCCEEDED;
      logger.info('Qualification recovered from transcript marker', { callSessionId, tenantId });
    } else {
      qualificationStatus = QUALIFICATION_STATUS.FAILED;
      logger.warn('Qualification call produced no verdict', {
        callSessionId,
        tenantId,
        turnCount: transcript.length,
      });
    }
  }

  const updates = {
    status: CALL_STATUS.COMPLETED,
    endedAt: new Date().toISOString(),
    elevenLabsConversationId: conversationId || session.elevenLabsConversationId,
    transcriptSummary: parsed.analysis?.transcript_summary || session.transcriptSummary || null,
    ...(parsed.callDurationSecs != null && { duration: parsed.callDurationSecs }),
    ...(isQualificationCall && {
      qualificationStatus,
      qualificationTemperature: temperature,
      qualificationReasons: reasons,
    }),
  };

  const stored = (await db.updateCallSession(tenantId, callSessionId, updates)) || {
    ...session,
    ...updates,
  };

  // Push the outcome back to the CRM lead.
  if (session.leadId) {
    await crmApi.updateLeadCallOutcome(tenantId, session.leadId, {
      callSessionId,
      status: CALL_STATUS.COMPLETED,
      duration: parsed.callDurationSecs || session.duration || 0,
      outcome: session.outcome,
      transcriptSummary: updates.transcriptSummary,
      callPurpose: session.callPurpose,
      ...(isQualificationCall && {
        qualificationStatus,
        ...(temperature && { temperature, scoreReasons: reasons }),
      }),
    });
  }

  logger.callEvent('CALL_ENDED', callSessionId, tenantId, {
    conversationId,
    duration: parsed.callDurationSecs,
    qualificationStatus: isQualificationCall ? qualificationStatus : undefined,
  });

  // The richest call.ended we can send — transcript summary, tool-recorded
  // outcome and feedback are all on the session by now.
  await publishCallEnded(stored, {
    source: 'elevenlabs_post_call',
    dataCollection: parsed.analysis?.data_collection_results || null,
  });

  return { success: true };
}

/**
 * ElevenLabs could not place the call at all (bad number, carrier rejected,
 * agent misconfigured). There will be no transcript and no Exotel status, so
 * this is the only signal the follow-up service gets — mark the session
 * FAILED and publish.
 */
async function handleCallInitiationFailure(parsed) {
  const { tenantId, callSessionId, conversationId, failureReason } = parsed;
  if (!tenantId || !callSessionId) {
    logger.warn('call_initiation_failure webhook missing correlation ids', { conversationId });
    return { success: false };
  }

  const session = await db.getCallSession(tenantId, callSessionId);
  if (!session) {
    logger.error('Call session not found for call_initiation_failure', null, {
      callSessionId,
      tenantId,
    });
    return { success: false };
  }

  const updates = {
    status: CALL_STATUS.FAILED,
    outcome: CALL_OUTCOME.CALL_INITIATION_FAILED,
    endedAt: new Date().toISOString(),
    elevenLabsConversationId: conversationId || session.elevenLabsConversationId,
    ...(failureReason && { failureReason: String(failureReason).slice(0, 500) }),
    ...(session.callPurpose === CALL_PURPOSE.LEAD_QUALIFICATION && {
      qualificationStatus: QUALIFICATION_STATUS.FAILED,
    }),
  };

  const stored = (await db.updateCallSession(tenantId, callSessionId, updates)) || {
    ...session,
    ...updates,
  };

  logger.callEvent('CALL_INITIATION_FAILED', callSessionId, tenantId, {
    conversationId,
    failureReason: failureReason || undefined,
  });

  await publishCallEnded(stored, { source: 'elevenlabs_post_call' });

  return { success: true, failed: true };
}

/**
 * End an active call.
 */
export async function endCall(tenantId, callSessionId, reason = 'user_ended') {
  const session = await db.getCallSession(tenantId, callSessionId);
  if (!session) throw new ValidationError('Call session not found');

  if (session.exotelCallSid) {
    await exotel.endCall(session.exotelCallSid);
  }

  await db.updateCallSession(tenantId, callSessionId, {
    status: CALL_STATUS.COMPLETED,
    endedAt: new Date().toISOString(),
    outcome: reason,
    ...(session.callPurpose === CALL_PURPOSE.LEAD_QUALIFICATION &&
      session.qualificationStatus === QUALIFICATION_STATUS.PENDING && {
        qualificationStatus: QUALIFICATION_STATUS.FAILED,
      }),
  });

  logger.callEvent('CALL_ENDED_MANUAL', callSessionId, tenantId, { reason });

  return { success: true };
}

/**
 * Get call status.
 */
export async function getCallStatus(tenantId, callSessionId) {
  const session = await db.getCallSession(tenantId, callSessionId);
  if (!session) return null;

  return {
    callSessionId: session.callSessionId,
    status: session.status,
    duration: session.duration,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    qualificationStatus: session.qualificationStatus,
    qualificationTemperature: session.qualificationTemperature,
    actionsPerformed: session.actionsPerformed,
  };
}

/**
 * Get call transcript.
 */
export async function getCallTranscript(tenantId, callSessionId) {
  const entries = await db.getTranscript(tenantId, callSessionId);

  return entries.map((entry) => ({
    speaker: entry.speaker,
    text: entry.text,
    timestamp: entry.timestamp,
    intent: entry.intent,
    dataSource: entry.dataSource,
  }));
}

/**
 * Caller-error marker so routes can answer 400 instead of 500 for bad input.
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

/**
 * Feature-off marker: the deployment lacks the config for this operation.
 * Routes answer 503 with the message as the error code.
 */
export class NotConfiguredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotConfiguredError';
    this.statusCode = 503;
  }
}

export default {
  startAICall,
  connectCall,
  trimCallContext,
  trimCallMetadata,
  handleExotelWebhook,
  handleElevenLabsPostCall,
  endCall,
  getCallStatus,
  getCallTranscript,
  ValidationError,
  NotConfiguredError,
};
