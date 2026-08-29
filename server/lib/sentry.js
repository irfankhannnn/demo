/**
 * Sentry server-side wrapper for the Lambda/Express backend.
 *
 * Init is **env-guarded**: nothing is loaded unless `SENTRY_DSN_SERVER` is set,
 * so local/dev and unconfigured environments are unaffected. All calls are
 * wrapped in try/catch and dynamic imports so a missing dependency or transient
 * Sentry error can never break the request path.
 *
 * Wires ZEE-003-T6 / BUG-010 — server Lambda error tracking (was CRM-only).
 */
import { logger } from '../logger.js';

let sentryClient = null;
let initialized = false;

async function getSentry() {
  if (initialized) return sentryClient;
  initialized = true;

  if (!process.env.SENTRY_DSN_SERVER) return null;

  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN_SERVER,
      environment: process.env.SENTRY_ENV || process.env.NODE_ENV || 'production',
      release: process.env.SENTRY_RELEASE,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    });
    sentryClient = Sentry;
    logger.info('sentry.initialized', { environment: process.env.SENTRY_ENV || process.env.NODE_ENV });
  } catch (err) {
    logger.warn('sentry.init_failed', { error: err.message });
    sentryClient = null;
  }
  return sentryClient;
}

export async function captureServerException(error, context = {}) {
  try {
    const Sentry = await getSentry();
    if (!Sentry) return;
    Sentry.captureException(error, { extra: context });
  } catch (err) {
    logger.warn('sentry.capture_failed', { error: err.message });
  }
}

export async function flushSentry(timeoutMs = 2000) {
  try {
    if (!sentryClient) return;
    await sentryClient.flush(timeoutMs);
  } catch {
    /* best-effort flush before Lambda freeze */
  }
}
