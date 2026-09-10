/**
 * Resolves who a meeting reminder should reach: the lead's assignee and the
 * agency owner — explicitly never the customer/lead, who has no device
 * registration or team-member email to begin with.
 *
 * scheduleMeetingReminder() (notificationDynamodbService.js) already creates
 * the scheduled-notification row synchronously inside createMeeting/
 * updateMeeting (crmDynamodbService.js), before the recipient list below can
 * be resolved (that needs an HTTP round-trip to the auth service, which
 * crmDynamodbService.js deliberately never does — it's a pure DB module).
 * So this runs as a second, best-effort step from the route layer right
 * after create/update, patching the already-scheduled row's payload via its
 * dedupeKey. If it fails or the meeting is too soon for a reminder to have
 * been scheduled at all, the reminder still fires — just without a resolved
 * audience, i.e. exactly today's behavior.
 */
import { getLead } from './crmDynamodbService.js';
import { getAgencyConfig } from './agencyConfigService.js';
import {
  getScheduledNotificationByDedupeKey,
  updateScheduledNotification,
} from './notificationDynamodbService.js';
import { logger } from './logger.js';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

/** Same internal (non-JWT) route leadNotifications.js uses for team lookups. */
async function listTenantUsers(tenantId) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${AUTH_SERVICE_URL}/internal/users/list?tenantId=${encodeURIComponent(tenantId)}`, {
      headers: { 'x-internal-api-key': INTERNAL_API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      logger.warn('meetingReminderRecipients.listTenantUsers.non_ok', {
        tenantId,
        status: response.status,
        authServiceUrl: AUTH_SERVICE_URL,
      });
      return [];
    }
    const data = await response.json();
    const result = Array.isArray(data.users) ? data.users : (Array.isArray(data) ? data : []);
    logger.info('meetingReminderRecipients.listTenantUsers.ok', { tenantId, count: result.length });
    return result;
  } catch (err) {
    logger.warn('meetingReminderRecipients.listTenantUsers.failed', {
      tenantId,
      error: err.message,
      authServiceUrl: AUTH_SERVICE_URL,
    });
    return [];
  }
}

/**
 * @param {string} tenantId
 * @param {object} meeting - as returned by createMeeting/updateMeeting
 * @returns {Promise<{targetUserIds: string[], recipientEmails: string[]}>}
 */
export async function resolveMeetingReminderRecipients(tenantId, meeting) {
  const targetUserIds = new Set();
  const emails = new Set();

  const users = await listTenantUsers(tenantId);

  // Assignee — from the related lead, if this meeting came from one.
  // assignedTo is always an internal team member's userId, never the lead's
  // own id, so there is no risk of accidentally targeting the customer here.
  if (meeting.relatedEntityType === 'lead' && meeting.relatedEntityId) {
    try {
      const lead = await getLead(tenantId, meeting.relatedEntityId);
      if (lead?.assignedTo) {
        const assignee = users.find((u) => u.userId === lead.assignedTo);
        if (assignee) {
          targetUserIds.add(assignee.userId);
          if (assignee.email) emails.add(assignee.email);
        }
      }
    } catch (err) {
      logger.warn('meetingReminderRecipients.leadLookup.failed', {
        tenantId,
        leadId: meeting.relatedEntityId,
        error: err.message,
      });
    }
  }

  // Agency owner — resolved from the same tenant user list as the assignee
  // (role === 'ADMIN', the single-admin-per-tenant invariant this repo's
  // auth service enforces — see findAdminByTenantId in
  // reality-flow-authentication/src/models/usersModel.ts), NOT from
  // server/agencyConfigService.js's prod-realestateflow-agencies table:
  // that table is a separate, disconnected store from the auth service's
  // real USERS_TABLE and is empty for tenants onboarded via the current
  // onboarding-page flow, so agency.adminEmail silently resolves to nothing.
  const owner = users.find((u) => u.role === 'ADMIN');
  if (owner) {
    targetUserIds.add(owner.userId);
    if (owner.email) emails.add(owner.email);
  } else {
    // Fallback only reached if the users-list lookup itself failed/came back
    // empty — agencyConfig is still worth trying since it's occasionally
    // populated even when USERS_TABLE isn't reachable.
    try {
      const agency = await getAgencyConfig(tenantId);
      if (agency?.adminEmail) emails.add(agency.adminEmail);
    } catch (err) {
      logger.warn('meetingReminderRecipients.agencyLookup.failed', { tenantId, error: err.message });
    }
  }

  return { targetUserIds: [...targetUserIds], recipientEmails: [...emails] };
}

/**
 * Patch the scheduled reminder that scheduleMeetingReminder() already
 * created (dedupeKey MEETING_REMINDER#{meetingId}) with the resolved
 * audience. No-op if no reminder was scheduled (meeting too soon) or it
 * already fired/was cancelled.
 */
export async function attachMeetingReminderRecipients(tenantId, meeting) {
  const { targetUserIds, recipientEmails } = await resolveMeetingReminderRecipients(tenantId, meeting);
  if (targetUserIds.length === 0 && recipientEmails.length === 0) return;

  const dedupeKey = `MEETING_REMINDER#${meeting.meetingId}`;
  const scheduled = await getScheduledNotificationByDedupeKey(tenantId, dedupeKey);
  if (!scheduled || scheduled.status !== 'pending') return;

  await updateScheduledNotification(tenantId, scheduled.scheduledId, {
    payload: { ...scheduled.payload, targetUserIds, recipientEmails },
  });
}
