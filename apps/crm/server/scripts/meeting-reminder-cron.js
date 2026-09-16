/**
 * Meeting Reminder Cron — runs every 5 minutes via EventBridge.
 *
 * Drains the SCHEDULED notification queue (notificationDynamodbService.js's
 * createScheduledNotification/getDueScheduledNotifications) across every
 * tenant that has a pending entry. Meeting reminders are the main occupant
 * today (scheduleMeetingReminder(), fired 15 minutes before a CRM meeting),
 * but this also drains khata reminders — the queue was always designed to be
 * generic, and processDueNotifications() already handles both.
 *
 * 5-minute cadence rather than the once/day cadence of this repo's other
 * cron Lambdas: a reminder is time-sensitive relative to a specific clock
 * time (15 minutes before a meeting), not a daily digest, so it needs to be
 * caught inside a tight window of its dueAt.
 *
 * SSM-hydrated (not per-function CFN Environment.Variables) so this reuses
 * the same NOTIFICATIONS_TABLE_NAME/PUSH_TOKENS_TABLE/SES/Brevo/Firebase
 * config the main API Lambda already gets via apps/crm/server/config/ssmBootstrap.js —
 * one source of truth instead of a second copy to keep in sync.
 */
import { hydrateConfigFromSsm } from '../config/ssmBootstrap.js';

export async function handler(event) {
  try {
    await hydrateConfigFromSsm();

    // Deferred until after hydration — these modules read process.env.X at
    // module-load time (table names, SES/Brevo/Firebase config), so importing
    // them before hydrateConfigFromSsm() resolves would lock in empty values.
    const { getAllTenantsWithScheduledNotifications, processDueNotifications } = await import('../notificationDynamodbService.js');
    const { logger } = await import('../logger.js');
    const { shutdownPostHog } = await import('../lib/posthog.js');

    try {
      const tenantIds = await getAllTenantsWithScheduledNotifications();
      logger.info('meeting-reminder-cron: processing tenants', { count: tenantIds.length });

      const results = [];
      for (const tenantId of tenantIds) {
        try {
          const result = await processDueNotifications(tenantId);
          results.push({ tenantId, ...result });
        } catch (err) {
          logger.error('meetingReminderCron.tenant.failed', { tenantId, error: err.message });
          results.push({ tenantId, error: err.message });
        }
      }

      return { statusCode: 200, body: JSON.stringify({ results }) };
    } catch (err) {
      logger.error('meeting-reminder-cron: fatal error', { error: err.message });
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    } finally {
      try { await shutdownPostHog(); } catch (_) {}
    }
  } catch (err) {
    // Hydration or the initial dynamic imports themselves failed — logger
    // may not exist yet, so this is the one place console is correct.
    console.error('meeting-reminder-cron: startup failed', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
