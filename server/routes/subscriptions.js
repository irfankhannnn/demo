import express from 'express';
import { validateToken } from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { getSubscription, recomputeSeatsUsed } from '../subscriptionService.js';
import { logger } from '../logger.js';

const router = express.Router();

// GET /api/subscriptions/current — full subscription object
router.get('/current', validateToken, extractTenantId, async (req, res) => {
  try {
    const subscription = await getSubscription(req.tenantId);
    if (!subscription) {
      return res.status(404).json({ error: 'no_subscription', message: 'No subscription found for this tenant' });
    }
    res.json(subscription);
  } catch (err) {
    logger.error('subscriptions.current.error', { tenantId: req.tenantId, error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/subscriptions/trial-status — trial-specific fields
router.get('/trial-status', validateToken, extractTenantId, async (req, res) => {
  try {
    const subscription = await getSubscription(req.tenantId);
    if (!subscription) {
      return res.status(404).json({ error: 'no_subscription' });
    }

    const now = Date.now();
    const trialEndsAt = subscription.trialEndsAt ? new Date(subscription.trialEndsAt).getTime() : 0;
    const trialDaysLeft = Math.max(0, Math.ceil((trialEndsAt - now) / 86400000));
    const isTrialing = subscription.paymentStatus === 'trialing' && trialDaysLeft > 0;
    const isTrialExpired = subscription.paymentStatus === 'trialing' && trialDaysLeft === 0;

    res.json({
      trialDaysLeft,
      trialEndsAt: subscription.trialEndsAt,
      plan: subscription.plan,
      isPaying: subscription.isPaying,
      isTrialing,
      isTrialExpired,
      gracePeriodActive: subscription.gracePeriodActive,
      paymentStatus: subscription.paymentStatus,
    });
  } catch (err) {
    logger.error('subscriptions.trialStatus.error', { tenantId: req.tenantId, error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/subscriptions/check-seat — pre-invite seat availability check
router.post('/check-seat', validateToken, extractTenantId, async (req, res) => {
  try {
    const subscription = await getSubscription(req.tenantId);
    if (!subscription) {
      return res.status(404).json({ error: 'no_subscription' });
    }

    const seatsUsed = await recomputeSeatsUsed(req.tenantId);
    const canInvite = seatsUsed < subscription.seatsPaid;

    if (!canInvite) {
      // Fire PostHog event stub
      try {
        const { serverTrack } = await import('../lib/posthog.js');
        await serverTrack(req.tenantId, 'paywall_seat_limit_hit', {
          currentSeats: seatsUsed,
          paidSeats: subscription.seatsPaid,
          tier: subscription.plan,
        });
      } catch (_) { /* PostHog optional */ }

      return res.status(402).json({
        error: 'paywall_seat_limit',
        currentSeats: seatsUsed,
        paidSeats: subscription.seatsPaid,
        tier: subscription.plan,
        upgradeOptions: [
          subscription.plan === 'solo'
            ? { planId: 'plan_team_monthly', label: 'Upgrade to Team — ₹1,999/mo (3 seats)', price: 1999 }
            : { planId: 'plan_add_seat', label: 'Add 1 seat — ₹500/mo', price: 500 },
        ],
      });
    }

    res.json({ canInvite: true, seatsUsed, seatsPaid: subscription.seatsPaid, plan: subscription.plan });
  } catch (err) {
    logger.error('subscriptions.checkSeat.error', { tenantId: req.tenantId, error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
