/**
 * Shared lead notification helpers — used by routes/leads.js (create/assign),
 * routes/webhooks.js (Instagram intake), routes/aiCallingInternal.js (hot-score
 * call outcome), and scripts/lead-router-handler.js (auto-assignment), so the
 * "who gets notified when" rules live in one place instead of four.
 */
import { createNotification, NotificationCategory } from './notificationDynamodbService.js';
import { sendEmail } from './emailService.js';
import { logger } from './logger.js';
import { getAuthServiceBaseUrl } from './config/serviceUrls.js';

export const LeadNotificationType = {
  NEW_LEAD: 'NEW_LEAD',
  LEAD_ASSIGNED: 'LEAD_ASSIGNED',
  LEAD_HOT: 'LEAD_HOT',
  SITE_VISIT_BOOKED: 'SITE_VISIT_BOOKED',
  FOLLOWUP_ESCALATION: 'FOLLOWUP_ESCALATION',
  MARKETPLACE_ACTIVITY: 'MARKETPLACE_ACTIVITY',
};

/** Roles that count as "the agency owner" for escalations (see CONTRACTS.md 7). */
const ADMIN_ROLES = new Set(['ADMIN', 'FOUNDER', 'OWNER']);

/**
 * List the tenant's team via the internal (non-JWT) auth-service route — the
 * same one scripts/lead-router-handler.js already uses — so this works from
 * webhook/Lambda contexts that don't have a user's bearer token.
 *
 * Normalised to one shape regardless of which field names the auth service
 * happens to return: `{ userId, name, email, phone, role }`. Returns [] on any
 * failure — every caller here treats "could not resolve the team" as "skip the
 * per-person channels", never as a reason to fail the notification.
 */
export async function listTeamMembers(tenantId) {
  if (!tenantId) return [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // Read at call time, not import: ssmBootstrap hydrates process.env on the
    // Lambda cold start, after this module has loaded.
    const response = await fetch(`${getAuthServiceBaseUrl()}/internal/users/list?tenantId=${encodeURIComponent(tenantId)}`, {
      headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY || '' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return [];
    const data = await response.json();
    const users = Array.isArray(data.users) ? data.users : (Array.isArray(data) ? data : []);
    return users
      .filter(u => u && u.userId)
      .map(u => ({
        userId: u.userId,
        name: u.displayName || u.name || u.username || u.email || 'Team member',
        email: u.email || null,
        phone: u.phoneNumber || u.phone || null,
        role: u.role ? String(u.role).toUpperCase() : null,
      }));
  } catch (err) {
    logger.warn('leadNotifications.listTeamMembers.failed', { tenantId, error: err.message });
    return [];
  }
}

export function isAdminMember(member) {
  return Boolean(member?.role && ADMIN_ROLES.has(member.role));
}

async function getTeamMemberEmail(tenantId, userId) {
  if (!userId) return null;
  const members = await listTeamMembers(tenantId);
  return members.find(u => u.userId === userId)?.email || null;
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

/**
 * The AI follow-up caller needs a human (CONTRACTS.md 3.2).
 *
 * Reaches the lead's assignee, every admin, and any extra user ids the tenant
 * configured — the union is computed by the caller (routes/followupInternal.js)
 * and arrives as `targetUserIds`. Four channels, each best-effort and
 * independent: in-app (the one that always fires), email and WhatsApp to each
 * resolved member, and a note on the lead so the reason survives in the
 * record even after the notification is dismissed.
 *
 * Deliberately never includes the lead's phone number in any outbound text:
 * team members see masked numbers in the CRM and call through click-to-call
 * (docs/agency-app/api/PHONE-MASKING-AND-CLICK-TO-CALL.md), and an escalation email is the
 * easiest place to leak one by accident.
 *
 * @returns {Promise<{ notified: string[] }>} user ids the in-app notification targets
 */
export async function notifyFollowupEscalation(tenantId, { lead, jobId, jobType, reason, summary, targetUserIds, details }) {
  const leadName = lead?.name || 'A lead';
  const reasonLabel = {
    max_attempts_exhausted: 'could not reach them after the configured attempts',
    callback_requested: 'they asked for a call back from a person',
    open_actions: 'there are open actions the agent cannot take',
    error: 'the call could not be completed',
  }[reason] || (reason ? String(reason).replace(/_/g, ' ') : 'needs a human');
  const purpose = jobType === 'post_visit_feedback' ? 'post-visit feedback call' : 'site-visit confirmation call';
  const summaryText = summary ? String(summary).slice(0, 1000) : '';
  const humanReason = details?.needsHumanReason ? String(details.needsHumanReason).slice(0, 300) : '';

  const targets = Array.from(new Set((targetUserIds || []).filter(Boolean)));

  await safeCreateNotification(tenantId, {
    category: NotificationCategory.LEADS || 'LEADS',
    type: LeadNotificationType.FOLLOWUP_ESCALATION,
    title: 'AI follow-up needs you',
    message: `${leadName}: ${purpose} — ${reasonLabel}.${summaryText ? ` ${summaryText}` : ''}`.slice(0, 500),
    deepLink: `/crm/leads/${lead?.leadId}`,
    entityRef: { entityType: 'lead', entityId: lead?.leadId },
    // One escalation per job: the service retries its own delivery, and a
    // retried request for the same job must not notify twice.
    dedupeKey: `followup_escalation:${jobId}`,
    targetUserIds: targets.length ? targets : undefined,
  });

  // Per-person channels. Resolving the team can fail (auth service down);
  // the in-app notification above has already landed by then.
  const members = targets.length ? await listTeamMembers(tenantId) : [];
  const recipients = members.filter(m => targets.includes(m.userId));

  const subject = `AI follow-up needs you: ${leadName}`;
  const lines = [
    `${leadName} — ${purpose}: ${reasonLabel}.`,
    summaryText ? `Summary: ${summaryText}` : null,
    humanReason ? `Reason given: ${humanReason}` : null,
    `Open the lead: ${process.env.APP_URL ? `${process.env.APP_URL.replace(/\/+$/, '')}/crm/leads/${lead?.leadId}` : `/crm/leads/${lead?.leadId}`}`,
  ].filter(Boolean);
  const text = lines.join('\n');
  const html = `<p>${lines.map(l => l.replace(/</g, '&lt;')).join('</p><p>')}</p>`;

  for (const member of recipients) {
    if (member.email) {
      await safeSendEmail({ to: member.email, subject, html, text });
    }
  }

  // WhatsApp is optional infrastructure (Baileys may be off for a tenant or
  // an environment); loaded lazily like scripts/lead-followup-cron.js so this
  // module stays importable where it isn't configured at all.
  try {
    const { isBaileyEnabled, sendWhatsAppMessage } = await import('./bailey.js');
    if (isBaileyEnabled()) {
      for (const member of recipients) {
        if (!member.phone) continue;
        try {
          await sendWhatsAppMessage(member.phone, text);
        } catch (err) {
          logger.warn('leadNotifications.escalation.whatsapp_failed', { tenantId, userId: member.userId, error: err.message });
        }
      }
    }
  } catch (err) {
    logger.warn('leadNotifications.escalation.whatsapp_unavailable', { tenantId, error: err.message });
  }

  try {
    const { createLeadNote } = await import('./crmDynamodbService.js');
    await createLeadNote(tenantId, lead?.leadId, {
      content: `[AI Follow-up] Escalated to the team — ${purpose}: ${reasonLabel}.${summaryText ? ` ${summaryText}` : ''}${humanReason ? ` Reason: ${humanReason}` : ''}`,
      createdBy: 'AI Follow-up Agent',
    });
  } catch (err) {
    logger.warn('leadNotifications.escalation.note_failed', { tenantId, leadId: lead?.leadId, error: err.message });
  }

  return { notified: targets };
}

/**
 * Activity from the consumer marketplace (properties portal): a buyer opened
 * a chat, sent a message, pinged "I'm interested", or requested a visit.
 *
 * Channels are governed by the agency's `marketplaceNotifications` settings
 * (AgencyConfig, edited in the CRM under Settings → Public pages). In-app
 * always fires; email / WhatsApp / push each only when switched on. The
 * audience is the lead's assignee plus every admin — the same rule as
 * `notifyFollowupEscalation` — plus any extra emails/phones the agency listed.
 *
 * Like the escalation notifier this never puts the buyer's phone number in an
 * outbound text; the CRM masks numbers and the agent calls through the lead.
 *
 * @param {string} tenantId
 * @param {object} args
 * @param {'enquiry'|'message'|'ping'|'visit_request'} args.kind
 * @param {object} args.lead                 the CRM lead (leadId, name, assignedTo)
 * @param {string} [args.propertyTitle]
 * @param {string} [args.threadId]           marketplace thread, for the deep link
 * @param {string} [args.preview]            first ~200 chars of the buyer's text
 * @param {string} [args.messageId]          dedupe key component (one alert per message)
 * @param {object} [args.settings]           pre-resolved marketplaceNotifications
 * @returns {Promise<{ notified: string[], channels: string[] }>}
 */
export async function notifyMarketplaceActivity(tenantId, {
  kind, lead, propertyTitle, threadId, preview, messageId, settings,
}) {
  const leadName = lead?.name || 'A buyer';
  const forTitle = propertyTitle ? ` for ${propertyTitle}` : '';
  const headline = {
    enquiry: `${leadName} started a chat${forTitle}`,
    message: `${leadName} sent a message${forTitle}`,
    ping: `${leadName} is interested${forTitle}`,
    visit_request: `${leadName} requested a site visit${forTitle}`,
  }[kind] || `${leadName} reached out${forTitle}`;
  const body = preview ? String(preview).slice(0, 200) : '';
  const deepLink = threadId ? `/crm/marketplace/inbox/${threadId}` : `/crm/leads/${lead?.leadId}`;

  let prefs = settings;
  if (!prefs) {
    try {
      const { getAgencyConfig } = await import('./agencyConfigService.js');
      const { normaliseMarketplaceNotifications } = await import('./publicListingService.js');
      prefs = normaliseMarketplaceNotifications((await getAgencyConfig(tenantId))?.marketplaceNotifications);
    } catch (err) {
      logger.warn('leadNotifications.marketplace.settings_failed', { tenantId, error: err.message });
      prefs = { email: true, whatsapp: false, push: true, extraEmails: [], extraPhones: [] };
    }
  }

  const members = await listTeamMembers(tenantId);
  const targets = new Set();
  if (lead?.assignedTo) targets.add(lead.assignedTo);
  for (const m of members) if (isAdminMember(m)) targets.add(m.userId);
  const targetIds = Array.from(targets);

  await safeCreateNotification(tenantId, {
    category: NotificationCategory.LEADS || 'LEADS',
    type: LeadNotificationType.MARKETPLACE_ACTIVITY,
    title: { enquiry: 'New marketplace enquiry', message: 'New marketplace message', ping: 'Buyer interested', visit_request: 'Site visit requested' }[kind] || 'Marketplace activity',
    message: `${headline}.${body ? ` "${body}"` : ''}`.slice(0, 500),
    deepLink,
    entityRef: { entityType: 'lead', entityId: lead?.leadId },
    dedupeKey: `marketplace:${kind}:${messageId || threadId || lead?.leadId}`,
    // Push is delivered by dispatchPushForNotification inside createNotification
    // to these members' phones; an agency that turned push off gets the in-app
    // entry with no phone audience.
    targetUserIds: prefs.push === false ? undefined : (targetIds.length ? targetIds : undefined),
  });

  const channels = ['in_app'];
  const recipients = members.filter((m) => targets.has(m.userId));
  const appUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/+$/, '') : '';
  const lines = [
    `${headline}.`,
    body ? `Message: ${body}` : null,
    `Reply in the CRM: ${appUrl}${deepLink}`,
  ].filter(Boolean);
  const text = lines.join('\n');
  const html = `<p>${lines.map((l) => l.replace(/</g, '&lt;')).join('</p><p>')}</p>`;

  if (prefs.email) {
    const emails = new Set(recipients.map((m) => m.email).filter(Boolean));
    for (const extra of prefs.extraEmails || []) emails.add(extra);
    for (const to of emails) {
      await safeSendEmail({ to, subject: `RealEstateFlow: ${headline}`, html, text });
    }
    if (emails.size) channels.push('email');
  }

  if (prefs.whatsapp) {
    try {
      const { isBaileyEnabled, sendWhatsAppMessage } = await import('./bailey.js');
      if (isBaileyEnabled()) {
        const phones = new Set(recipients.map((m) => m.phone).filter(Boolean));
        for (const extra of prefs.extraPhones || []) phones.add(extra);
        for (const phone of phones) {
          try {
            await sendWhatsAppMessage(phone, text);
          } catch (err) {
            logger.warn('leadNotifications.marketplace.whatsapp_failed', { tenantId, error: err.message });
          }
        }
        if (phones.size) channels.push('whatsapp');
      }
    } catch (err) {
      logger.warn('leadNotifications.marketplace.whatsapp_unavailable', { tenantId, error: err.message });
    }
  }

  if (lead?.leadId && (kind === 'enquiry' || kind === 'ping' || kind === 'visit_request')) {
    try {
      const { createLeadNote } = await import('./crmDynamodbService.js');
      await createLeadNote(tenantId, lead.leadId, {
        content: `[Marketplace] ${headline}.${body ? ` "${body}"` : ''}`,
        createdBy: 'Marketplace',
      });
    } catch (err) {
      logger.warn('leadNotifications.marketplace.note_failed', { tenantId, leadId: lead.leadId, error: err.message });
    }
  }

  return { notified: targetIds, channels };
}
