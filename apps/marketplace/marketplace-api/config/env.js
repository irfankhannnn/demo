/**
 * Environment configuration, validated once at cold start.
 *
 * `assertEnv()` runs at module load in lambda.js so a stack deployed with a
 * missing CRM key or user pool fails its first invocation with a readable
 * message, rather than serving 500s to real buyers on some later request.
 *
 * Mirrors apps/property-pages-ms/config/env.js. The differences are the
 * extra concerns this service has and pages does not: a consumer identity
 * (Cognito JWT), two inbound caller keys (CRM and the auth service), an LLM
 * provider, an email sender, and a browser origin for CORS.
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * Numeric env var with a default.
 *
 * `Number(v) || fallback` is the obvious way to write this and is wrong: 0 is
 * falsy, so setting a limit to 0 silently restores the default instead of
 * disabling it. Several values here (cache seconds, limits) treat 0 as a
 * meaningful setting, so the check has to be for "absent or unparseable",
 * not "falsy".
 */
export function num(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Compose a service base URL from an API Gateway custom domain + base path.
 *
 * Every API in this repo is reached through a custom domain plus a
 * single-segment base path mapping. Raw execute-api invoke URLs are refused
 * outright: they bypass the mapping, differ per stack rebuild, and are what
 * leaked into env files before.
 *
 * `domainName` may carry a scheme only for local development
 * (e.g. http://localhost:3001); otherwise https:// is assumed.
 */
export function buildServiceBaseUrl(domainName, basePath, domainVar = 'domainName') {
  const domain = String(domainName ?? '').trim();
  if (!domain) {
    throw new Error(`${domainVar} is required`);
  }
  const origin = (domain.includes('://') ? domain : `https://${domain}`).replace(/\/+$/, '');
  if (/execute-api\.|\.amazonaws\.com/i.test(origin)) {
    throw new Error(`${domainVar}: raw API Gateway URLs are not allowed; use the custom domain`);
  }
  const bp = String(basePath ?? '').trim().replace(/^\/+|\/+$/g, '');
  return bp ? `${origin}/${bp}` : origin;
}

/** Route prefix of the CRM's internal marketplace API. Lives in code, never in env. */
export const CRM_MARKETPLACE_PATH = '/api/internal/marketplace';

/**
 * Resolved once at load. A bad value is recorded rather than thrown here so
 * that assertEnv() reports it alongside every other missing setting, with the
 * env var named.
 */
let crmInternalApiUrl = '';
let crmInternalApiUrlError = null;
try {
  crmInternalApiUrl = `${buildServiceBaseUrl(
    process.env.CRM_INTERNAL_API_DOMAIN_NAME,
    process.env.CRM_INTERNAL_API_BASE_PATH,
    'CRM_INTERNAL_API_DOMAIN_NAME',
  )}${CRM_MARKETPLACE_PATH}`;
} catch (err) {
  crmInternalApiUrlError = err.message;
}

/** Comma-separated origins, trimmed, trailing slashes dropped, empties removed. */
function originList(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

const DEFAULT_BEDROCK_MODEL_ID = 'anthropic.claude-haiku-4-5-20251001-v1:0';

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 3006),
  region: process.env.AWS_REGION || 'ap-south-1',
  version: process.env.SERVICE_VERSION || process.env.npm_package_version || '1.0.0',

  // ── CRM internal API ──────────────────────────────────────────────────
  // https://<CRM_INTERNAL_API_DOMAIN_NAME>/<CRM_INTERNAL_API_BASE_PATH>/api/internal/marketplace
  crmInternalApiUrl,
  crmInternalApiKey: process.env.MARKETPLACE_INTERNAL_API_KEY || '',
  crmTimeoutMs: num(process.env.CRM_TIMEOUT_MS, 12000),

  // ── Inbound service callers (/internal/*) ─────────────────────────────
  // Two keys, one per caller, so rotating or revoking one does not touch the
  // other. Both are accepted on every /internal route.
  callerKeys: {
    crm: process.env.CRM_CALLER_API_KEY || '',
    auth: process.env.AUTH_CALLER_API_KEY || '',
  },

  // ── Consumer identity ─────────────────────────────────────────────────
  cognito: {
    userPoolId: process.env.COGNITO_USER_POOL_ID || '',
    region: process.env.COGNITO_REGION || process.env.AWS_REGION || 'ap-south-1',
    // Optional. When set, the token's client_id (access) / aud (id) must match.
    clientId: process.env.COGNITO_CLIENT_ID || '',
    jwksCacheMs: num(process.env.COGNITO_JWKS_CACHE_MS, 600000),
  },

  // ── LLM ───────────────────────────────────────────────────────────────
  model: {
    provider: (process.env.MODEL_PROVIDER || 'gemini').toLowerCase(),
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    bedrockModelId: process.env.BEDROCK_MODEL_ID || DEFAULT_BEDROCK_MODEL_ID,
    timeoutMs: num(process.env.MODEL_TIMEOUT_MS, 8000),
  },

  // ── Browser origin ────────────────────────────────────────────────────
  // Where marketplace-web is served from. Drives CORS and the share-page
  // redirect. A placeholder until the domain is chosen; when empty, CORS
  // reflects any origin in development only and is closed in production.
  webOrigin: originList(process.env.MARKETPLACE_WEB_ORIGIN)[0] || '',
  webOrigins: originList(process.env.MARKETPLACE_WEB_ORIGIN),

  // ── This API's own mapping (used by lambda.js to strip the base path) ─
  apiBasePath: process.env.MARKETPLACE_API_BASE_PATH || '',

  // ── Email ─────────────────────────────────────────────────────────────
  // Buyer notification on an agency reply. Empty disables email entirely.
  sesFromEmail: process.env.SES_FROM_EMAIL || '',

  // ── Storage ───────────────────────────────────────────────────────────
  // One single-table store for everything this service owns: profiles,
  // saved listings, searches, threads, messages — and the abuse-guard
  // counters, which live in the same table under GUARD# keys.
  tableName: process.env.MARKETPLACE_TABLE_NAME || '',
  guardTableName: process.env.MARKETPLACE_TABLE_NAME || '',

  // ── Abuse controls ────────────────────────────────────────────────────
  // Optional salt for hashing phone numbers into guard keys. Not a session
  // secret in the pages sense (there is no form token here — the JWT is the
  // session); kept under the same name so the guard module reads the same
  // config shape in both services.
  sessionSecret: process.env.MARKETPLACE_SESSION_SECRET || '',
  sessionTtlSeconds: num(process.env.SESSION_TTL_SECONDS, 1800),
  minFillSeconds: num(process.env.MIN_FILL_SECONDS, 0),

  limits: {
    ipBurst: num(process.env.LIMIT_IP_BURST, 20),
    ipBurstWindowSeconds: num(process.env.LIMIT_IP_BURST_WINDOW_SECONDS, 10),
    ipHourly: num(process.env.LIMIT_IP_HOURLY, 600),
    // Site-visit bookings — a lead + a calendar slot in the agency's CRM.
    ipBookingsDaily: num(process.env.LIMIT_IP_BOOKINGS_DAILY, 6),
    phoneBookingsDaily: num(process.env.LIMIT_PHONE_BOOKINGS_DAILY, 3),
    // The backstop on AI-qualification spend: a tenant cannot be made to pay
    // for more than this many booking-driven leads in a day.
    tenantBookingsDaily: num(process.env.LIMIT_TENANT_BOOKINGS_DAILY, 200),
    captchaTriggerFailures: num(process.env.LIMIT_CAPTCHA_TRIGGER, 3),
    // AI search costs a model call per request; anonymous callers get less.
    aiSearchAnonHourly: num(process.env.LIMIT_AI_SEARCH_ANON_HOURLY, 20),
    aiSearchUserHourly: num(process.env.LIMIT_AI_SEARCH_USER_HOURLY, 60),
    // Buyer-initiated writes (messages, pings, saves) per user per hour.
    buyerWritesHourly: num(process.env.LIMIT_BUYER_WRITES_HOURLY, 120),
  },

  // ── Captcha (reserved; same pairing rule as pages) ────────────────────
  hcaptchaSiteKey: process.env.HCAPTCHA_SITE_KEY || '',
  hcaptchaSecretKey: process.env.HCAPTCHA_SECRET_KEY || '',

  // ── Caching ───────────────────────────────────────────────────────────
  // In-process TTL for CRM reads. Short on purpose: an agency editing a
  // listing sees the marketplace catch up within a minute.
  listingCacheSeconds: num(process.env.LISTING_CACHE_SECONDS, 60),
  citiesCacheSeconds: num(process.env.CITIES_CACHE_SECONDS, 300),
  // Edge cache for asset redirects. MUST stay well under the 900 s presigned
  // URL lifetime, or a cached redirect outlives its signature.
  assetCacheSeconds: num(process.env.ASSET_CACHE_SECONDS, 300),
  publicCacheSeconds: num(process.env.PUBLIC_CACHE_SECONDS, 60),
};

/**
 * Values without which the service cannot answer a correct request. Anything
 * optional (model key, SES sender, web origin) degrades gracefully instead and
 * is reported by /health/deep rather than blocking a deploy.
 */
const REQUIRED = [
  ['MARKETPLACE_TABLE_NAME', config.tableName],
  ['MARKETPLACE_INTERNAL_API_KEY', config.crmInternalApiKey],
  ['CRM_CALLER_API_KEY', config.callerKeys.crm],
  ['AUTH_CALLER_API_KEY', config.callerKeys.auth],
  ['COGNITO_USER_POOL_ID', config.cognito.userPoolId],
];

export function assertEnv() {
  if (crmInternalApiUrlError) {
    throw new Error(`marketplace-api is misconfigured. ${crmInternalApiUrlError}`);
  }
  // Only meaningful with the stage mapped to a base path; without one the CRM
  // route would be requested at the domain root and 403 at API Gateway. A
  // scheme in the domain means local development, where there is no mapping.
  if (!String(process.env.CRM_INTERNAL_API_BASE_PATH || '').trim()
      && !String(process.env.CRM_INTERNAL_API_DOMAIN_NAME || '').includes('://')) {
    throw new Error('marketplace-api is misconfigured. Missing: CRM_INTERNAL_API_BASE_PATH');
  }

  const missing = REQUIRED.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`marketplace-api is misconfigured. Missing: ${missing.join(', ')}`);
  }

  if (!['gemini', 'bedrock'].includes(config.model.provider)) {
    throw new Error(`MODEL_PROVIDER must be gemini or bedrock (got '${config.model.provider}')`);
  }

  // The two caller keys guard the same routes; if they are equal, revoking
  // one caller silently revokes both, which defeats having two.
  if (config.callerKeys.crm === config.callerKeys.auth) {
    throw new Error('CRM_CALLER_API_KEY and AUTH_CALLER_API_KEY must differ');
  }

  // Captcha fails OPEN if half-configured, so refuse the ambiguous state.
  if (Boolean(config.hcaptchaSiteKey) !== Boolean(config.hcaptchaSecretKey)) {
    throw new Error('HCAPTCHA_SITE_KEY and HCAPTCHA_SECRET_KEY must be set together, or neither');
  }
}

export function modelConfigured() {
  if (config.model.provider === 'bedrock') return Boolean(config.model.bedrockModelId);
  return Boolean(config.model.geminiApiKey && config.model.geminiModel);
}

export function captchaEnabled() {
  return Boolean(config.hcaptchaSiteKey && config.hcaptchaSecretKey);
}
