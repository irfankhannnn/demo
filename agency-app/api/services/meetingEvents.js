/**
 * EventBridge events for meeting lifecycle changes (CONTRACTS.md 1.2).
 *
 * `crm.meetings` / `meeting.completed` and `meeting.cancelled` are what the
 * follow-up service listens on to schedule the post-visit feedback call (or
 * drop a pending confirmation call when the visit is cancelled). Emitted from
 * crmDynamodbService.updateMeeting after the write, so a meeting closed from
 * the calendar, from the AI agent's PATCH, or from a script all produce the
 * same event.
 *
 * Same shape of guard as the lead.created publisher in leadIngestion.js:
 * gated on AGENTS_ENABLED, and never allowed to fail the write that already
 * happened — a missing event is recoverable (the job can be created by hand),
 * a rolled-back status change is not.
 */

import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { logger } from '../logger.js';

export const MEETING_EVENT_SOURCE = 'crm.meetings';

/** Only these transitions are worth an event; a reschedule is not. */
const PUBLISHED_STATUSES = new Set(['completed', 'cancelled']);

let defaultClient = null;
function getDefaultClient() {
  if (!defaultClient) {
    defaultClient = new EventBridgeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
  }
  return defaultClient;
}

/**
 * Build the event detail for a meeting that just changed status.
 *
 * `meetingType` is whatever createMeeting persisted ('site_visit' for
 * AI-booked visits); older meetings have none, so the consumer also checks the
 * title — hence `title` rides along as an extra optional field.
 */
export function buildMeetingEventDetail(tenantId, meeting, { completedBy, completedAt } = {}) {
  return {
    tenantId,
    meetingId: meeting.meetingId,
    status: meeting.status,
    meetingType: meeting.meetingType || null,
    title: meeting.title || null,
    meetingDate: meeting.meetingDate || null,
    meetingTime: meeting.meetingTime || null,
    relatedEntityType: meeting.relatedEntityType || null,
    relatedEntityId: meeting.relatedEntityId || null,
    relatedEntityName: meeting.relatedEntityName || null,
    propertyId: meeting.propertyId || null,
    propertyName: meeting.propertyName || null,
    outcome: meeting.outcome || null,
    completedBy: completedBy || null,
    completedAt: completedAt || new Date().toISOString(),
  };
}

/**
 * Publish `meeting.<status>` when a meeting moved into completed/cancelled.
 *
 * @param {object} args
 * @param {string} args.tenantId
 * @param {object} args.before  meeting item before the update
 * @param {object} args.after   meeting item after the update (ALL_NEW)
 * @param {object} args.data    the patch that was applied (for updatedBy)
 * @param {object} [deps]       { eventBridge, env, log } for tests
 * @returns {Promise<{published: boolean, reason?: string, detailType?: string}>}
 */
export async function publishMeetingStatusEvent({ tenantId, before, after, data = {} }, deps = {}) {
  const env = deps.env || process.env;
  const log = deps.log || logger;

  if (env.AGENTS_ENABLED !== 'true') {
    return { published: false, reason: 'agents_disabled' };
  }
  if (!after || !after.status || !PUBLISHED_STATUSES.has(after.status)) {
    return { published: false, reason: 'status_not_published' };
  }
  if (before && before.status === after.status) {
    return { published: false, reason: 'status_unchanged' };
  }

  const detailType = `meeting.${after.status}`;
  const detail = buildMeetingEventDetail(tenantId, after, {
    completedBy: typeof data.updatedBy === 'string' ? data.updatedBy : (after.updatedBy || after.createdBy || null),
    completedAt: after.updatedAt || new Date().toISOString(),
  });

  try {
    const client = deps.eventBridge || getDefaultClient();
    await client.send(new PutEventsCommand({
      Entries: [{
        Source: MEETING_EVENT_SOURCE,
        DetailType: detailType,
        Detail: JSON.stringify(detail),
      }],
    }));
    log.info('meeting.event.published', {
      tenantId, meetingId: after.meetingId, detailType, meetingType: detail.meetingType,
    });
    return { published: true, detailType };
  } catch (err) {
    log.warn('meeting.event.publish.failed', {
      tenantId, meetingId: after.meetingId, detailType, error: err.message,
    });
    return { published: false, reason: 'publish_failed' };
  }
}
