/**
 * Shared lead notification helpers — used by routes/leads.js (create/assign),
 * routes/webhooks.js (Instagram intake), routes/aiCallingInternal.js (hot-score
 * call outcome), and scripts/lead-router-handler.js (auto-assignment), so the
 * "who gets notified when" rules live in one place instead of four.
 */
import { createNotification, NotificationCategory } from './notificationDynamodbService.js';
import { sendEmail } from './emailService.js';
import { logger } from './logger.js';

export const LeadNotificationType = {
  NEW_LEAD: 'NEW_LEAD',
  LEAD_ASSIGNED: 'LEAD_ASSIGNED',
  LEAD_HOT: 'LEAD_HOT',
  SITE_VISIT_BOOKED: 'SITE_VISIT_BOOKED',
};

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

/**
 * Look up a team member's email via the internal (non-JWT) auth-service route —
 * the same one scripts/lead-router-handler.js already uses — so this works from
 * webhook/Lambda contexts that don't have a user's bearer token.
 */
async function getTeamMemberEmail(tenantId, userId) {
  if (!userId) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${AUTH_SERVICE_URL}/internal/users/list?tenantId=${encodeURIComponent(tenantId)}`, {
      headers: { 'x-internal-api-key': INTERNAL_API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    const users = Array.isArray(data.users) ? data.users : (Array.isArray(data) ? data : []);
    const match = users.find(u => u.userId === userId);
    return match?.email || null;
  } catch (err) {
    logger.warn('leadNotifications.getTeamMemberEmail.failed', { tenantId, userId, error: err.message });
    return null;
  }
}

async function safeCreateNotification(tenantId, data) {
  try {
    await createNotification(tenantId, data);
  } catch (err) {
    logger.warn('leadNotifications.createNotification.failed', { tenantId, type: data.type, error: err.message });
  }
}

async function safeSendEmail(args) {
  try {
    await sendEmail(args);
  } catch (err) {
    logger.warn('leadNotifications.sendEmail.failed', { to: args.to, error: err.message });
  }
}

/**
 * A new lead was created (any source). In-app only for now — resolving a
 * reliable "agency owner" email needs the Subscriptions table's contactEmail,
 * which is out of scope for this pass; tracked as a follow-up rather than
 * guessed at. The in-app tenant notification feed always fires.
 */
export async function notifyNewLead(tenantId, lead) {
  await safeCreateNotification(tenantId, {
    category: NotificationCategory.LEADS || 'LEADS',
    type: LeadNotificationType.NEW_LEAD,
    title: 'New lead',
    message: `${lead.name || 'A new lead'} came in via ${lead.source || 'Direct'}.`,
    deepLink: `/crm/leads/${lead.leadId}`,
    entityRef: { entityType: 'lead', entityId: lead.leadId },
    dedupeKey: `new_lead:${lead.leadId}`,
  });
}

/**
 * A lead's assignedTo was set or changed. In-app + best-effort email to the
 * assignee.
 */
export async function notifyLeadAssigned(tenantId, lead, assigneeUserId) {
  await safeCreateNotification(tenantId, {
    category: NotificationCategory.LEADS || 'LEADS',
    type: LeadNotificationType.LEAD_ASSIGNED,
    title: 'Lead assigned to you',
    message: `${lead.name || 'A lead'} was assigned to you.`,
    deepLink: `/crm/leads/${lead.leadId}`,
    entityRef: { entityType: 'lead', entityId: lead.leadId },
    dedupeKey: `lead_assigned:${lead.leadId}:${assigneeUserId}`,
    // "Assigned to you" is the one notification here with a single owner, so
    // the push goes to that person's phones rather than the whole agency.
    targetUserId: assigneeUserId,
  });

  const email = await getTeamMemberEmail(tenantId, assigneeUserId);
  if (email) {
    await safeSendEmail({
      to: email,
      subject: `Lead assigned to you: ${lead.name || 'New lead'}`,
      html: `<p>${lead.name || 'A lead'} (${lead.phone || 'no phone'}) has been assigned to you.</p>`,
      text: `${lead.name || 'A lead'} (${lead.phone || 'no phone'}) has been assigned to you.`,
    });
  }
}

/**
 * Someone booked a site visit from a public property page.
 *
 * This exists as its own notification rather than relying on `notifyNewLead`
 * because `ingestLead()` deliberately stays silent when an enquiry matches an
 * existing lead — correct for a repeat enquiry, wrong here. A booked visit is
 * a calendar commitment someone has to turn up for, so it must reach the
 * agency whether or not the person was already in the CRM.
 *
 * Fires in addition to the meeting's own 15-minute reminder: the reminder
 * tells you a visit is imminent, this tells you one was booked at all.
 */
export async function notifySiteVisitBooked(tenantId, { lead, meeting, propertyTitle }) {
  const when = `${meeting.meetingDate} at ${meeting.meetingTime}`;
  const where = propertyTitle ? ` for ${propertyTitle}` : '';

  await safeCreateNotification(tenantId, {
    category: NotificationCategory.LEADS || 'LEADS',
    type: LeadNotificationType.SITE_VISIT_BOOKED,
    title: 'Site visit booked',
    message: `${lead.name || 'Someone'} booked a site visit${where} on ${when}.`,
    deepLink: `/crm/leads/${lead.leadId}`,
    entityRef: { entityType: 'lead', entityId: lead.leadId },
    // Keyed on the meeting, not the lead: one person booking two different
    // visits must produce two notifications, and a retried request for the
    // same booking must produce one.
    dedupeKey: `site_visit_booked:${meeting.meetingId}`,
  });

  if (lead.assignedTo) {
    const email = await getTeamMemberEmail(tenantId, lead.assignedTo);
    if (email) {
      await safeSendEmail({
        to: email,
        subject: `Site visit booked: ${lead.name || 'a visitor'} on ${when}`,
        html: `<p><strong>${lead.name || 'A visitor'}</strong> (${lead.phone || 'no phone'}) booked a site visit${where}.</p><p>When: <strong>${when}</strong></p>`,
        text: `${lead.name || 'A visitor'} (${lead.phone || 'no phone'}) booked a site visit${where} on ${when}.`,
      });
    }
  }
}

/**
 * A lead was scored HOT (by AI call, LLM fallback, or manual override).
 * In-app to the tenant feed + best-effort email if already assigned.
 */
export async function notifyHotLead(tenantId, lead) {
  await safeCreateNotification(tenantId, {
    category: NotificationCategory.LEADS || 'LEADS',
    type: LeadNotificationType.LEAD_HOT,
    title: '🔥 Hot lead',
    message: `${lead.name || 'A lead'} is qualified HOT — call now.`,
    deepLink: `/crm/leads/${lead.leadId}`,
    entityRef: { entityType: 'lead', entityId: lead.leadId },
    dedupeKey: `lead_hot:${lead.leadId}:${lead.scoredAt || ''}`,
  });

  if (lead.assignedTo) {
    const email = await getTeamMemberEmail(tenantId, lead.assignedTo);
    if (email) {
      await safeSendEmail({
        to: email,
        subject: `🔥 Hot lead: ${lead.name || 'call now'}`,
        html: `<p>${lead.name || 'A lead'} (${lead.phone || 'no phone'}) just qualified HOT: ${lead.scoreReasons || ''}</p>`,
        text: `${lead.name || 'A lead'} (${lead.phone || 'no phone'}) just qualified HOT: ${lead.scoreReasons || ''}`,
      });
    }
  }
}
