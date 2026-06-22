import express from 'express';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireRole } from '../middleware/requireRole.js';
import { getSubscription, recomputeSeatsUsed, createTrialSubscription } from '../subscriptionService.js';
import { getBalance, getLedger, grantCredits, initializeTenantCredits } from '../creditService.js';
import { getCosts, getPacks, getFreeTier } from '../creditConfig.js';
import { createOrder } from '../razorpayOrders.js';
import { precheckCredits, chargeCreditsForAction, handleCreditError } from '../middleware/meterCredits.js';
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
    let subscription = await getSubscription(req.tenantId);
    
    // Auto-create trial subscription if it doesn't exist
    if (!subscription) {
      try {
        subscription = await createTrialSubscription(req.tenantId, 'solo');
        logger.info('subscriptions.trialStatus.autoCreated', { tenantId: req.tenantId });
        const freeTier = await getFreeTier();
        await initializeTenantCredits(req.tenantId, freeTier.monthlyFreeCredits);
      } catch (createErr) {
        // If creation fails (e.g., already exists from concurrent request), try fetching again
        subscription = await getSubscription(req.tenantId);
        if (!subscription) {
          logger.error('subscriptions.trialStatus.autoCreate.failed', { tenantId: req.tenantId, error: createErr.message });
          return res.status(500).json({ error: 'internal_error' });
        }
      }
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

// GET /api/subscriptions/credits — balance + costs + packs
router.get('/credits', validateToken, extractTenantId, async (req, res) => {
  try {
    const [balance, costs, packs, freeTier] = await Promise.all([
      getBalance(req.tenantId),
      getCosts(),
      getPacks(),
      getFreeTier(),
    ]);
    const subscription = await getSubscription(req.tenantId);
    res.json({
      balance,
      costs,
      packs,
      freeTier,
      resetDate: subscription?.lastCreditResetAt || null,
      monthlyAllotment: freeTier.monthlyFreeCredits,
    });
  } catch (err) {
    logger.error('subscriptions.credits.error', { tenantId: req.tenantId, error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/subscriptions/credits/ledger
router.get('/credits/ledger', validateToken, extractTenantId, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const startKey = req.query.startKey ? JSON.parse(req.query.startKey) : undefined;
    const result = await getLedger(req.tenantId, { limit, startKey });
    res.json(result);
  } catch (err) {
    logger.error('subscriptions.ledger.error', { tenantId: req.tenantId, error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/subscriptions/credits/purchase — Razorpay Order for credit pack
router.post('/credits/purchase', validateToken, extractTenantId, requireRole('ADMIN', 'FOUNDER', 'OWNER'), async (req, res) => {
  try {
    const { packId, credits: creditsRequested } = req.body;
    const packs = await getPacks();
    const creditPacks = packs.creditPacks || {};

    let credits;
    let amountInr;

    if (packId && creditPacks[packId]) {
      credits = creditPacks[packId].credits;
      amountInr = creditPacks[packId].priceInr;
    } else if (creditsRequested) {
      credits = Math.floor(Number(creditsRequested));
      amountInr = Math.ceil(credits * (packs.overagePricePerCredit || 0.10));
    } else {
      return res.status(400).json({ error: 'packId or credits required' });
    }

    if (!credits || credits <= 0) {
      return res.status(400).json({ error: 'Invalid credit amount' });
    }

    const MAX_CREDIT_PURCHASE = 100000; // 100k credits max per purchase
    if (credits > MAX_CREDIT_PURCHASE) {
      return res.status(400).json({
        error: 'invalid_credit_amount',
        message: `Maximum ${MAX_CREDIT_PURCHASE} credits per purchase`,
        max: MAX_CREDIT_PURCHASE,
      });
    }

    const receipt = `credits_${req.tenantId}_${Date.now()}`;
    const order = await createOrder({
      amount: amountInr,
      receipt,
      notes: {
        tenantId: req.tenantId,
        credits: String(credits),
        type: 'credit_purchase',
      },
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      credits,
      currency: order.currency,
    });
  } catch (err) {
    logger.error('subscriptions.credits.purchase.error', { tenantId: req.tenantId, error: err.message });
    res.status(500).json({ error: err.message || 'internal_error' });
  }
});

export default router;
