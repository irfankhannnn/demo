// Environment contract for the Instagram microservice.
//
// Every value is read through here rather than off process.env at the call
// site, so a missing table name surfaces once at boot with a readable message
// instead of as an AWS ValidationException on the first write of the day.

const REQUIRED = [
  ['AUTH_SERVICE_DOMAIN_NAME', 'API Gateway custom domain of the auth microservice (used for GET /auth/me)'],
];

// Only required when the service talks to real DynamoDB. The local in-memory
// store (INSTA_STORE=memory) needs no tables.
const REQUIRED_TABLES = [
  ['INSTA_DATA_TABLE_NAME', 'DynamoDB table <env>-realestateflow-insta-data'],
  ['INSTA_AUDIT_TABLE_NAME', 'DynamoDB table <env>-realestateflow-insta-audit'],
];

// Service-to-service APIs, each reached as https://<DOMAIN_NAME>/<BASE_PATH>.
const SERVICE_URL_VARS = [
  ['AUTH_SERVICE_DOMAIN_NAME', 'AUTH_SERVICE_BASE_PATH'],
  ['CRM_INTERNAL_API_DOMAIN_NAME', 'CRM_INTERNAL_API_BASE_PATH'],
  ['INSTA_API_DOMAIN_NAME', 'INSTA_API_BASE_PATH'],
];

const RAW_API_GATEWAY_HOST = /execute-api\.|\.amazonaws\.com/i;

/**
 * The only Instagram permissions this service asks for. Each one is used:
 * basic for profile/media/insights, messages for the inbox and replies,
 * comments for keyword rules. content_publish is deliberately absent - nothing
 * here publishes, and every extra scope is one more thing App Review questions.
 */
export const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
];

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

function str(name) {
  return String(process.env[name] ?? '').trim();
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
  if (!str(domainVar)) return undefined;
  return buildServiceBaseUrl(process.env[domainVar], process.env[basePathVar], domainVar);
}

/** Composition errors are reported by assertEnv; getConfig must not throw on them. */
function safeServiceBaseUrl(domainVar, basePathVar) {
  try {
    return serviceBaseUrl(domainVar, basePathVar);
  } catch {
    return undefined;
  }
}

export function isValidEncryptionKey(hex) {
  return typeof hex === 'string' && /^[0-9a-fA-F]{64}$/.test(hex);
}

/**
 * Throws a single error naming every missing or invalid variable at once — an
 * operator fixing a fresh deploy should not have to redeploy three times to
 * discover three bad values.
 */
export function assertEnv() {
  const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  const memoryStore = str('INSTA_STORE').toLowerCase() === 'memory';

  const required = memoryStore ? REQUIRED : [...REQUIRED, ...REQUIRED_TABLES];
  const problems = required.filter(([name]) => !process.env[name]).map(([name, why]) => `  - ${name}: ${why}`);

  // Composition errors (a raw execute-api host, a malformed origin) surface at
  // boot too, rather than as a 500 on the first authenticated request.
  for (const [domainVar, basePathVar] of SERVICE_URL_VARS) {
    try {
      serviceBaseUrl(domainVar, basePathVar);
    } catch (err) {
      problems.push(`  - ${err.message}`);
    }
  }

  // Local-only conveniences must never be reachable in a deployed function.
  if (isLambda && memoryStore) {
    problems.push('  - INSTA_STORE=memory is for local development only and cannot run in Lambda');
  }
  if (str('INSTA_DEV_AUTH_TENANT_ID') && (isLambda || process.env.NODE_ENV === 'production')) {
    problems.push('  - INSTA_DEV_AUTH_TENANT_ID bypasses login and is refused outside local development');
  }

  // The Instagram app is optional at boot (the dashboard still serves stored
  // data without it), but a half-configured app is always a mistake.
  const metaVars = ['META_APP_ID', 'META_APP_SECRET'];
  const anyMeta = metaVars.some((name) => str(name));
  if (anyMeta) {
    for (const name of metaVars) {
      if (!str(name)) problems.push(`  - ${name}: required once any Instagram app setting is present`);
    }
    if (!isValidEncryptionKey(str('INSTA_TOKEN_ENCRYPTION_KEY'))) {
      problems.push('  - INSTA_TOKEN_ENCRYPTION_KEY: must be 64 hex characters (generate with: openssl rand -hex 32)');
    }
    if (!str('META_REDIRECT_URI') && !str('INSTA_API_DOMAIN_NAME')) {
      problems.push('  - INSTA_API_DOMAIN_NAME (or META_REDIRECT_URI): needed to build the Instagram OAuth redirect URI');
    }
    if (!str('INSTA_CONSOLE_URL')) {
      problems.push('  - INSTA_CONSOLE_URL: where the browser lands after connecting Instagram (e.g. https://app.example.com/insta)');
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
  const instaApiUrl = safeServiceBaseUrl('INSTA_API_DOMAIN_NAME', 'INSTA_API_BASE_PATH');
  const appId = str('META_APP_ID');
  const appSecret = str('META_APP_SECRET');
  const tokenEncryptionKey = str('INSTA_TOKEN_ENCRYPTION_KEY');
  const redirectUri = str('META_REDIRECT_URI') || (instaApiUrl ? `${instaApiUrl}/api/insta/oauth/callback` : '');
  const geminiApiKey = str('GEMINI_API_KEY');

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: num('PORT', 3101),
    region: process.env.AWS_REGION || 'ap-south-1',
    isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME,

    // https://<AUTH_SERVICE_DOMAIN_NAME>/<AUTH_SERVICE_BASE_PATH>; validateToken appends /auth/me.
    authServiceUrl: safeServiceBaseUrl('AUTH_SERVICE_DOMAIN_NAME', 'AUTH_SERVICE_BASE_PATH'),
    authCacheTtlMs: num('AUTH_TOKEN_CACHE_TTL_MS', 60_000),
    authStaleGraceMs: num('AUTH_TOKEN_STALE_GRACE_MS', 300_000),
    authTimeoutMs: num('AUTH_SERVICE_TIMEOUT_MS', 3_000),

    // Local development only, both refused by assertEnv under Lambda.
    store: str('INSTA_STORE').toLowerCase() || 'dynamodb',
    memoryStoreFile: str('INSTA_MEMORY_STORE_FILE'),
    devAuthTenantId: str('INSTA_DEV_AUTH_TENANT_ID'),

    dataTable: process.env.INSTA_DATA_TABLE_NAME,
    auditTable: process.env.INSTA_AUDIT_TABLE_NAME,

    allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    bodyLimit: process.env.REQUEST_BODY_LIMIT || '2mb',

    killSwitch: bool('INSTA_KILL_SWITCH', false),
    auditTtlDays: num('INSTA_AUDIT_TTL_DAYS', 30),

    // This API's own public URL. The OAuth redirect URI is derived from it, so
    // it must match what is registered in the Meta app exactly.
    instaApiUrl,
    // The browser app. OAuth callbacks send the user back here.
    consoleUrl: str('INSTA_CONSOLE_URL').replace(/\/+$/, ''),

    meta: {
      appId,
      appSecret,
      webhookVerifyToken: str('META_WEBHOOK_VERIFY_TOKEN'),
      redirectUri,
      scopes: INSTAGRAM_SCOPES,
      graphBase: (str('META_GRAPH_BASE_URL') || 'https://graph.instagram.com').replace(/\/+$/, ''),
      graphVersion: str('META_GRAPH_API_VERSION') || 'v23.0',
      authorizeUrl: str('META_OAUTH_AUTHORIZE_URL') || 'https://www.instagram.com/oauth/authorize',
      tokenUrl: str('META_OAUTH_TOKEN_URL') || 'https://api.instagram.com/oauth/access_token',
      timeoutMs: num('META_API_TIMEOUT_MS', 10_000),
    },
    tokenEncryptionKey,
    instagramConfigured: Boolean(appId && appSecret && redirectUri && isValidEncryptionKey(tokenEncryptionKey)),

    // Lead analysis. Pluggable: `rules` is free and offline, `gemini` is used
    // when a key is present. Anything the model says is still checked against
    // the conversation before it is stored (see services/leadAnalyst.js).
    llm: {
      provider: (str('LLM_PROVIDER') || (geminiApiKey ? 'gemini' : 'rules')).toLowerCase(),
      model: str('LLM_MODEL') || 'gemini-2.5-flash',
      geminiApiKey,
      geminiBaseUrl: (str('GEMINI_API_BASE_URL') || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, ''),
      timeoutMs: num('LLM_TIMEOUT_MS', 20_000),
    },

    sends: {
      // true = every outbound message is built, checked and recorded, but never
      // sent to Instagram. The safe setting for a first test.
      dryRun: bool('INSTA_DRY_RUN_SENDS', false),
      autoRulesEnabled: bool('INSTA_RULES_ENABLED', true),
      maxAutoRepliesPerHour: num('INSTA_MAX_AUTO_REPLIES_PER_HOUR', 30),
    },

    worker: {
      conversationsEveryMinutes: num('INSTA_POLL_CONVERSATIONS_MINUTES', 5),
      commentsEveryMinutes: num('INSTA_POLL_COMMENTS_MINUTES', 5),
      mediaEveryMinutes: num('INSTA_POLL_MEDIA_MINUTES', 60),
      profileEveryMinutes: num('INSTA_POLL_PROFILE_MINUTES', 360),
      analysisBatch: num('INSTA_ANALYSIS_BATCH', 10),
      timeBudgetMs: num('INSTA_WORKER_TIME_BUDGET_MS', 50_000),
    },

    // CRM lead-pipeline bridge (services/crmBridge.js). Optional on purpose:
    // unset, the Instagram feature runs standalone and enquiries simply are not
    // promoted to CRM leads.
    // https://<CRM_INTERNAL_API_DOMAIN_NAME>/<CRM_INTERNAL_API_BASE_PATH>; crmBridge
    // appends /api/internal/adapters/leads.
    crmInternalApiUrl: safeServiceBaseUrl('CRM_INTERNAL_API_DOMAIN_NAME', 'CRM_INTERNAL_API_BASE_PATH'),
    adapterInternalApiKey: process.env.ADAPTER_INTERNAL_API_KEY,
    crmTimeoutMs: num('CRM_INTERNAL_TIMEOUT_MS', 5_000),
    promoteEnquiriesToLeads: bool('INSTA_PROMOTE_ENQUIRIES_TO_LEADS', true),
  };
}

export default { assertEnv, getConfig, buildServiceBaseUrl, isValidEncryptionKey, INSTAGRAM_SCOPES };
