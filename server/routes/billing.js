import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { createProvisioningRow } from '../aiEmployeeProvisioningService.js';
import { logEventIfNotProcessed } from '../webhookLogService.js';
import { incrementSeatsPaid } from '../subscriptionService.js';
import { logger } from '../logger.js';

const router = express.Router();

/**
 * Server-side PostHog tracking. PR-E creates the real module;
 * this calls it if available, otherwise logs.
 */
async function serverTrack(distinctId, event, properties = {}) {
  try {
    const { serverTrack: phTrack } = await import('../lib/posthog.js');
    await phTrack(distinctId, event, properties);
  } catch {
    logger.info('[posthog stub]', { distinctId, event, properties });
  }
}

/**
 * Send transactional email via Brevo.
 * Failure must NOT fail the webhook — always returns 200.
 */
async function sendBrevoEmail(templateId, to, params) {
  if (!templateId || !process.env.BREVO_API_KEY) {
    logger.warn('Brevo email skipped — missing template ID or API key', { templateId, to });
    return;
  }
  try {
    await axios.post('https://api.brevo.com/v3/smtp/email', {
      templateId: parseInt(templateId, 10),
      to: [{ email: to }],
      params,
    }, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    logger.error('Brevo email failed (non-fatal)', { error: err.message, to });
  }
}

/**
 * Send AiSensy WhatsApp broadcast.
 */
async function sendAiSensyBroadcast(campaignName, userName, userPhoneNumber) {
  if (!process.env.AISENSY_API_KEY) {
    logger.warn('AiSensy broadcast skipped — missing API key');
    return;
  }
  try {
    await axios.post('https://backend.aisensy.com/campaign/t1/api', {
      apiKey: process.env.AISENSY_API_KEY,
      campaignName,
      userName,
      userPhoneNumber,
    });
  } catch (err) {
    logger.error('AiSensy broadcast failed (non-fatal)', { error: err.message });
  }
}

// POST /webhook — Razorpay sends all subscription + payment events here
// Mounted before express.json() in server.js — use express.raw to preserve body for HMAC
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // 1. Parse raw body (Buffer from express.raw)
    const rawBody = req.body;
    let body;
    try {
      body = JSON.parse(rawBody.toString());
    } catch {
      return res.status(400).json({ error: 'invalid_json' });
    }

    // 2. Verify HMAC signature against raw body
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'webhook_not_configured' });
    }

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSig) {
      logger.warn('Invalid webhook signature', { signature });
      return res.status(401).json({ error: 'invalid_signature' });
    }

    // 3. Timestamp validation — reject events older than 5 minutes to prevent replay attacks
    const eventCreatedAt = body.created_at || body.payload?.payment?.entity?.created_at;
    if (eventCreatedAt) {
      const eventTimeMs = typeof eventCreatedAt === 'number' ? eventCreatedAt * 1000 : Date.parse(eventCreatedAt);
      const now = Date.now();
      const maxAgeMs = 5 * 60 * 1000; // 5 minutes
      if (now - eventTimeMs > maxAgeMs) {
        logger.warn('Webhook event too old, possible replay attack', { eventId: body.event_id, eventCreatedAt });
        return res.status(401).json({ error: 'event_too_old' });
      }
    }

    // 4. Atomic idempotency check + log
    const eventId = body.event_id || body.id;
    if (!eventId) {
      return res.status(400).json({ error: 'missing_event_id' });
    }

    const { isDuplicate } = await logEventIfNotProcessed(eventId, body.event, null);
    if (isDuplicate) {
      logger.info('Duplicate webhook event, skipping', { eventId });
      return res.json({ received: true, duplicate: true });
    }

    // 4. Route to handler based on event type
    const eventType = body.event;
    const payload = body.payload;

    switch (eventType) {
      case 'subscription.activated': {
        const subscription = payload?.subscription?.entity;
        const planId = subscription?.plan_id;
        const aiEmployeePlanId = process.env.RAZORPAY_PLAN_AI_EMPLOYEE || 'plan_test_ai_employee';

        if (planId === aiEmployeePlanId) {
          // Extract tenant info from subscription notes
          const notes = subscription?.notes || {};
          const tenantId = notes.tenantId;
          const agencyOwnerId = notes.agencyOwnerId || notes.userId;
          const agencyName = notes.agencyName || '';
          const contactPhone = notes.contactPhone || '';
          const contactEmail = notes.contactEmail || '';

          if (tenantId) {
            try {
              await createProvisioningRow({
                tenantId,
                agencyOwnerId,
                agencyName,
                contactPhone,
                contactEmail,
                paidAt: new Date().toISOString(),
                planId,
                razorpaySubscriptionId: subscription.id,
              });

              // Email founder
              await sendBrevoEmail(
                process.env.BREVO_AI_EMPLOYEE_PAID_TEMPLATE_ID,
                process.env.FOUNDER_EMAIL || 'info@realestateflow.in',
                {
                  agencyName,
                  tenantId,
                  contactPhone,
                  contactEmail,
                  paidAt: new Date().toISOString(),
                }
              );

              // AiSensy broadcast
              if (contactPhone) {
                const phone = contactPhone.startsWith('+91') ? contactPhone : `+91${contactPhone}`;
                await sendAiSensyBroadcast('AI-Employee-Onboarding-Pending', agencyName, phone);
              }

              // PostHog
              await serverTrack(tenantId, 'ai_employee_provisioned', {
                tenantId,
                status: 'pending',
                planId,
                razorpaySubscriptionId: subscription.id,
              });
            } catch (err) {
              logger.error('AI Employee provisioning failed', { error: err.message, tenantId });
            }
          }
        }

        // Generic subscription_started for any plan
        await serverTrack(
          payload?.subscription?.entity?.notes?.tenantId || 'unknown',
          'subscription_started',
          { planId, subscriptionId: subscription?.id }
        );
        break;
      }

      case 'subscription.charged': {
        const subscription = payload?.subscription?.entity;
        const tenantId = subscription?.notes?.tenantId || 'unknown';
        await serverTrack(tenantId, 'subscription_invoiced', {
          subscriptionId: subscription?.id,
          planId: subscription?.plan_id,
        });
        await serverTrack(tenantId, 'subscription_paid', {
          subscriptionId: subscription?.id,
          amount: payload?.payment?.entity?.amount,
        });
        break;
      }

      case 'payment.captured': {
        const payment = payload?.payment?.entity;
        const tenantId = payment?.notes?.tenantId || 'unknown';
        await serverTrack(tenantId, 'razorpay_payment_succeeded', {
          paymentId: payment?.id,
          amount: payment?.amount,
          method: payment?.method,
        });
        break;
      }

      case 'payment.failed': {
        const payment = payload?.payment?.entity;
        const tenantId = payment?.notes?.tenantId || 'unknown';
        await serverTrack(tenantId, 'razorpay_payment_failed', {
          paymentId: payment?.id,
          amount: payment?.amount,
          errorCode: payment?.error_code,
          errorDescription: payment?.error_description,
        });
        break;
      }

      case 'subscription.cancelled': {
        const subscription = payload?.subscription?.entity;
        const tenantId = subscription?.notes?.tenantId || 'unknown';
        // Subscription table update will be done by PR-H subscriptionService
        await serverTrack(tenantId, 'subscription_cancelled', {
          subscriptionId: subscription?.id,
          planId: subscription?.plan_id,
        });
        break;
      }

      case 'subscription.updated': {
        const subscription = payload?.subscription?.entity;
        const tenantId = subscription?.notes?.tenantId;
        const newQuantity = subscription?.quantity;
        const previousQuantity = payload?.subscription?.previousQuantity;

        if (
          tenantId &&
          typeof newQuantity === 'number' &&
          typeof previousQuantity === 'number' &&
          newQuantity > previousQuantity
        ) {
          const seatsAdded = newQuantity - previousQuantity;
          await incrementSeatsPaid(tenantId, seatsAdded);
          await serverTrack(tenantId, 'seat_added', {
            seatsAdded,
            newTotal: newQuantity,
          });
        } else if (tenantId && (typeof newQuantity !== 'number' || typeof previousQuantity !== 'number')) {
          logger.warn('subscription.updated.invalid_quantities', {
            tenantId,
            newQuantity,
            previousQuantity,
          });
        }
        break;
      }

      default:
        logger.info('Unhandled webhook event type', { eventType });
    }

    res.json({ received: true });
  } catch (err) {
    logger.error('Webhook processing error', { error: err.message, stack: err.stack });
    // Return 500 so Razorpay retries; on retry the atomic idempotency check will return 200
    return res.status(500).json({ error: 'internal_processing_error' });
  }
});

export default router;
