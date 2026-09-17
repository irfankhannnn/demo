/**
 * hCaptcha verification.
 *
 * ── this one fails CLOSED ──────────────────────────────────────────────────
 * `agency-app/api/routes/grievance.js` returns `true` when no secret is configured, so
 * that flow stays testable locally. That is the wrong default here. This
 * endpoint creates leads that can trigger billable AI qualification calls, and
 * a captcha check that silently passes every token when a secret goes missing
 * is worse than no captcha at all — it looks protected in the code and in the
 * config, while accepting everything.
 *
 * So: when captcha is not configured at all, the caller is expected not to ask
 * for it (`captchaEnabled()` gates that, and `assertEnv` refuses the
 * half-configured state at boot). Once we are here, a missing secret, an
 * unreachable hCaptcha, or a timeout all mean "not verified".
 *
 * The cost of failing closed is that an hCaptcha outage blocks bookings from
 * visitors who have already tripped the adaptive threshold. Everyone else is
 * unaffected, because the captcha is only demanded after repeated failures.
 */

import { config } from '../config/env.js';
import { logger } from '../logger.js';

export async function verifyCaptcha(token, remoteIp) {
  if (!config.hcaptchaSecretKey) {
    logger.error('captcha.not_configured', {});
    return false;
  }
  if (typeof token !== 'string' || token.length === 0) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.hcaptchaVerifyTimeoutMs);

  try {
    const params = new URLSearchParams({ secret: config.hcaptchaSecretKey, response: token });
    if (remoteIp && remoteIp !== 'unknown') params.append('remoteip', remoteIp);

    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn('captcha.verify_non_ok', { status: response.status });
      return false;
    }

    const data = await response.json();
    if (data?.success !== true) {
      logger.info('captcha.rejected', { errors: data?.['error-codes'] || null });
      return false;
    }
    return true;
  } catch (err) {
    logger.error('captcha.verify_failed', { timedOut: err.name === 'AbortError', error: err.message });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
