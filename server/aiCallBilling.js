/**
 * Per-minute billing for completed AI phone calls.
 *
 * Pricing model: humans work for free, AI costs credits. Manual data entry is 0
 * (see creditConfig.js COSTS); an AI call costs `ai_call_per_minute` credits for
 * every started minute, charged once, after the call has settled.
 *
 * Two things make this trickier than a plain deduct:
 *
 * 1. **Double-billing.** Both the Exotel status webhook and the ElevenLabs
 *    post-call webhook write a `duration` onto the same call session, so
 *    call-outcome can legitimately arrive twice for one call. Every charge is
 *    therefore guarded by the same idempotency log the inbound webhooks use,
 *    keyed on callSessionId.
 *
 * 2. **The call already happened.** Billing runs after the fact, so it must never
 *    fail the CRM write that carries the call's outcome — losing a lead's
 *    qualification result to a billing error would be far worse than an
 *    uncharged call. Every failure path here is logged and swallowed; the
 *    balance guard that stops a tenant running up unbounded spend is the
 *    pre-call check `hasCreditForAiCall()` below, not this function.
 */

import { deductCredits, InsufficientCreditsError } from './creditService.js';
import { getCosts } from './creditConfig.js';
import { logEventIfNotProcessed } from './webhookLogService.js';
import { logger } from './logger.js';

const SECONDS_PER_MINUTE = 60;

/**
 * Credits for a given call length. Billed per *started* minute, so a 10-second
 * call costs one minute — the same way telecom billing works, and the reason a
 * duration of 0 must not be treated as "free minute" but as "nothing to bill".
 */
export function billableMinutes(durationSecs) {
  const secs = Number(durationSecs);
  if (!Number.isFinite(secs) || secs <= 0) return 0;
  return Math.ceil(secs / SECONDS_PER_MINUTE);
}

/**
 * Can this tenant afford to start an AI call?
 *
 * AI calls are billed per started minute once the call settles
 * (`chargeForAiCall` above). Because that charge happens after the fact, a
 * pre-call check is the only point at which a call the tenant cannot pay for
 * can be refused — so every route that dials must call this first.
 *
 * Deliberately fails *open*: if pricing or the balance can't be read we log and
 * allow the call. A credit-service blip should not block a tenant with a
 * healthy balance from working; the post-call charge still reconciles.
 *
 * @returns {Promise<{ok: boolean, balance?: number, required?: number}>}
 */
export async function hasCreditForAiCall(tenantId) {
  try {
    const costs = await getCosts();
    const perMinute = costs.ai_call_per_minute ?? 0;
    if (perMinute <= 0) return { ok: true };

    const { getBalance } = await import('./creditService.js');
    const balance = await getBalance(tenantId);
    if (balance < perMinute) {
      return { ok: false, balance, required: perMinute };
    }
    return { ok: true, balance, required: perMinute };
  } catch (error) {
    logger.warn('aiCallBilling.credit_precheck_failed', { tenantId, error: error.message });
    return { ok: true };
  }
}

/**
 * Charge a tenant for one completed AI call.
 *
 * @returns {Promise<{charged: boolean, reason?: string, credits?: number, minutes?: number, balance?: number}>}
 *   Never throws — see the note above about not failing the call-outcome write.
 */
export async function chargeForAiCall({ tenantId, callSessionId, durationSecs, leadId, callPurpose }) {
  try {
    if (!tenantId) return { charged: false, reason: 'missing_tenant' };

    const minutes = billableMinutes(durationSecs);
    if (minutes === 0) {
      // No answer, failed dial, or a status update that carried no duration.
      return { charged: false, reason: 'no_billable_duration' };
    }

    const costs = await getCosts();
    const perMinute = costs.ai_call_per_minute ?? 0;
    if (perMinute <= 0) {
      return { charged: false, reason: 'rate_zero' };
    }

    // Without a session id there is nothing stable to deduplicate on, and the
    // Exotel/ElevenLabs pair would double-charge. Skipping is the safe side to
    // err on: an uncharged call beats a double-charged one.
    if (!callSessionId) {
      logger.warn('aiCallBilling.skipped_no_session_id', { tenantId, leadId });
      return { charged: false, reason: 'missing_call_session_id' };
    }

    const idempotency = await logEventIfNotProcessed(
      `aicall-billing:${tenantId}:${callSessionId}`,
      'aicall.billing',
      null
    );
    if (idempotency.isDuplicate) {
      return { charged: false, reason: 'already_billed' };
    }

    const credits = minutes * perMinute;
    const result = await deductCredits(tenantId, credits, 'ai_call_per_minute', {
      callSessionId,
      leadId: leadId || null,
      callPurpose: callPurpose || null,
      durationSecs: Number(durationSecs),
      minutes,
      perMinute,
    });

    logger.info('aiCallBilling.charged', {
      tenantId, leadId, callSessionId, minutes, perMinute, credits, balance: result.balance,
    });
    return { charged: true, credits, minutes, balance: result.balance };
  } catch (err) {
    if (err instanceof InsufficientCreditsError || err.name === 'InsufficientCreditsError') {
      // The call is already over — we cannot un-place it. Record the shortfall
      // and move on; the pre-call check is what prevents this in the normal case.
      logger.warn('aiCallBilling.insufficient_credits', {
        tenantId, leadId, callSessionId, balance: err.balance, required: err.required,
      });
      return { charged: false, reason: 'insufficient_credits', balance: err.balance };
    }
    logger.error('aiCallBilling.failed', {
      tenantId, leadId, callSessionId, error: err.message,
    });
    return { charged: false, reason: 'error' };
  }
}
