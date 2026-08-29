// Environment contract for the Instagram microservice.
//
// Every value is read through here rather than off process.env at the call
// site, so a missing table name surfaces once at boot with a readable message
// instead of as an AWS ValidationException on the first write of the day.

const REQUIRED = [
  ['AUTH_SERVICE_URL', 'base URL of the auth microservice (used for GET /auth/me)'],
  ['INSTA_DATA_TABLE_NAME', 'DynamoDB table <env>-realestateflow-insta-data'],
  ['INSTA_AUDIT_TABLE_NAME', 'DynamoDB table <env>-realestateflow-insta-audit'],
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

/**
 * Throws a single error naming every missing variable at once — an operator
 * fixing a fresh deploy should not have to redeploy three times to discover
 * three missing values.
 */
export function assertEnv() {
  const missing = REQUIRED.filter(([name]) => !process.env[name]);
  if (missing.length === 0) return;

  const detail = missing.map(([name, why]) => `  - ${name}: ${why}`).join('\n');
  throw new Error(
    `backend_insta_sol_ms cannot start — missing required environment variables:\n${detail}\n` +
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

    authServiceUrl: process.env.AUTH_SERVICE_URL,
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
  };
}

export default { assertEnv, getConfig };
