/**
 * Push delivery via Firebase Cloud Messaging (HTTP v1).
 *
 * FCM rather than talking to APNs and to Android separately: one credential,
 * one send call, and Google relays to APNs for iOS. Since the app ships to both
 * stores from the same codebase, a single provider means one thing to configure
 * and one place delivery can break.
 *
 * NOTHING HERE MAY THROW OR BLOCK.
 * The credentials do not exist yet (creating the Firebase project is item 8 in
 * MOBILE_LAUNCH_YOUR_TASKS.md), and this module is called from the same code
 * path that writes in-app notifications. If an unconfigured push tried to throw,
 * every lead assignment and rent-expiry notification in production would start
 * failing because of a mobile feature nobody has switched on yet. So the whole
 * module degrades to a logged no-op: absent credentials, an uninstalled SDK and
 * a mid-send FCM outage all end the same way, with the in-app notification
 * already safely written.
 */

import { logger } from '../../logger.js';
import {
  listUserDeviceTokens,
  listTenantDeviceTokens,
  pruneDeviceTokens,
} from './deviceTokenRepository.js';

/** FCM caps a multicast at 500 tokens per request. */
const MAX_TOKENS_PER_BATCH = 500;

/**
 * Error codes that mean "this token is dead", as opposed to "this send failed".
 * Only these justify deleting a registration — a transient FCM 5xx surfaces as
 * messaging/server-unavailable and must leave the token alone.
 */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Resolved once and cached: null means "push is off", and we never retry the
 * import, because in the unconfigured case that would be a wasted dynamic
 * import on every single notification write.
 */
let messagingPromise = null;

/** True when Firebase credentials are present in the environment. */
export function isPushConfigured() {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

/**
 * Lazily import and initialise firebase-admin.
 *
 * Dynamic rather than a top-level import so an unconfigured deployment never
 * loads the SDK at all: firebase-admin is a heavy dependency on a Lambda cold
 * start, and if it is missing from the bundle entirely this degrades to a
 * warning instead of taking the whole API down at module-load time.
 */
async function getMessaging() {
  if (messagingPromise) return messagingPromise;

  messagingPromise = (async () => {
    if (!isPushConfigured()) {
      logger.info('push.disabled.no_credentials');
      return null;
    }

    try {
      const { initializeApp, getApps, cert, applicationDefault } = await import('firebase-admin/app');
      const { getMessaging: getFirebaseMessaging } = await import('firebase-admin/messaging');

      // Lambda containers are reused, so a second initializeApp() on a warm
      // invocation would throw a duplicate-app error.
      const app = getApps().length > 0
        ? getApps()[0]
        : initializeApp({
          credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
            ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
            : applicationDefault(),
        });

      logger.info('push.initialized');
      return getFirebaseMessaging(app);
    } catch (err) {
      logger.error('push.init.failed', { error: err.message });
      return null;
    }
  })();

  return messagingPromise;
}

/**
 * Build the FCM message body.
 *
 * `data` values must all be strings — FCM rejects the request outright
 * otherwise, and a rejected send is indistinguishable in the logs from a
 * misconfigured project.
 */
function buildMessage(payload) {
  const data = {};
  for (const [key, value] of Object.entries(payload.data || {})) {
    if (value == null) continue;
    data[key] = String(value);
  }

  return {
    notification: {
      title: payload.title || 'RealEstateFlow',
      body: payload.body || '',
    },
    data,
    android: {
      priority: 'high',
      notification: {
        // Matches the tab-bar accent so the shade icon reads as ours.
        color: '#2563EB',
        // Collapsing on the deep link stops a burst of lead updates from
        // stacking five near-identical rows in the notification shade.
        tag: data.deepLink || undefined,
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          // Drives the app icon badge; NotificationCenter already tracks the
          // same unread count in-app.
          badge: payload.badge ?? undefined,
        },
      },
    },
  };
}

/**
 * Send to a set of registered devices, pruning whatever FCM rejects as dead.
 * Returns a summary; never rejects.
 */
async function sendToDevices(tenantId, devices, payload) {
  if (devices.length === 0) return { sent: 0, failed: 0, pruned: 0 };

  const messaging = await getMessaging();
  if (!messaging) return { sent: 0, failed: 0, pruned: 0, skipped: true };

  const message = buildMessage(payload);
  let sent = 0;
  let failed = 0;
  const dead = [];

  for (let i = 0; i < devices.length; i += MAX_TOKENS_PER_BATCH) {
    const batch = devices.slice(i, i + MAX_TOKENS_PER_BATCH);
    try {
      const response = await messaging.sendEachForMulticast({
        ...message,
        tokens: batch.map((device) => device.token),
      });

      sent += response.successCount;
      failed += response.failureCount;

      response.responses.forEach((result, index) => {
        if (result.success) return;
        const code = result.error?.code;
        if (DEAD_TOKEN_CODES.has(code)) {
          dead.push({ userId: batch[index].userId, token: batch[index].token });
        } else {
          logger.warn('push.send.token_failed', { tenantId, code });
        }
      });
    } catch (err) {
      // An entire batch failing is an FCM or network problem, not a token
      // problem, so nothing is pruned here.
      failed += batch.length;
      logger.error('push.send.batch_failed', { tenantId, error: err.message });
    }
  }

  let pruned = 0;
  if (dead.length > 0) {
    try {
      pruned = await pruneDeviceTokens(tenantId, dead);
    } catch (err) {
      logger.warn('push.prune.failed', { tenantId, error: err.message });
    }
  }

  logger.info('push.send.complete', { tenantId, sent, failed, pruned });
  return { sent, failed, pruned };
}

/**
 * Push to every device belonging to one user.
 * @param {string} tenantId
 * @param {string} userId
 * @param {{title: string, body: string, data?: object, badge?: number}} payload
 */
export async function sendPushToUser(tenantId, userId, payload) {
  if (!isPushConfigured()) return { sent: 0, failed: 0, pruned: 0, skipped: true };

  try {
    const devices = await listUserDeviceTokens(tenantId, userId);
    return await sendToDevices(tenantId, devices, payload);
  } catch (err) {
    logger.error('push.sendToUser.failed', { tenantId, userId, error: err.message });
    return { sent: 0, failed: 0, pruned: 0, error: true };
  }
}

/** Push to every device in a tenant. Used for agency-wide notifications. */
export async function sendPushToTenant(tenantId, payload) {
  if (!isPushConfigured()) return { sent: 0, failed: 0, pruned: 0, skipped: true };

  try {
    const devices = await listTenantDeviceTokens(tenantId);
    return await sendToDevices(tenantId, devices, payload);
  } catch (err) {
    logger.error('push.sendToTenant.failed', { tenantId, error: err.message });
    return { sent: 0, failed: 0, pruned: 0, error: true };
  }
}

/**
 * Mirror a freshly created in-app notification out to the user's phones.
 *
 * Awaited by the caller rather than fire-and-forget: on Lambda the container is
 * frozen the moment the response is returned, so a detached promise would be
 * suspended mid-flight and the push would arrive minutes later on the next
 * invocation, or never. The `isPushConfigured()` short-circuit above keeps that
 * await free until Firebase is actually set up.
 *
 * @param {string} tenantId
 * @param {object} notification - the item written by createNotification()
 */
export async function dispatchPushForNotification(tenantId, notification) {
  if (!isPushConfigured() || !notification) return { skipped: true };

  const payload = {
    title: notification.title || 'RealEstateFlow',
    body: notification.message || '',
    data: {
      notificationId: notification.notificationId,
      category: notification.category,
      type: notification.type,
      // The mobile app routes on this — see lib/pushNotifications.ts.
      deepLink: notification.deepLink || '/crm',
    },
  };

  // A notification aimed at one team member (a lead assignment) should not
  // buzz the whole agency; everything else is genuinely agency-wide.
  return notification.targetUserId
    ? sendPushToUser(tenantId, notification.targetUserId, payload)
    : sendPushToTenant(tenantId, payload);
}
