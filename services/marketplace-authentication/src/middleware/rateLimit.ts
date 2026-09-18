import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { getConfig } from '../config/config';

/**
 * Per-IP limiters. Behind API Gateway the client IP is in the proxy event
 * (requestContext.identity.sourceIp), which src/index.ts stashes on
 * app.locals; locally it's req.ip. The store is in-memory, i.e. per Lambda
 * container — good enough as an abuse brake, not a hard global quota.
 */
function clientIp(req: Request): string {
  const event = (req.app as unknown as { locals?: { apiGatewayEvent?: { requestContext?: { identity?: { sourceIp?: string } } } } })
    .locals?.apiGatewayEvent;
  return event?.requestContext?.identity?.sourceIp || req.ip || 'unknown';
}

function build(max: number, windowMs: number, error: string, details: string) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientIp,
    // We supply our own key, so express-rate-limit's trust-proxy / IPv6
    // heuristics don't apply.
    validate: false,
    skip: () => getConfig().RATE_LIMIT_DISABLED,
    handler: (_req, res) => {
      res.status(429).json({ error, details });
    },
  });
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Contract §3: POST /auth/phone/start → 429 after 3 per 15 min. */
export const phoneStartLimiter = build(3, FIFTEEN_MINUTES, 'rate_limited', 'Too many OTP requests. Try again in 15 minutes.');

/** OTP guesses: Cognito already fails the session after 3 wrong answers; this caps session churn. */
export const phoneConfirmLimiter = build(10, FIFTEEN_MINUTES, 'rate_limited', 'Too many OTP attempts. Try again in 15 minutes.');

/** Token exchange / refresh. */
export const tokenLimiter = build(30, FIFTEEN_MINUTES, 'rate_limited', 'Too many token requests. Try again later.');

/** Account deletion is not something a client should hammer. */
export const deleteLimiter = build(5, FIFTEEN_MINUTES, 'rate_limited', 'Too many requests. Try again later.');
