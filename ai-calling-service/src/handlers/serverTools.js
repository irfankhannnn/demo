// Server tool implementations — the data layer the ElevenLabs agent calls
// mid-conversation.
//
// This replaces the old "intent webhook → regex classifier → fetch → inject
// context" relay. The agent's own model now decides when it needs data and
// supplies structured arguments, so we no longer guess intent from raw
// transcript text. Each tool returns speech-ready prose plus the structured
// data behind it; the agent speaks the prose.
//
// Tenant scoping never comes from the model. tenantId/leadId/callSessionId
// are injected by ElevenLabs from `secret__` dynamic variables configured as
// request headers on each tool (see elevenlabs-agent-tools.md), so the model
// cannot widen its own scope by inventing a different tenant.

import { INTENT_TYPES, KNOWLEDGE_CATEGORIES, QUALIFICATION_STATUS } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import * as db from '../services/dynamodbService.js';
import * as crmApi from '../services/crmApiService.js';
import * as ragService from '../services/ragService.js';
import * as responseNormalizer from '../utils/responseNormalizer.js';

/**
 * Record what the agent fetched onto the call transcript, so the CRM's
 * transcript view still shows the data-backed turns the old relay used to log.
 * Never allowed to fail a tool call — a transcript write problem must not cost
 * the customer an answer they're waiting on.
 */
async function recordToolUse(scope, { intent, text, dataSource }) {
  const { tenantId, callSessionId } = scope;
  if (!tenantId || !callSessionId) return;
  try {
    await db.addTranscriptEntry(tenantId, callSessionId, {
      speaker: 'ai',
      text,
      intent,
      dataSource,
    });
  } catch (error) {
    logger.error('Failed to record tool use on transcript', error, { tenantId, callSessionId });
  }
}

/**
 * Search available properties.
 * @param {{tenantId: string, leadId?: string, callSessionId?: string}} scope
 * @param {{propertyType?: string, location?: string, bedrooms?: number, maxPrice?: number, minPrice?: number}} args
 */
export async function searchProperties(scope, args = {}) {
  const filters = {
    propertyType: args.propertyType,
    location: args.location,
    bedrooms: args.bedrooms,
    minPrice: args.minPrice,
    maxPrice: args.maxPrice,
  };

  const properties = await crmApi.getAvailableProperties(scope.tenantId, filters);
  const speech = responseNormalizer.normalizePropertyList(properties, args);

  await recordToolUse(scope, {
    intent: INTENT_TYPES.PROPERTY_AVAILABILITY,
    text: speech,
    dataSource: 'CRM_API',
  });

  return {
    speech,
    count: Array.isArray(properties) ? properties.length : 0,
    properties: (properties || []).slice(0, 5).map(summarizeProperty),
  };
}

/**
 * Details for one property.
 */
export async function getPropertyDetails(scope, args = {}) {
  if (!args.propertyId) {
    return {
      speech: 'Which property would you like to know more about? Could you tell me the area or the type?',
      property: null,
    };
  }

  const property = await crmApi.getPropertyDetails(scope.tenantId, args.propertyId);
  const speech = responseNormalizer.normalizePropertyDetails(property);

  await recordToolUse(scope, {
    intent: INTENT_TYPES.PROPERTY_DETAILS,
    text: speech,
    dataSource: 'CRM_API',
  });

  return { speech, property: property ? summarizeProperty(property) : null };
}

/**
 * Book a site visit against the lead on this call.
 */
export async function scheduleSiteVisit(scope, args = {}) {
  if (!args.propertyId) {
    return { speech: "I'd be happy to arrange a visit. Which property would you like to see?", visit: null };
  }
  if (!args.preferredDate) {
    return { speech: 'When would suit you? Let me know a day and rough time.', visit: null };
  }

  const visit = await crmApi.scheduleSiteVisit(scope.tenantId, {
    leadId: scope.leadId,
    propertyId: args.propertyId,
    preferredDate: args.preferredDate,
    preferredTime: args.preferredTime,
    source: 'ai_call',
  });

  const speech = responseNormalizer.normalizeSiteVisitConfirmation(visit);

  await recordToolUse(scope, {
    intent: INTENT_TYPES.SCHEDULE_SITE_VISIT,
    text: speech,
    dataSource: 'CRM_API',
  });

  if (visit?.visitId && scope.callSessionId) {
    await appendAction(scope, { action: 'SITE_VISIT_SCHEDULED', data: visit });
  }

  return { speech, visit: visit || null };
}

/**
 * Answer a policy / FAQ / agency question from the tenant's knowledge base.
 */
export async function answerPolicyQuestion(scope, args = {}) {
  const question = args.question || '';
  if (!question) {
    return { speech: 'Sorry, could you say that again?', answer: null };
  }

  const category = args.category && Object.values(KNOWLEDGE_CATEGORIES).includes(args.category)
    ? args.category
    : null;

  const result = await ragService.queryKnowledgeBase(scope.tenantId, question, category);
  const speech = responseNormalizer.normalizeFAQResponse(result?.answer, result?.sources);

  await recordToolUse(scope, {
    intent: INTENT_TYPES.FAQ_POLICY,
    text: speech,
    dataSource: 'VECTOR_DB',
  });

  return { speech, answer: result?.answer || null, confidence: result?.confidence ?? 0 };
}

/**
 * Record the agent's Hot/Warm/Cold verdict.
 *
 * This is the primary qualification path. The old design had the agent emit a
 * `[QUALIFICATION_RESULT: {...}]` marker into its own speech, which meant it
 * could literally read JSON aloud to the customer; a tool call keeps the
 * verdict out of the audio entirely and gives us a definite success signal.
 */
export async function submitQualification(scope, args = {}) {
  const temperature = String(args.temperature || '').toUpperCase();
  if (!['HOT', 'WARM', 'COLD'].includes(temperature)) {
    return { speech: '', recorded: false, error: 'temperature must be HOT, WARM or COLD' };
  }

  const reasons = Array.isArray(args.reasons)
    ? args.reasons.join('; ')
    : String(args.reasons || '');

  if (scope.callSessionId) {
    await db.updateCallSession(scope.tenantId, scope.callSessionId, {
      qualificationStatus: QUALIFICATION_STATUS.SUCCEEDED,
      qualificationTemperature: temperature,
      qualificationReasons: reasons,
    });
  }

  logger.callEvent('QUALIFICATION_SUBMITTED', scope.callSessionId, scope.tenantId, {
    temperature,
    leadId: scope.leadId,
  });

  // Empty speech: the agent should carry on naturally, not announce that it
  // just scored the customer.
  return { speech: '', recorded: true, temperature };
}

/**
 * Flag that the customer wants a human.
 */
export async function requestHumanHandoff(scope, args = {}) {
  const reason = args.reason || 'customer requested a human agent';

  if (scope.callSessionId) {
    await appendAction(scope, { action: 'HUMAN_HANDOFF_REQUESTED', data: { reason } });
  }

  logger.callEvent('HUMAN_HANDOFF_REQUESTED', scope.callSessionId, scope.tenantId, {
    reason,
    leadId: scope.leadId,
  });

  return {
    speech: "Of course — I'll have one of our agents call you back shortly. Is this the best number to reach you on?",
    recorded: true,
  };
}

/**
 * Append to the session's actionsPerformed list.
 *
 * Read-modify-write on a list attribute; acceptable here because tool calls on
 * a single conversation are inherently serialized by the agent (it waits for
 * each tool response before continuing), unlike carrier webhooks.
 */
async function appendAction(scope, entry) {
  try {
    const session = await db.getCallSession(scope.tenantId, scope.callSessionId);
    const actionsPerformed = [...(session?.actionsPerformed || [])];
    actionsPerformed.push({ ...entry, timestamp: new Date().toISOString() });
    await db.updateCallSession(scope.tenantId, scope.callSessionId, { actionsPerformed });
  } catch (error) {
    logger.error('Failed to append call action', error, {
      tenantId: scope.tenantId,
      callSessionId: scope.callSessionId,
    });
  }
}

/** Trim a property record down to what's useful to speak about. */
function summarizeProperty(p = {}) {
  return {
    propertyId: p.propertyId || p.id || null,
    propertyType: p.propertyType || p.type || null,
    location: p.area || p.location || null,
    bedrooms: p.bedrooms ?? null,
    rent: p.rent ?? p.price ?? null,
  };
}

export default {
  searchProperties,
  getPropertyDetails,
  scheduleSiteVisit,
  answerPolicyQuestion,
  submitQualification,
  requestHumanHandoff,
};
