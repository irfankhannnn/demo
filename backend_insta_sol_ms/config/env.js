// Environment contract for the Instagram microservice.
//
// Every value is read through here rather than off process.env at the call
// site, so a missing table name surfaces once at boot with a readable message
// instead of as an AWS ValidationException on the first write of the day.

const REQUIRED = [
  ['AUTH_SERVICE_DOMAIN_NAME', 'API Gateway custom domain of the auth microservice (used for GET /auth/me)'],
  ['INSTA_DATA_TABLE_NAME', 'DynamoDB table <env>-realestateflow-insta-data'],
  ['INSTA_AUDIT_TABLE_NAME', 'DynamoDB table <env>-realestateflow-insta-audit'],
];

// Service-to-service APIs, each reached as https://<DOMAIN_NAME>/<BASE_PATH>.
const SERVICE_URL_VARS = [
  ['AUTH_SERVICE_DOMAIN_NAME', 'AUTH_SERVICE_BASE_PATH'],
  ['CRM_INTERNAL_API_DOMAIN_NAME', 'CRM_INTERNAL_API_BASE_PATH'],
];

const RAW_API_GATEWAY_HOST = /execute-api\.|\.amazonaws\.com/i;

function num(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return String(raw).toLowerCase() === 'true';
}

/**
 * Composes a service base URL from an API Gateway custom domain and its base
 * path mapping. Raw API Gateway invoke URLs are rejected outright: every API is
 * reached through its custom domain.
 *
 * A domain containing "://" is used as the origin verbatim — local development
 * only (e.g. http://localhost:4000); deployed envs pass a bare hostname.
 *
 * @param {string} domainName
 * @param {string} basePath
 * @param {string} [domainVar] env var name, used in error messages
 * @returns {string} origin, or origin + "/" + basePath
 */
export function buildServiceBaseUrl(domainName, basePath, domainVar = 'domainName') {
  const domain = String(domainName ?? '').trim();
  if (!domain) {
    throw new Error(`${domainVar} is not set (expected an API Gateway custom domain)`);
  }

  const origin = (domain.includes('://') ? domain : `https://${domain}`).replace(/\/+$/, '');

  let host;
  try {
    host = new URL(origin).host;
  } catch {
    throw new Error(`${domainVar} ('${domain}') is not a valid hostname or origin`);
  }
  if (RAW_API_GATEWAY_HOST.test(host)) {
    throw new Error(`${domainVar} ('${domain}'): raw API Gateway URLs are not allowed; use the custom domain`);
  }

  const bp = String(basePath ?? '').trim().replace(/^\/+|\/+$/g, '');
  return bp ? `${origin}/${bp}` : origin;
}

/** undefined when the domain var is unset (integration not configured), else the composed URL. */
function serviceBaseUrl(domainVar, basePathVar) {
  if (!String(process.env[domainVar] ?? '').trim()) return undefined;
  return buildServiceBaseUrl(process.env[domainVar], process.env[basePathVar], domainVar);
}

/**
 * Throws a single error naming every missing or invalid variable at once — an
 * operator fixing a fresh deploy should not have to redeploy three times to
 * discover three bad values.
 */
export function assertEnv() {
  const problems = REQUIRED.filter(([name]) => !process.env[name]).map(([name, why]) => `  - ${name}: ${why}`);

  // Composition errors (a raw execute-api host, a malformed origin) surface at
  // boot too, rather than as a 500 on the first authenticated request.
  for (const [domainVar, basePathVar] of SERVICE_URL_VARS) {
    try {
      serviceBaseUrl(domainVar, basePathVar);
    } catch (err) {
      problems.push(`  - ${err.message}`);
    }
  }
  if (problems.length === 0) return;

  throw new Error(
    `backend_insta_sol_ms cannot start — invalid or missing environment variables:\n${problems.join('\n')}\n` +
      'See .env.sample for the full reference.'
  );
}

/**
 * Read fresh each call rather than memoised at import time: the test suite and
 * the Lambda SSM hydration step both mutate process.env after modules load.
 */
export function getConfig() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: num('PORT', 7318),
    region: process.env.AWS_REGION || 'ap-south-1',
    isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME,

    // https://<AUTH_SERVICE_DOMAIN_NAME>/<AUTH_SERVICE_BASE_PATH>; validateToken appends /auth/me.
    authServiceUrl: serviceBaseUrl('AUTH_SERVICE_DOMAIN_NAME', 'AUTH_SERVICE_BASE_PATH'),
    authCacheTtlMs: num('AUTH_TOKEN_CACHE_TTL_MS', 60_000),
    authStaleGraceMs: num('AUTH_TOKEN_STALE_GRACE_MS', 300_000),
    authTimeoutMs: num('AUTH_SERVICE_TIMEOUT_MS', 3_000),

    dataTable: process.env.INSTA_DATA_TABLE_NAME,
    auditTable: process.env.INSTA_AUDIT_TABLE_NAME,

    allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    bodyLimit: process.env.REQUEST_BODY_LIMIT || '2mb',

    hmacMaxSkewMs: num('INSTA_HMAC_MAX_SKEW_MS', 300_000),
    nonceTtlSeconds: num('INSTA_NONCE_TTL_SECONDS', 900),
    pairingCodeTtlMinutes: num('INSTA_PAIRING_CODE_TTL_MINUTES', 15),

    killSwitch: bool('INSTA_KILL_SWITCH', false),
    maxBatchItems: num('INSTA_MAX_BATCH_ITEMS', 500),
    auditTtlDays: num('INSTA_AUDIT_TTL_DAYS', 30),

    // CRM lead-pipeline bridge (services/crmBridge.js). Optional on purpose:
    // unset, the Instagram feature runs standalone and enquiries simply are not
    // promoted to CRM leads, which is the pre-bridge behaviour.
    // https://<CRM_INTERNAL_API_DOMAIN_NAME>/<CRM_INTERNAL_API_BASE_PATH>; crmBridge
    // appends /api/internal/adapters/leads.
    crmInternalApiUrl: serviceBaseUrl('CRM_INTERNAL_API_DOMAIN_NAME', 'CRM_INTERNAL_API_BASE_PATH'),
    adapterInternalApiKey: process.env.ADAPTER_INTERNAL_API_KEY,
    crmTimeoutMs: num('CRM_INTERNAL_TIMEOUT_MS', 5_000),
    promoteEnquiriesToLeads: bool('INSTA_PROMOTE_ENQUIRIES_TO_LEADS', true),
  };
}

export default { assertEnv, getConfig, buildServiceBaseUrl };
