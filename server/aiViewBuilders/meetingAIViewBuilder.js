/**
 * MeetingAIViewBuilder — Transform normalized meetings into AI-friendly DTOs.
 *
 * Meetings are not entity-specific. They can be tied to leads, contacts, properties,
 * buyers, sellers, owners, or tenants. This builder is shared across all entities.
 *
 * Does not contain business logic or generate English text.
 * Only decides which fields to expose for each AI interaction.
 */

import { formatDate, buildEnvelope, buildPaginationMetadata } from './utils.js';

// ─── View Builders ───────────────────────────────────────────────────────────

/**
 * Build meetingCreateConfirmation view
 */
export function buildMeetingCreateConfirmation(meeting) {
  return buildEnvelope(
    {
      meetingId: meeting.meetingId,
      title: meeting.title,
      scheduledDate: formatDate(meeting.scheduledDate),
      status: meeting.status || 'scheduled',
      relatedEntityType: meeting.relatedEntityType || null,
      relatedEntityId: meeting.relatedEntityId || null,
      location: meeting.location || null,
      attendees: meeting.attendees || [],
    },
    { action: 'meeting_created' }
  );
}

/**
 * Build meetingDetails view
 */
export function buildMeetingDetails(meeting, relatedEntityName = null) {
  return buildEnvelope(
    {
      meetingId: meeting.meetingId,
      title: meeting.title,
      scheduledDate: formatDate(meeting.scheduledDate),
      status: meeting.status,
      location: meeting.location || null,
      description: meeting.description || null,
      relatedEntityType: meeting.relatedEntityType || null,
      relatedEntityId: meeting.relatedEntityId || null,
      relatedEntityName,
      attendees: meeting.attendees || [],
      createdBy: meeting.createdBy || null,
      createdAt: formatDate(meeting.createdAt),
    },
    {}
  );
}

/**
 * Build meetingsList view
 */
export function buildMeetingsList(meetings, pagination = {}, relatedEntityNames = {}) {
  const { total = meetings.length, days = 7, hasMore = false } = pagination;

  return buildEnvelope(
    meetings.map(meeting => ({
      meetingId: meeting.meetingId,
      title: meeting.title,
      scheduledDate: formatDate(meeting.scheduledDate),
      status: meeting.status,
      relatedEntityType: meeting.relatedEntityType || null,
      relatedEntityName: relatedEntityNames[meeting.relatedEntityId] || null,
      location: meeting.location || null,
    })),
    {
      total,
      days,
      hasMore,
    }
  );
}

/**
 * Build meetingUpdateConfirmation view
 */
export function buildMeetingUpdateConfirmation(meeting, updatedFields = {}) {
  return buildEnvelope(
    {
      meetingId: meeting.meetingId,
      title: meeting.title,
      scheduledDate: formatDate(meeting.scheduledDate),
      status: meeting.status,
    },
    {
      action: 'meeting_updated',
      updatedFields: Object.keys(updatedFields),
    }
  );
}

/**
 * Build meetingDeleteConfirmation view
 */
export function buildMeetingDeleteConfirmation(meeting) {
  return buildEnvelope(
    {
      meetingId: meeting.meetingId,
      title: meeting.title,
    },
    { action: 'meeting_deleted' }
  );
}

// ─── Error DTOs ──────────────────────────────────────────────────────────────

export function buildMeetingNotFoundError(meetingId) {
  return buildEnvelope(
    { meetingId },
    { error: 'meeting_not_found', message: 'Meeting not found' }
  );
}

export function buildEmptyMeetingsList() {
  return buildEnvelope(
    [],
    { total: 0, hasMore: false }
  );
}

export default {
  buildMeetingCreateConfirmation,
  buildMeetingDetails,
  buildMeetingsList,
  buildMeetingUpdateConfirmation,
  buildMeetingDeleteConfirmation,
  buildMeetingNotFoundError,
  buildEmptyMeetingsList,
};
