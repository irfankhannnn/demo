/**
 * Event layer.
 *
 * USE_EVENTBRIDGE=true  → publish to AWS EventBridge (ECS production)
 * USE_EVENTBRIDGE=false → forward directly to CRM via HTTP webhook (local / simple)
 *
 * Both modes are transparent to callers — the same publish() interface.
 */
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { forwardWebhook } from '../webhookForwarder.js';
import {
  USE_EVENTBRIDGE,
  EVENT_BUS_NAME,
  AWS_REGION,
  CRM_WEBHOOK_URL,
  CRM_WEBHOOK_SECRET,
} from '../config.js';
import { logger } from '../logger.js';

let ebClient = null;
function getEb() {
  if (!ebClient) ebClient = new EventBridgeClient({ region: AWS_REGION });
  return ebClient;
}

async function publishToEventBridge(source, detailType, detail) {
  const entry = {
    Source: source,
    DetailType: detailType,
    Detail: JSON.stringify({ ...detail, publishedAt: new Date().toISOString() }),
    EventBusName: EVENT_BUS_NAME === 'default' ? undefined : EVENT_BUS_NAME,
  };
  await getEb().send(new PutEventsCommand({ Entries: [entry] }));
  logger.info({ source, detailType, phone: detail.phone || detail.tenantId }, 'event.published.eventbridge');
}

async function publishToWebhook(detailType, detail) {
  if (!CRM_WEBHOOK_URL) {
    logger.debug({ detailType }, 'event.webhook.skip.no_url');
    return;
  }
  const payload = { event: detailType, ...detail, timestamp: new Date().toISOString() };
  await forwardWebhook(CRM_WEBHOOK_URL, payload, CRM_WEBHOOK_SECRET);
  logger.info({ detailType, phone: detail.phone }, 'event.published.webhook');
}

async function publish(source, detailType, detail, { throwOnFailure = false } = {}) {
  try {
    if (USE_EVENTBRIDGE) {
      await publishToEventBridge(source, detailType, detail);
    }
    // Local/simple mode: forward incoming messages directly to CRM webhook.
    // ECS production uses EventBridge only (CRM Lambda rule handles delivery).
    if (!USE_EVENTBRIDGE && source === 'whatsapp.incoming') {
      await publishToWebhook(detailType, detail);
    }
    return true;
  } catch (err) {
    logger.error({ source, detailType, error: err.message }, 'event.publish.failed');
    if (throwOnFailure) throw err;
    return false;
  }
}

export const events = {
  messageReceived(detail) {
    return publish('whatsapp.incoming', 'message.received', detail, { throwOnFailure: true });
  },
  messageSent(detail) {
    return publish('whatsapp.outbound', 'message.sent', detail);
  },
  messageFailed(detail) {
    return publish('whatsapp.outbound', 'message.failed', detail);
  },
  sessionConnected(detail) {
    return publish('whatsapp.session', 'session.connected', detail);
  },
  sessionDisconnected(detail) {
    return publish('whatsapp.session', 'session.disconnected', detail);
  },
  sessionRestored(detail) {
    return publish('whatsapp.session', 'session.restored', detail);
  },
  sessionAuthFailure(detail) {
    return publish('whatsapp.session', 'session.auth_failure', detail);
  },
};
