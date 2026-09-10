/**
 * Environment configuration, validated once at cold start.
 *
 * `assertEnv()` runs at module load in lambda.js so a stack deployed with a
 * missing CRM key fails its first invocation with a readable message, rather
 * than serving 500s to real visitors on some later request.
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * Numeric env var with a default.
 *
 * `Number(v) || fallback` is the obvious way to write this and is wrong: 0 is
 * falsy, so setting a limit to 0 silently restores the default instead of
 * disabling it. Several values here (min fill time, cache seconds) treat 0 as
 * a meaningful setting, so the check has to be for "absent or unparseable",
 * not "falsy".
 */
function num(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 3005),
  region: process.env.AWS_REGION || 'ap-south-1',

  // ── CRM internal API ──────────────────────────────────────────────────
  crmInternalApiUrl: process.env.CRM_INTERNAL_API_URL || '',
  crmInternalApiKey: process.env.PUBLIC_PAGES_INTERNAL_API_KEY || '',
  crmTimeoutMs: num(process.env.CRM_TIMEOUT_MS, 6000),

  // ── Addressing ────────────────────────────────────────────────────────
  // Tenants are addressed by subdomain: <slug>.<baseDomain>. When the service
  // is reached on a bare CloudFront/API Gateway URL instead (before DNS is
  // wired), PATH_TENANT_FALLBACK lets /t/<slug>/... resolve the same tenant so
  // the whole flow stays testable without a custom domain.
  baseDomain: (process.env.PUBLIC_PAGES_BASE_DOMAIN || '').toLowerCase(),
  pathTenantFallback: process.env.PATH_TENANT_FALLBACK !== 'false',

  // ── Abuse controls ────────────────────────────────────────────────────
  guardTableName: process.env.GUARD_TABLE_NAME || '',
  sessionSecret: process.env.VISIT_SESSION_SECRET || '',
  sessionTtlSeconds: num(process.env.VISIT_SESSION_TTL_SECONDS, 1800),
  // A form completed faster than this was not typed by a person.
  minFillSeconds: num(process.env.VISIT_MIN_FILL_SECONDS, 3),

  limits: {
    // Burst is the "many sessions from one IP within a second" control.
    ipBurst: num(process.env.LIMIT_IP_BURST, 5),
    ipBurstWindowSeconds: num(process.env.LIMIT_IP_BURST_WINDOW_SECONDS, 10),
    ipHourly: num(process.env.LIMIT_IP_HOURLY, 40),
    // Bookings, not page views — deliberately much tighter.
    ipBookingsDaily: num(process.env.LIMIT_IP_BOOKINGS_DAILY, 6),
    phoneBookingsDaily: num(process.env.LIMIT_PHONE_BOOKINGS_DAILY, 3),
    // The backstop on AI-qualification spend: a tenant cannot be made to pay
    // for more than this many booking-driven leads in a day.
    tenantBookingsDaily: num(process.env.LIMIT_TENANT_BOOKINGS_DAILY, 200),
    // Failed attempts before a visitor must solve a captcha.
    captchaTriggerFailures: num(process.env.LIMIT_CAPTCHA_TRIGGER, 3),
  },

  // ── Captcha ───────────────────────────────────────────────────────────
  hcaptchaSiteKey: process.env.HCAPTCHA_SITE_KEY || '',
  hcaptchaSecretKey: process.env.HCAPTCHA_SECRET_KEY || '',
  hcaptchaVerifyTimeoutMs: num(process.env.HCAPTCHA_VERIFY_TIMEOUT_MS, 5000),

  // ── Presentation ──────────────────────────────────────────────────────
  mapsEmbedApiKey: process.env.GOOGLE_MAPS_EMBED_API_KEY || '',
  assetCacheSeconds: num(process.env.ASSET_CACHE_SECONDS, 300),
  pageCacheSeconds: num(process.env.PAGE_CACHE_SECONDS, 60),
};

/**
 * Values without which the service cannot serve a correct page. Anything
 * optional (maps key, captcha) degrades gracefully instead and is reported by
 * the health check rather than blocking a deploy.
 */
const REQUIRED = [
  ['CRM_INTERNAL_API_URL', config.crmInternalApiUrl],
  ['PUBLIC_PAGES_INTERNAL_API_KEY', config.crmInternalApiKey],
  ['GUARD_TABLE_NAME', config.guardTableName],
  ['VISIT_SESSION_SECRET', config.sessionSecret],
];

export function assertEnv() {
  const missing = REQUIRED.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`property-pages-ms is misconfigured. Missing: ${missing.join(', ')}`);
  }

  // A short secret is worse than a missing one: it looks configured while
  // making the session HMAC forgeable, so treat it as a hard failure.
  if (config.sessionSecret.length < 32) {
    throw new Error('VISIT_SESSION_SECRET must be at least 32 characters (openssl rand -hex 32)');
  }

  // Captcha is the one control that fails OPEN if half-configured, so refuse
  // the ambiguous state rather than silently accepting every token.
  if (Boolean(config.hcaptchaSiteKey) !== Boolean(config.hcaptchaSecretKey)) {
    throw new Error('HCAPTCHA_SITE_KEY and HCAPTCHA_SECRET_KEY must be set together, or neither');
  }
}

export function captchaEnabled() {
  return Boolean(config.hcaptchaSiteKey && config.hcaptchaSecretKey);
}
