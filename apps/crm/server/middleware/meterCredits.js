import { deductCredits, getBalance, InsufficientCreditsError } from '../creditService.js';
import { getCosts } from '../creditConfig.js';

/**
 * Pre-check credits before a mutating action (returns 402 early).
 */
export async function precheckCredits(tenantId, actionType) {
  const costs = await getCosts();
  const cost = costs[actionType] ?? 0;
  if (cost <= 0) return { cost: 0, balance: await getBalance(tenantId) };
  const balance = await getBalance(tenantId);
  if (balance < cost) throw new InsufficientCreditsError(balance, cost);
  return { cost, balance };
}

/**
 * Charge credits after a successful write.
 */
export async function chargeCreditsForAction(tenantId, actionType, meta = {}) {
  const costs = await getCosts();
  const cost = costs[actionType] ?? 0;
  if (cost <= 0) return { balance: await getBalance(tenantId), ledgerId: null };
  return deductCredits(tenantId, cost, actionType, meta);
}

export function handleCreditError(err, res) {
  if (err.name === 'InsufficientCreditsError') {
    return res.status(402).json({
      error: 'insufficient_credits',
      balance: err.balance,
      required: err.required,
      message: 'Out of credits. Buy more to continue.',
    });
  }
  return false;
}

/**
 * Declarative per-route credit metering middleware factory.
 * Place after validateToken + extractTenantId.
 */
export function meterCredits(actionType) {
  return async (req, res, next) => {
    try {
      const costs = await getCosts();
      const cost = costs[actionType] ?? 0;
      if (cost > 0) {
        const r = await deductCredits(req.tenantId, cost, actionType, {
          path: req.path,
          method: req.method,
          userId: req.user?.userId,
        });
        req.creditLedgerId = r.ledgerId;
        req.creditsRemaining = r.balance;
      }
      next();
    } catch (err) {
      if (err.name === 'InsufficientCreditsError') {
        return res.status(402).json({
          error: 'insufficient_credits',
          balance: err.balance,
          required: err.required,
          message: 'Out of credits. Buy more to continue.',
        });
      }
      next(err);
    }
  };
}

/**
 * Deduct credits after a successful write (use in route handlers).
 */
export async function deductAfterSuccess(tenantId, actionType, meta = {}) {
  const costs = await getCosts();
  const cost = costs[actionType] ?? 0;
  if (cost <= 0) return { balance: await import('../creditService.js').then(m => m.getBalance(tenantId)) };
  return deductCredits(tenantId, cost, actionType, meta);
}
