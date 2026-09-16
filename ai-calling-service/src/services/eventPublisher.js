// EventBridge publisher — tells the rest of the platform when a call ends.
//
// Emits `aicalling.calls` / `call.ended` on the default bus (CONTRACTS.md
// 1.3). The follow-up agent service consumes it to decide whether a job is
// done, needs a retry, or needs a human. Nothing here is on the call's
// critical path: a publish failure is logged and swallowed, because the
// session write that preceded it is the record of truth and a webhook
// handler that 500s on a bus hiccup would only make the carrier retry.
//
// The same session may be published more than once (Exotel `completed`, then
// the ElevenLabs transcript a few seconds later). That is deliberate — the
// later event carries more data — and consumers dedupe on callSessionId.

import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { logger } from '../utils/logger.js';

const REGION = process.env.AWS_REGION || 'ap-south-1';

export const EVENT_SOURCE = 'aicalling.calls';
export const CALL_ENDED_DETAIL_TYPE = 'call.ended';

// Built lazily so importing this module never touches the SDK — the same
// pattern as the other service clients here.
let client = null;

function getClient() {
  if (!client) {
    client = new EventBridgeClient({ region: REGION });
  }
  return client;
}

// Exposed for tests — lets a suite reset the memoized client between cases.
export function resetClient() {
  client = null;
}

// Exposed for tests — swap in a fake ({ send }) so the detail shape can be
// asserted without AWS credentials.
export function setClient(override) {
  client = override || null;
}

/**
 * Build the call.ended detail from a stored call session.
 *
 * Pure, so it can be tested without a bus. Every contract field is present
 * even when null — consumers should never have to check for a missing key.
 *
 * @param {object} session - the call session as read back from DynamoDB
 * @param {object} [extra]
 * @param {string} [extra.source] - elevenlabs_post_call | exotel_status | initiation
 * @param {object|null} [extra.dataCollection] - ElevenLabs analysis.data_collection_results
 * @returns {object}
 */
export function buildCallEndedDetail(session = {}, extra = {}) {
  return {
    tenantId: session.tenantId ?? null,
    callSessionId: session.callSessionId ?? null,
    leadId: session.leadId ?? null,
    callPurpose: session.callPurpose ?? null,
    status: session.status ?? null,
    outcome: session.outcome ?? null,
    duration: Number(session.duration) || 0,
    followupJobId: session.followupJobId ?? session.metadata?.followupJobId ?? null,
    needsHuman: session.needsHuman === true,
    needsHumanReason: session.needsHumanReason ?? null,
    feedback: session.visitFeedback ?? null,
    meeting: session.meeting ?? null,
    transcriptSummary: session.transcriptSummary ?? null,
    dataCollection: extra.dataCollection ?? null,
    source: extra.source ?? null,
    endedAt: session.endedAt || new Date().toISOString(),
  };
}

/**
 * Publish call.ended for a session. Never throws.
 *
 * @param {object} session
 * @param {object} [extra] - see buildCallEndedDetail
 * @returns {Promise<{published: boolean, eventId?: string|null}>}
 */
export async function publishCallEnded(session, extra = {}) {
  const detail = buildCallEndedDetail(session, extra);

  if (!detail.tenantId || !detail.callSessionId) {
    logger.warn('Skipping call.ended publish — session has no correlation ids', {
      source: detail.source,
    });
    return { published: false };
  }

  try {
    const result = await getClient().send(
      new PutEventsCommand({
        Entries: [
          {
            Source: EVENT_SOURCE,
            DetailType: CALL_ENDED_DETAIL_TYPE,
            Detail: JSON.stringify(detail),
          },
        ],
      })
    );

    const entry = result?.Entries?.[0] || {};
    if (result?.FailedEntryCount) {
      // PutEvents resolves even when an entry is rejected — check the entry.
      logger.error('call.ended event rejected by EventBridge', null, {
        tenantId: detail.tenantId,
        callSessionId: detail.callSessionId,
        errorCode: entry.ErrorCode,
        errorMessage: entry.ErrorMessage,
      });
      return { published: false };
    }

    logger.callEvent('CALL_ENDED_EVENT_PUBLISHED', detail.callSessionId, detail.tenantId, {
      source: detail.source,
      status: detail.status,
      outcome: detail.outcome,
      eventId: entry.EventId || null,
    });
    return { published: true, eventId: entry.EventId || null };
  } catch (error) {
    logger.error('Failed to publish call.ended event', error, {
      tenantId: detail.tenantId,
      callSessionId: detail.callSessionId,
      source: detail.source,
    });
    return { published: false };
  }
}

export default {
  publishCallEnded,
  buildCallEndedDetail,
  resetClient,
  setClient,
  EVENT_SOURCE,
  CALL_ENDED_DETAIL_TYPE,
};
