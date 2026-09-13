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
  QUALIFICATION_STATUS,
  MAX_CALL_DURATION_MS,
} from '../config/constants.js';
import { logger } from '../utils/logger.js';
import * as db from '../services/dynamodbService.js';
import * as exotel from '../services/exotelService.js';
import * as elevenlabs from '../services/elevenlabsService.js';
import * as crmApi from '../services/crmApiService.js';

/** Qualification calls are deliberately short — a few questions, not a tour. */
const QUALIFICATION_MAX_DURATION_SECONDS = 180;

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

  // 1. Create the call session up front so the conversation, once it exists,
  //    always has somewhere to correlate back to.
  const session = await db.createCallSession(tenantId, {
    leadId,
    leadName,
    leadPhone: phone.e164,
    callPurpose: callPurpose || CALL_PURPOSE.LEAD_FOLLOWUP,
  });
  const callSessionId = session.callSessionId;

  logger.callEvent('CALL_INITIATED', callSessionId, tenantId, {
    leadId,
    callPurpose,
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
    });

    const maxDurationSeconds = isQualificationCall
      ? Math.min(config.maxCallDuration || 600, QUALIFICATION_MAX_DURATION_SECONDS)
      : config.maxCallDuration || Math.floor(MAX_CALL_DURATION_MS / 1000);

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
    await db.updateCallSession(tenantId, callSessionId, {
      status: CALL_STATUS.FAILED,
      outcome: 'call_initiation_failed',
      endedAt: new Date().toISOString(),
      ...(isQualificationCall && { qualificationStatus: QUALIFICATION_STATUS.FAILED }),
    }).catch(() => {});

    logger.error('Failed to start AI call', error, { tenantId, leadId, callSessionId });
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

  if (TERMINAL_EXOTEL_STATUSES.includes(status)) {
    updates.endedAt = new Date().toISOString();
    updates.duration = duration || 0;
    if (recordingUrl) updates.recordingUrl = recordingUrl;
  }

  await db.updateCallSession(tenantId, callSessionId, updates);

  logger.callEvent('EXOTEL_WEBHOOK', callSessionId, tenantId, { status: newStatus, duration });

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

  await db.updateCallSession(tenantId, callSessionId, updates);

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

  return { success: true };
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

export default {
  startAICall,
  handleExotelWebhook,
  handleElevenLabsPostCall,
  endCall,
  getCallStatus,
  getCallTranscript,
  ValidationError,
};
