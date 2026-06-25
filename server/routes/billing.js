import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { createProvisioningRow, activateProvisioning, suspendProvisioning } from '../aiEmployeeProvisioningService.js';
import { updateAgencyConfig } from '../agencyConfigService.js';
import { logEventIfNotProcessed } from '../webhookLogService.js';
import { incrementSeatsPaid, decrementSeatsPaid, recomputeSeatsUsed } from '../subscriptionService.js';
import { logger } from '../logger.js';
import { sendEmail } from '../emailService.js';

const router = express.Router();

const TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;
const MAX_WEBHOOK_CREDIT_GRANT = 100000;

function getTenantIdFromNotes(notes = {}, context = {}) {
  const tenantId = notes.tenantId || notes.tenant_id;
  if (!tenantId || !TENANT_ID_PATTERN.test(String(tenantId))) {
    logger.error('billing.webhook.invalid_tenantId', {
      eventType: context.eventType,
      entityId: context.entityId,
      hasTenantId: Boolean(tenantId),
    });
    return null;
  }
  return String(tenantId);
}

function parseCreditAmount(value, context = {}) {
  const credits = Math.floor(Number(value));
  if (!Number.isFinite(credits) || credits <= 0 || credits > MAX_WEBHOOK_CREDIT_GRANT) {
    logger.error('billing.webhook.invalid_credit_amount', {
      eventType: context.eventType,
      entityId: context.entityId,
      credits: value,
      max: MAX_WEBHOOK_CREDIT_GRANT,
    });
    return null;
  }
  return credits;
}

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
 * Send transactional email via emailService (SES primary, Brevo fallback).
 */
async function sendBrevoEmail(templateId, to, params) {
  if (!to) {
    logger.warn('Email skipped — missing recipient', { templateId });
    return;
  }
  try {
    await sendEmail({
      to,
      subject: 'RealEstateFlow Notification',
      brevoTemplateId: templateId,
      params,
    });
  } catch (err) {
    logger.error('Email failed (non-fatal)', { error: err.message, to });
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

    // Constant-time compare to avoid leaking the signature via timing.
    const sigBuf = Buffer.from(String(signature || ''), 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    const signatureValid =
      sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);

    if (!signatureValid) {
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

    // 4. Validate webhook payload structure before idempotency check
    if (!body.event || typeof body.event !== 'string') {
      logger.error('webhook.invalid_event_type', { body });
      return res.status(400).json({ error: 'invalid_event_type' });
    }

    if (!body.payload || typeof body.payload !== 'object') {
      logger.error('webhook.invalid_payload', { body });
      return res.status(400).json({ error: 'invalid_payload' });
    }

    // 5. Atomic idempotency check + log
    const eventId = body.event_id || body.id;
    if (!eventId) {
      return res.status(400).json({ error: 'missing_event_id' });
    }

    const { isDuplicate } = await logEventIfNotProcessed(eventId, body.event, null);
    if (isDuplicate) {
      logger.info('Duplicate webhook event, skipping', { eventId });
      return res.json({ received: true, duplicate: true });
    }

    // 6. Route to handler based on event type
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
          const tenantId = getTenantIdFromNotes(notes, { eventType, entityId: subscription?.id });
          const agencyOwnerId = notes.agencyOwnerId || notes.userId;
          const agencyName = notes.agencyName || '';
          const contactPhone = notes.contactPhone || '';
          const contactEmail = notes.contactEmail || '';

          // Validate required fields
          if (!tenantId) {
            logger.error('subscription.activated.missing_tenantId', {
              subscriptionId: subscription?.id,
              notes,
            });
            break;
          }

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

              // Auto-activate: set status='live' and enable AI Employee for the tenant
              try {
                await activateProvisioning(tenantId, subscription.id, null);
                await updateAgencyConfig(tenantId, { aiEmployeeEnabled: true });
                logger.info('AI Employee auto-activated', { tenantId, planId });
              } catch (activationErr) {
                logger.error('AI Employee auto-activation failed (non-fatal)', { error: activationErr.message, tenantId });
              }

              // PostHog
              await serverTrack(tenantId, 'ai_employee_provisioned', {
                tenantId,
                status: 'live',
                planId,
                razorpaySubscriptionId: subscription.id,
              });
            } catch (err) {
              logger.error('AI Employee provisioning failed', { error: err.message, tenantId });
            }
          }
        }

        // Store billing anniversary day for accurate monthly credit reset
        const activatedTenantId = getTenantIdFromNotes(subscription?.notes, { eventType, entityId: subscription?.id });
        if (activatedTenantId && subscription?.start_at) {
          const anniversaryDay = new Date(subscription.start_at * 1000).getUTCDate();
          const { setBillingAnniversaryDay } = await import('../subscriptionService.js');
          await setBillingAnniversaryDay(activatedTenantId, anniversaryDay).catch(err =>
            logger.warn('subscription.anniversaryDay.save_failed', { error: err.message, activatedTenantId })
          );
        }

        // Generic subscription_started for any plan
        await serverTrack(
          getTenantIdFromNotes(subscription?.notes, { eventType, entityId: subscription?.id }) || 'unknown',
          'subscription_started',
          { planId, subscriptionId: subscription?.id }
        );
        break;
      }

      case 'subscription.charged': {
        const subscription = payload?.subscription?.entity;
        const tenantId = getTenantIdFromNotes(subscription?.notes, { eventType, entityId: subscription?.id }) || 'unknown';
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
        const tenantId = getTenantIdFromNotes(payment?.notes, { eventType, entityId: payment?.id }) || 'unknown';
        await serverTrack(tenantId, 'razorpay_payment_succeeded', {
          paymentId: payment?.id,
          amount: payment?.amount,
          method: payment?.method,
        });

        // Grant credits on one-time credit pack purchase
        if (payment?.notes?.credits && tenantId !== 'unknown') {
          try {
            const paymentId = payment.id;
            const creditEventId = `credit_grant:${paymentId}`;
            const { isDuplicate } = await logEventIfNotProcessed(creditEventId, 'credit.grant', tenantId);
            if (!isDuplicate) {
              const { grantCredits } = await import('../creditService.js');
              const credits = parseCreditAmount(payment.notes.credits, { eventType, entityId: paymentId });
              if (!credits) break;
              await grantCredits(tenantId, credits, 'purchase', {
                razorpayPaymentId: paymentId,
                razorpayOrderId: payment.order_id,
                amountPaise: payment.amount,
              });
              logger.info('credits.purchase.granted', { tenantId, credits, paymentId });
            }
          } catch (creditErr) {
            logger.error('credits.purchase.grant_failed', { error: creditErr.message, tenantId });
          }
        }

        // Auto-enable AI Employee if this is an AI Employee plan purchase
        // Note: subscription.activated handles subscription-based AI Employee activation
        // This handler handles one-time credit purchases that include AI Employee as an add-on
        const planId = body.payload?.payment?.entity?.notes?.plan_id
          || body.payload?.subscription?.entity?.plan_id
          || '';
        const planName = body.payload?.payment?.entity?.notes?.plan_name
          || body.payload?.subscription?.entity?.notes?.plan_name
          || '';
        const isAiEmployeePlan = planId.includes('ai_employee') || planId.includes('ai-employee')
          || planName.toLowerCase().includes('ai employee')
          || planName.toLowerCase().includes('ai-employee');

        if (isAiEmployeePlan) {
          const aiTenantId = getTenantIdFromNotes(
            body.payload?.payment?.entity?.notes || body.payload?.subscription?.entity?.notes,
            { eventType, entityId: body.payload?.payment?.entity?.id || body.payload?.subscription?.entity?.id }
          );
          const subscriptionId = body.payload?.subscription?.entity?.id || '';
          const orderId = body.payload?.payment?.entity?.order_id || '';

          if (aiTenantId) {
            try {
              await activateProvisioning(aiTenantId, subscriptionId, orderId);
              await updateAgencyConfig(aiTenantId, { aiEmployeeEnabled: true });
              logger.info('billing.ai_employee.activated', { tenantId: aiTenantId, subscriptionId, orderId });
            } catch (provErr) {
              logger.error('billing.ai_employee.activation.failed', { tenantId: aiTenantId, error: provErr.message });
            }
          }
        }
        break;
      }

      case 'payment.failed': {
        const payment = payload?.payment?.entity;
        const tenantId = getTenantIdFromNotes(payment?.notes, { eventType, entityId: payment?.id }) || 'unknown';
        await serverTrack(tenantId, 'razorpay_payment_failed', {
          paymentId: payment?.id,
          amount: payment?.amount,
          errorCode: payment?.error_code,
          errorDescription: payment?.error_description,
        });

        // Activate 7-day grace period for paying subscribers
        if (tenantId !== 'unknown') {
          try {
            const { getSubscription, updateSubscriptionStatus } = await import('../subscriptionService.js');
            const sub = await getSubscription(tenantId);
            if (sub?.isPaying && !sub.gracePeriodActive) {
              const gracePeriodDays = Number(process.env.GRACE_PERIOD_DAYS) || 7;
              const gracePeriodEndsAt = new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000).toISOString();
              await updateSubscriptionStatus(tenantId, {
                gracePeriodActive: true,
                gracePeriodEndsAt,
              });
              logger.warn('subscription.grace_period.activated', { tenantId, gracePeriodEndsAt });

              // Notify founder via Brevo
              const { sendEmail } = await import('../emailService.js');
              await sendEmail({
                to: process.env.FOUNDER_NOTIFICATION_EMAIL || 'info@realestateflow.in',
                subject: 'Payment Failed - Grace Period Activated',
                html: `<p>Payment failed for tenant ${tenantId}. Grace period activated until ${gracePeriodEndsAt}.</p><p>Payment ID: ${payment?.id}</p>`,
                brevoTemplateId: process.env.BREVO_PAYMENT_FAILED_TEMPLATE_ID || '4',
                params: { tenantId, gracePeriodEndsAt, paymentId: payment?.id }
              }).catch(err => logger.error('grace_period.email.failed', { error: err.message }));
            }
          } catch (graceErr) {
            logger.error('subscription.grace_period.activation_failed', { tenantId, error: graceErr.message });
          }
        }
        break;
      }

      case 'payment.refunded':
      case 'payment.reversed': {
        const payment = payload?.payment?.entity;
        const tenantId = getTenantIdFromNotes(payment?.notes, { eventType, entityId: payment?.id }) || 'unknown';
        const credits = payment?.notes?.credits
          ? parseCreditAmount(payment.notes.credits, { eventType, entityId: payment?.id }) || 0
          : 0;

        await serverTrack(tenantId, 'razorpay_payment_refunded', {
          paymentId: payment?.id,
          amount: payment?.amount,
          credits,
          eventType,
        });

        // Deduct credits if they were granted for this payment
        if (tenantId !== 'unknown' && credits > 0) {
          try {
            const { deductCredits } = await import('../creditService.js');
            await deductCredits(tenantId, credits, 'refund', {
              paymentId: payment?.id,
              reason: 'payment_refunded',
            });
            logger.info('credits.deducted_on_refund', { tenantId, credits, paymentId: payment?.id });
          } catch (deductErr) {
            logger.error('credits.deduct_on_refund.failed', { tenantId, credits, error: deductErr.message });
          }
        }

        // Suspend subscription if this was a subscription payment
        if (tenantId !== 'unknown') {
          try {
            const { updateSubscriptionStatus } = await import('../subscriptionService.js');
            await updateSubscriptionStatus(tenantId, {
              paymentStatus: eventType === 'payment.refunded' ? 'refunded' : 'reversed',
              isPaying: false,
              refundedAt: new Date().toISOString(),
            });
            logger.info('subscription.suspended_on_refund', { tenantId, eventType });
          } catch (subErr) {
            logger.error('subscription.suspend_on_refund.failed', { tenantId, error: subErr.message });
          }
        }
        break;
      }

      case 'payment.disputed':
      case 'payment.chargeback': {
        const payment = payload?.payment?.entity;
        const tenantId = getTenantIdFromNotes(payment?.notes, { eventType, entityId: payment?.id }) || 'unknown';
        const credits = payment?.notes?.credits
          ? parseCreditAmount(payment.notes.credits, { eventType, entityId: payment?.id }) || 0
          : 0;

        await serverTrack(tenantId, 'razorpay_payment_disputed', {
          paymentId: payment?.id,
          amount: payment?.amount,
          credits,
          eventType,
        });

        // Immediately suspend subscription and deduct credits
        if (tenantId !== 'unknown') {
          try {
            const { updateSubscriptionStatus, decrementSeatsPaid } = await import('../subscriptionService.js');
            const { deductCredits } = await import('../creditService.js');

            // Suspend subscription
            await updateSubscriptionStatus(tenantId, {
              paymentStatus: 'chargeback',
              isPaying: false,
              chargebackAt: new Date().toISOString(),
            });

            // Deduct credits if they were granted
            if (credits > 0) {
              await deductCredits(tenantId, credits, 'chargeback_reversal', {
                paymentId: payment?.id,
                reason: 'payment_disputed',
              });
            }

            // Notify founder of chargeback
            const { sendEmail } = await import('../emailService.js');
            await sendEmail({
              to: process.env.FOUNDER_NOTIFICATION_EMAIL || 'info@realestateflow.in',
              subject: `Payment ${eventType} - ${tenantId}`,
              html: `<p>Payment ${eventType} for tenant ${tenantId}. Payment ID: ${payment?.id}, Amount: ${payment?.amount}</p>`,
            }).catch(err => logger.error('chargeback.notification.failed', { error: err.message }));

            logger.warn('subscription.chargeback_processed', { tenantId, eventType, paymentId: payment?.id });
          } catch (chargebackErr) {
            logger.error('subscription.chargeback.failed', { tenantId, error: chargebackErr.message });
          }
        }
        break;
      }

      case 'subscription.cancelled':
      case 'subscription.halted': {
        const subscription = payload?.subscription?.entity;
        const tenantId = getTenantIdFromNotes(subscription?.notes, { eventType, entityId: subscription?.id }) || 'unknown';
        const planId = subscription?.plan_id;
        const aiEmployeePlanId = process.env.RAZORPAY_PLAN_AI_EMPLOYEE || 'plan_test_ai_employee';

        // Validate tenantId
        if (tenantId === 'unknown') {
          logger.error('subscription.cancelled.missing_tenantId', {
            subscriptionId: subscription?.id,
            notes: subscription?.notes,
          });
          break;
        }

        if (tenantId !== 'unknown' && planId === aiEmployeePlanId) {
          try {
            await suspendProvisioning(tenantId, eventType);
            await updateAgencyConfig(tenantId, { aiEmployeeEnabled: false });
            logger.info('AI Employee suspended on subscription cancellation', { tenantId, event: eventType });
          } catch (suspendErr) {
            logger.error('AI Employee suspension failed (non-fatal)', { tenantId, error: suspendErr.message });
          }
        }

        // Update Subscriptions table — mark as cancelled/halted
        try {
          const { updateSubscriptionStatus } = await import('../subscriptionService.js');
          await updateSubscriptionStatus(tenantId, {
            isPaying: false,
            paymentStatus: eventType === 'subscription.cancelled' ? 'cancelled' : 'halted',
            cancelledAt: new Date().toISOString(),
            razorpaySubscriptionId: subscription?.id || null,
          });
          logger.info('subscription.cancelled.table_updated', { tenantId, eventType });
        } catch (subUpdateErr) {
          logger.error('subscription.cancelled.table_update_failed', {
            tenantId,
            error: subUpdateErr.message,
          });
        }

        await serverTrack(tenantId, 'subscription_cancelled', {
          subscriptionId: subscription?.id,
          planId,
        });
        break;
      }

      case 'subscription.updated': {
        const subscription = payload?.subscription?.entity;
        const tenantId = getTenantIdFromNotes(subscription?.notes, { eventType, entityId: subscription?.id });
        const newQuantity = subscription?.quantity;
        const previousQuantity = payload?.subscription?.previousQuantity;

        if (
          tenantId &&
          typeof newQuantity === 'number' &&
          typeof previousQuantity === 'number'
        ) {
          if (newQuantity > previousQuantity) {
            // Seat upgrade
            const seatsAdded = newQuantity - previousQuantity;
            await incrementSeatsPaid(tenantId, seatsAdded);
            await serverTrack(tenantId, 'seat_added', {
              seatsAdded,
              newTotal: newQuantity,
            });
          } else if (newQuantity < previousQuantity) {
            // Seat downgrade — reduce paid seats
            const seatsRemoved = previousQuantity - newQuantity;
            
            // Validate that current seat usage doesn't exceed new limit
            const currentSeatsUsed = await recomputeSeatsUsed(tenantId);
            
            if (currentSeatsUsed > newQuantity) {
              logger.warn('subscription.updated.downgrade_blocked', {
                tenantId,
                currentSeatsUsed,
                newQuantity,
                previousQuantity,
                reason: 'more users than new seat limit',
              });
              // Don't allow downgrade - log and skip
              // Could also return error to Razorpay, but that might cause payment issues
              // For now, we'll log and allow the webhook to succeed without updating seats
            } else {
              try {
                await decrementSeatsPaid(tenantId, seatsRemoved);
                await serverTrack(tenantId, 'seat_removed', {
                  seatsRemoved,
                  newTotal: newQuantity,
                });
                logger.info('subscription.updated.seats_downgraded', { tenantId, seatsRemoved, newTotal: newQuantity });
              } catch (downgradeErr) {
                // decrementSeatsPaid throws if seatsPaid < seatsRemoved (ConditionExpression fails)
                logger.error('subscription.updated.downgrade.failed', {
                  tenantId,
                  seatsRemoved,
                  error: downgradeErr.message,
                });
              }
            }
          }
          // newQuantity === previousQuantity: no change, no-op
        } else if (tenantId && (typeof newQuantity !== 'number' || typeof previousQuantity !== 'number')) {
          logger.warn('subscription.updated.invalid_quantities', {
            tenantId,
            newQuantity,
            previousQuantity,
          });
        }
        break;
      }

      case 'subscription.paused': {
        const subscription = payload?.subscription?.entity;
        const tenantId = getTenantIdFromNotes(subscription?.notes, { eventType, entityId: subscription?.id }) || 'unknown';
        if (tenantId !== 'unknown') {
          try {
            const { updateSubscriptionStatus } = await import('../subscriptionService.js');
            await updateSubscriptionStatus(tenantId, {
              paymentStatus: 'paused',
              pausedAt: new Date().toISOString(),
            });
            logger.info('subscription.paused', { tenantId });
          } catch (err) {
            logger.error('subscription.paused.update_failed', { tenantId, error: err.message });
          }
        }
        await serverTrack(tenantId, 'subscription_paused', { subscriptionId: subscription?.id });
        break;
      }

      case 'subscription.resumed': {
        const subscription = payload?.subscription?.entity;
        const tenantId = getTenantIdFromNotes(subscription?.notes, { eventType, entityId: subscription?.id }) || 'unknown';
        if (tenantId !== 'unknown') {
          try {
            const { updateSubscriptionStatus } = await import('../subscriptionService.js');
            await updateSubscriptionStatus(tenantId, {
              paymentStatus: 'active',
              isPaying: true,
              resumedAt: new Date().toISOString(),
            });
            logger.info('subscription.resumed', { tenantId });
          } catch (err) {
            logger.error('subscription.resumed.update_failed', { tenantId, error: err.message });
          }
        }
        await serverTrack(tenantId, 'subscription_resumed', { subscriptionId: subscription?.id });
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
