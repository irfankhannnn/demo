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

import {
  INTENT_TYPES,
  KNOWLEDGE_CATEGORIES,
  QUALIFICATION_STATUS,
  CALL_OUTCOME,
} from '../config/constants.js';
import { logger } from '../utils/logger.js';
import * as dbService from '../services/dynamodbService.js';
import * as crmApiService from '../services/crmApiService.js';
import * as responseNormalizer from '../utils/responseNormalizer.js';

// Rebindable so the route tests can stand in fakes for DynamoDB and the CRM
// without a module loader hook — namespace imports are frozen, `let` isn't.
let db = dbService;
let crmApi = crmApiService;

// Exposed for tests — pass {} to restore the real services.
export function setDependencies(overrides = {}) {
  db = overrides.db || dbService;
  crmApi = overrides.crmApi || crmApiService;
}

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

  // Hybrid retrieval. When the caller described what they want in their own
  // words ("something quiet near the station, family ke liye"), match on meaning
  // — substring filters cannot bridge Hinglish phrasing to an English listing,
  // and on this product that is the common case, not the edge case.
  //
  // Falls back to exact filters when there is no description, and also when
  // semantic matching returns nothing: an empty result on a live call means the
  // agent tells a customer there is nothing available, so a degraded answer
  // beats a wrong one.
  let properties = null;

  if (args.description || args.query) {
    try {
      properties = await crmApi.matchProperties(scope.tenantId, {
        query: args.description || args.query,
        propertyType: args.propertyType,
        minPrice: args.minPrice,
        maxPrice: args.maxPrice,
        minBedrooms: args.bedrooms,
        limit: 5,
      });
      if (!Array.isArray(properties) || properties.length === 0) properties = null;
    } catch (error) {
      logger.warn('serverTools.searchProperties.semanticFailed', {
        tenantId: scope.tenantId,
        error: error.message,
      });
      properties = null;
    }
  }

  if (!properties) {
    properties = await crmApi.getAvailableProperties(scope.tenantId, filters);
  }

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
    await appendAction(
      scope,
      { action: 'SITE_VISIT_SCHEDULED', data: visit },
      {
        outcome: CALL_OUTCOME.SITE_VISIT_SCHEDULED,
        meeting: {
          meetingId: visit.meetingId || visit.visitId,
          action: 'scheduled',
          meetingDate: visit.meetingDate || visit.date || visit.visitDate || args.preferredDate || null,
          meetingTime: visit.meetingTime || visit.time || visit.visitTime || args.preferredTime || null,
        },
      }
    );
  }

  return { speech, visit: visit || null };
}

/**
 * Confirm or reschedule a site visit that already exists in the CRM.
 *
 * The meeting normally comes from the call context the follow-up service
 * supplied at call start (session.context.meeting), so the agent does not
 * have to know or repeat an id. A meetingId argument is accepted as an
 * override for the rare case where the agent was told one.
 */
export async function confirmSiteVisit(scope, args = {}) {
  const action = String(args.action || '').toLowerCase();
  if (!['confirm', 'reschedule'].includes(action)) {
    return {
      speech: 'Should I keep the visit as planned, or move it to another time?',
      meeting: null,
    };
  }

  let meetingId = args.meetingId || null;
  let session = null;
  if (!meetingId && scope.callSessionId) {
    session = await db.getCallSession(scope.tenantId, scope.callSessionId);
    meetingId = session?.context?.meeting?.meetingId || session?.meeting?.meetingId || null;
  }

  if (!meetingId) {
    // Nothing to update. Don't pretend — hand it to a person.
    await requestCallback(scope, {
      reason: `customer wanted to ${action} a site visit but no meeting is on record`,
      topic: 'site_visit',
    });
    return {
      speech:
        "I don't have that visit in front of me right now. I'll have our team confirm the timing with you shortly.",
      meeting: null,
    };
  }

  if (action === 'reschedule' && !args.newDate) {
    return { speech: 'Sure. Which day would suit you better, and roughly what time?', meeting: null };
  }

  const payload = {
    action,
    ...(action === 'reschedule' && {
      meetingDate: args.newDate,
      ...(args.newTime && { meetingTime: args.newTime }),
    }),
    ...(args.note && { note: String(args.note) }),
    updatedBy: 'AI Calling Agent',
  };

  const updated = (await crmApi.updateMeeting(scope.tenantId, meetingId, payload)) || {};

  const meeting = {
    meetingId: updated.meetingId || meetingId,
    action: action === 'reschedule' ? 'rescheduled' : 'confirmed',
    meetingDate: updated.meetingDate || args.newDate || session?.context?.meeting?.meetingDate || null,
    meetingTime: updated.meetingTime || args.newTime || session?.context?.meeting?.meetingTime || null,
  };

  const speech = responseNormalizer.normalizeMeetingUpdate(meeting, action);

  await recordToolUse(scope, {
    intent: INTENT_TYPES.SCHEDULE_SITE_VISIT,
    text: speech,
    dataSource: 'CRM_API',
  });

  if (scope.callSessionId) {
    await appendAction(
      scope,
      { action: action === 'reschedule' ? 'SITE_VISIT_RESCHEDULED' : 'SITE_VISIT_CONFIRMED', data: meeting },
      {
        outcome:
          action === 'reschedule'
            ? CALL_OUTCOME.SITE_VISIT_RESCHEDULED
            : CALL_OUTCOME.SITE_VISIT_CONFIRMED,
        meeting,
      }
    );
  }

  logger.callEvent('SITE_VISIT_UPDATED', scope.callSessionId, scope.tenantId, {
    meetingId: meeting.meetingId,
    action: meeting.action,
    leadId: scope.leadId,
  });

  return { speech, meeting };
}

/**
 * Record structured feedback after a site visit.
 *
 * Silent, like submit_qualification: the agent keeps talking, the note lands
 * on the session (for the call.ended event) and on the lead (so the agent
 * who runs the deal sees it in the CRM without opening the transcript).
 */
export async function recordVisitFeedback(scope, args = {}) {
  const interestLevel = String(args.interestLevel || '').toLowerCase();

  const visitFeedback = {
    liked: typeof args.liked === 'boolean' ? args.liked : null,
    issues: toStringList(args.issues),
    clarificationsNeeded: toStringList(args.clarificationsNeeded),
    tokenTimeline: args.tokenTimeline ? String(args.tokenTimeline) : null,
    interestLevel: ['high', 'medium', 'low', 'none'].includes(interestLevel) ? interestLevel : null,
    notes: args.notes ? String(args.notes) : null,
    recordedAt: new Date().toISOString(),
  };

  if (scope.callSessionId) {
    await appendAction(
      scope,
      { action: 'VISIT_FEEDBACK_RECORDED', data: visitFeedback },
      { visitFeedback, outcome: CALL_OUTCOME.FEEDBACK_RECORDED }
    );
  }

  if (scope.leadId) {
    await crmApi.addFollowupNote(scope.tenantId, {
      leadId: scope.leadId,
      callSessionId: scope.callSessionId || undefined,
      type: 'visit_feedback',
      content: summarizeFeedback(visitFeedback),
      data: visitFeedback,
    });
  }

  logger.callEvent('VISIT_FEEDBACK_RECORDED', scope.callSessionId, scope.tenantId, {
    leadId: scope.leadId,
    interestLevel: visitFeedback.interestLevel,
    liked: visitFeedback.liked,
  });

  // Empty speech: the agent carries on, it doesn't announce the note.
  return { speech: '', recorded: true };
}

/**
 * The customer needs a person to call them back about something the agent
 * cannot resolve (a question it has no data for, an action only a human can
 * take). Marks the session so the follow-up service escalates rather than
 * retries.
 */
export async function requestCallback(scope, args = {}) {
  const reason = String(args.reason || 'customer asked for a callback');
  const topic = args.topic ? String(args.topic) : null;

  if (scope.callSessionId) {
    await appendAction(
      scope,
      { action: 'CALLBACK_REQUESTED', data: { reason, topic } },
      {
        needsHuman: true,
        needsHumanReason: reason,
        outcome: CALL_OUTCOME.CALLBACK_REQUESTED,
      }
    );
  }

  logger.callEvent('CALLBACK_REQUESTED', scope.callSessionId, scope.tenantId, {
    reason,
    topic,
    leadId: scope.leadId,
  });

  return {
    speech: 'Noted — someone from our team will call you back about that shortly.',
    recorded: true,
  };
}

/**
 * Answer a policy / FAQ / agency question from the agency's own documents.
 *
 * Retrieval lives in the CRM (server/services/knowledge/), not here, because
 * that is where the agency authors its policies and where the embeddings are
 * written. This service only asks.
 *
 * The passages come back unsummarised and are handed to the agent's own model
 * to phrase. Adding a generation step here would cost a second LLM round trip
 * in the middle of a phone call for wording the agent is already better placed
 * to choose, given it knows what was just said.
 */
export async function answerPolicyQuestion(scope, args = {}) {
  const question = args.question || '';
  if (!question) {
    return { speech: 'Sorry, could you say that again?', answer: null };
  }

  const category = args.category && Object.values(KNOWLEDGE_CATEGORIES).includes(args.category)
    ? args.category
    : null;

  const result = await crmApi.answerPolicyQuestion(scope.tenantId, question, category);
  const speech = responseNormalizer.normalizeFAQResponse(result?.answer, result?.sources);

  await recordToolUse(scope, {
    intent: INTENT_TYPES.FAQ_POLICY,
    text: speech,
    dataSource: 'VECTOR_DB',
  });

  return {
    speech,
    answer: result?.answer || null,
    sources: result?.sources || [],
    confidence: result?.confidence ?? 0,
  };
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
    await appendAction(
      scope,
      { action: 'HUMAN_HANDOFF_REQUESTED', data: { reason } },
      { needsHuman: true, needsHumanReason: reason }
    );
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
async function appendAction(scope, entry, extraUpdates = {}) {
  try {
    const session = await db.getCallSession(scope.tenantId, scope.callSessionId);
    const actionsPerformed = [...(session?.actionsPerformed || [])];
    actionsPerformed.push({ ...entry, timestamp: new Date().toISOString() });
    // Outcome / needsHuman ride along in the same write as the action list,
    // so a tool never leaves the session half-updated.
    await db.updateCallSession(scope.tenantId, scope.callSessionId, {
      ...extraUpdates,
      actionsPerformed,
    });
  } catch (error) {
    logger.error('Failed to append call action', error, {
      tenantId: scope.tenantId,
      callSessionId: scope.callSessionId,
    });
  }
}

/** Coerce a tool argument to a clean list of non-empty strings. */
function toStringList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

/** One-paragraph note for the CRM, so the feedback reads without the JSON. */
function summarizeFeedback(feedback) {
  const parts = [];
  if (feedback.liked === true) parts.push('Liked the property.');
  else if (feedback.liked === false) parts.push('Did not like the property.');
  if (feedback.interestLevel) parts.push(`Interest: ${feedback.interestLevel}.`);
  if (feedback.issues.length) parts.push(`Issues: ${feedback.issues.join(', ')}.`);
  if (feedback.clarificationsNeeded.length) {
    parts.push(`Needs clarity on: ${feedback.clarificationsNeeded.join(', ')}.`);
  }
  if (feedback.tokenTimeline) parts.push(`Token timeline: ${feedback.tokenTimeline}.`);
  if (feedback.notes) parts.push(feedback.notes);
  return parts.join(' ') || 'Visit feedback call completed; no specifics captured.';
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
  confirmSiteVisit,
  recordVisitFeedback,
  requestCallback,
  setDependencies,
};
