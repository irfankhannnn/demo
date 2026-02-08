// Call Orchestration Handler - Main brain coordinating the call flow

import { v4 as uuidv4 } from 'uuid';
import { CALL_STATUS, CALL_PURPOSE, INTENT_TYPES } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import * as db from '../services/dynamodbService.js';
import * as exotel from '../services/exotelService.js';
import * as elevenlabs from '../services/elevenlabsService.js';
import * as crmApi from '../services/crmApiService.js';
import * as intentService from '../services/intentService.js';

/**
 * Start an AI call to a lead
 * @param {object} request - Call request data
 * @returns {Promise<{callSessionId: string, status: string}>}
 */
export async function startAICall(request) {
  const { tenantId, leadId, leadName, leadPhone, callPurpose, agentConfig } = request;
  
  if (!tenantId || !leadPhone) {
    throw new Error('Tenant ID and lead phone are required');
  }
  
  try {
    // 1. Create call session in DynamoDB
    const session = await db.createCallSession(tenantId, {
      leadId,
      leadName,
      leadPhone,
      callPurpose: callPurpose || CALL_PURPOSE.LEAD_FOLLOWUP,
    });
    
    const callSessionId = session.callSessionId;
    
    logger.callEvent('CALL_INITIATED', callSessionId, tenantId, {
      leadId,
      leadPhone,
      callPurpose,
    });
    
    // 2. Get agent configuration
    const config = agentConfig || await db.getAgentConfig(tenantId);
    if (!config || !config.exotelNumber) {
      await db.updateCallSession(tenantId, callSessionId, {
        status: CALL_STATUS.FAILED,
        outcome: 'Agent not configured',
      });
      throw new Error('Agent configuration missing or incomplete');
    }
    
    // 3. Get lead context from CRM
    let leadContext = null;
    if (leadId) {
      leadContext = await crmApi.getLeadContext(tenantId, leadId);
    }
    
    // 4. Initialize ElevenLabs conversation session
    const elevenLabsSession = await elevenlabs.initializeConversation(callSessionId, {
      tenantId,
      leadId,
      leadName,
      agentId: config.agentId,
      agencyName: config.agencyName,
      greeting: config.greeting || `Hello${leadName ? ` ${leadName}` : ''}, this is ${config.agencyName}. How can I help you with your property search today?`,
      callPurpose,
      leadContext: leadContext?.summary,
      maxDuration: config.maxCallDuration,
    });
    
    // 5. Initiate Exotel call
    const exotelCall = await exotel.initiateOutboundCall(
      tenantId,
      leadPhone,
      config.exotelNumber,
      callSessionId
    );
    
    // 6. Update session with external IDs
    await db.updateCallSession(tenantId, callSessionId, {
      status: CALL_STATUS.RINGING,
      exotelCallSid: exotelCall.callSid,
      elevenLabsSessionId: elevenLabsSession.sessionId,
    });
    
    logger.callEvent('CALL_RINGING', callSessionId, tenantId, {
      exotelCallSid: exotelCall.callSid,
      elevenLabsSessionId: elevenLabsSession.sessionId,
    });
    
    return {
      callSessionId,
      status: CALL_STATUS.RINGING,
      exotelCallSid: exotelCall.callSid,
    };
  } catch (error) {
    logger.error('Failed to start AI call', error, { tenantId, leadId });
    throw error;
  }
}

/**
 * Handle Exotel webhook events
 */
export async function handleExotelWebhook(webhookData) {
  const parsed = exotel.parseWebhookPayload(webhookData);
  const { tenantId, callSessionId, status, duration, recordingUrl } = parsed;
  
  if (!callSessionId) {
    logger.warn('Exotel webhook missing callSessionId', { callSid: parsed.callSid });
    return { success: false };
  }
  
  logger.callEvent('EXOTEL_WEBHOOK', callSessionId, tenantId, {
    status,
    duration,
  });
  
  const session = await db.getCallSession(tenantId, callSessionId);
  if (!session) {
    logger.error('Call session not found for webhook', null, { callSessionId });
    return { success: false };
  }
  
  // Map Exotel status to our status
  const statusMap = {
    'ringing': CALL_STATUS.RINGING,
    'in-progress': CALL_STATUS.IN_PROGRESS,
    'completed': CALL_STATUS.COMPLETED,
    'failed': CALL_STATUS.FAILED,
    'busy': CALL_STATUS.BUSY,
    'no-answer': CALL_STATUS.NO_ANSWER,
  };
  
  const newStatus = statusMap[status] || status;
  
  const updates = {
    status: newStatus,
  };
  
  if (status === 'in-progress' && !session.startedAt) {
    updates.startedAt = new Date().toISOString();
  }
  
  if (['completed', 'failed', 'busy', 'no-answer'].includes(status)) {
    updates.endedAt = new Date().toISOString();
    updates.duration = duration || 0;
    
    if (recordingUrl) {
      updates.recordingUrl = recordingUrl;
    }
    
    // End ElevenLabs session
    if (session.elevenLabsSessionId) {
      await elevenlabs.endConversation(session.elevenLabsSessionId);
    }
    
    // Update lead status in CRM
    if (session.leadId) {
      await crmApi.updateLeadCallOutcome(tenantId, session.leadId, {
        callSessionId,
        status: newStatus,
        duration: duration || 0,
        outcome: session.outcome,
        transcriptSummary: session.transcriptSummary,
      });
    }
    
    logger.callEvent('CALL_ENDED', callSessionId, tenantId, {
      status: newStatus,
      duration,
      outcome: session.outcome,
    });
  }
  
  await db.updateCallSession(tenantId, callSessionId, updates);
  
  return { success: true, status: newStatus };
}

/**
 * Handle ElevenLabs intent webhook
 * This is called when ElevenLabs detects the customer needs data
 */
export async function handleElevenLabsIntentWebhook(webhookData) {
  const parsed = elevenlabs.parseIntentWebhook(webhookData);
  const { tenantId, callSessionId, transcript, detectedIntent, entities } = parsed;
  
  if (!callSessionId) {
    logger.warn('ElevenLabs webhook missing callSessionId');
    return { success: false };
  }
  
  logger.callEvent('INTENT_DETECTED', callSessionId, tenantId, {
    transcript: transcript?.slice(0, 100),
    detectedIntent,
  });
  
  const session = await db.getCallSession(tenantId, callSessionId);
  if (!session) {
    logger.error('Call session not found', null, { callSessionId });
    return { success: false };
  }
  
  // Log transcript entry
  await db.addTranscriptEntry(tenantId, callSessionId, {
    speaker: 'customer',
    text: transcript,
    intent: detectedIntent,
  });
  
  // Classify intent if not already detected
  let intent = detectedIntent;
  let intentEntities = entities || {};
  
  if (!intent || intent === 'UNKNOWN') {
    const classification = await intentService.classifyIntent(transcript, {
      leadId: session.leadId,
      lastTranscript: transcript,
    });
    intent = classification.intent;
    intentEntities = classification.entities;
  }
  
  // Check if we need to fetch data
  if (!intentService.shouldFetchData(intent)) {
    // No data needed, let ElevenLabs handle it
    return { 
      success: true, 
      action: 'continue',
      responseText: null,
    };
  }
  
  // Fetch data based on intent
  const context = {
    leadId: session.leadId,
    lastTranscript: transcript,
    lastMentionedPropertyId: session.lastMentionedPropertyId,
  };
  
  const dataResult = await intentService.routeAndFetchData(
    tenantId,
    intent,
    intentEntities,
    context
  );
  
  // Log AI response
  await db.addTranscriptEntry(tenantId, callSessionId, {
    speaker: 'ai',
    text: dataResult.text,
    intent,
    dataSource: dataResult.source,
  });
  
  // Update session with detected intents
  const intentsDetected = [...(session.intentsDetected || [])];
  if (!intentsDetected.includes(intent)) {
    intentsDetected.push(intent);
  }
  
  const sessionUpdates = { intentsDetected };
  
  // Track property mentions for context
  if (dataResult.data?.propertyId) {
    sessionUpdates.lastMentionedPropertyId = dataResult.data.propertyId;
  } else if (Array.isArray(dataResult.data) && dataResult.data.length === 1) {
    sessionUpdates.lastMentionedPropertyId = dataResult.data[0].propertyId;
  }
  
  // Track actions performed
  if (intent === INTENT_TYPES.SCHEDULE_SITE_VISIT && dataResult.data?.visitId) {
    const actionsPerformed = [...(session.actionsPerformed || [])];
    actionsPerformed.push({
      action: 'SITE_VISIT_SCHEDULED',
      data: dataResult.data,
      timestamp: new Date().toISOString(),
    });
    sessionUpdates.actionsPerformed = actionsPerformed;
  }
  
  await db.updateCallSession(tenantId, callSessionId, sessionUpdates);
  
  // Inject response back to ElevenLabs
  if (dataResult.text && session.elevenLabsSessionId) {
    await elevenlabs.injectContext(session.elevenLabsSessionId, dataResult.text);
  }
  
  // Handle special intents
  if (intent === INTENT_TYPES.HANDOFF_HUMAN) {
    return {
      success: true,
      action: 'handoff',
      responseText: "Let me connect you with one of our agents. Please hold for a moment.",
    };
  }
  
  if (intent === INTENT_TYPES.CALL_END) {
    return {
      success: true,
      action: 'end',
      responseText: "Thank you for calling. Have a great day!",
    };
  }
  
  return {
    success: true,
    action: 'continue',
    responseText: dataResult.text,
    data: dataResult.data,
  };
}

/**
 * End an active call
 */
export async function endCall(tenantId, callSessionId, reason = 'user_ended') {
  const session = await db.getCallSession(tenantId, callSessionId);
  
  if (!session) {
    throw new Error('Call session not found');
  }
  
  // End Exotel call
  if (session.exotelCallSid) {
    await exotel.endCall(session.exotelCallSid);
  }
  
  // End ElevenLabs session
  if (session.elevenLabsSessionId) {
    await elevenlabs.endConversation(session.elevenLabsSessionId);
  }
  
  // Update session
  await db.updateCallSession(tenantId, callSessionId, {
    status: CALL_STATUS.COMPLETED,
    endedAt: new Date().toISOString(),
    outcome: reason,
  });
  
  logger.callEvent('CALL_ENDED_MANUAL', callSessionId, tenantId, { reason });
  
  return { success: true };
}

/**
 * Get call status
 */
export async function getCallStatus(tenantId, callSessionId) {
  const session = await db.getCallSession(tenantId, callSessionId);
  
  if (!session) {
    return null;
  }
  
  return {
    callSessionId: session.callSessionId,
    status: session.status,
    duration: session.duration,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    intentsDetected: session.intentsDetected,
    actionsPerformed: session.actionsPerformed,
  };
}

/**
 * Get call transcript
 */
export async function getCallTranscript(tenantId, callSessionId) {
  const entries = await db.getTranscript(tenantId, callSessionId);
  
  return entries.map(entry => ({
    speaker: entry.speaker,
    text: entry.text,
    timestamp: entry.timestamp,
    intent: entry.intent,
    dataSource: entry.dataSource,
  }));
}

export default {
  startAICall,
  handleExotelWebhook,
  handleElevenLabsIntentWebhook,
  endCall,
  getCallStatus,
  getCallTranscript,
};
