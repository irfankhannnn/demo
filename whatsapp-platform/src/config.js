// Load .env first (no-op in production where env vars are injected)
import 'dotenv/config';

// ─── Runtime storage mode ─────────────────────────────────────────────────────
// LOCAL_STORAGE=true  → filesystem auth state + in-memory session map (default for local dev)
// LOCAL_STORAGE=false → S3 auth state + DynamoDB session map (default when SESSION_BUCKET_NAME is set)
export const NODE_ENV = process.env.NODE_ENV || 'development';
const hasBucket = Boolean(process.env.SESSION_BUCKET_NAME);
export const LOCAL_STORAGE = process.env.LOCAL_STORAGE
  ? process.env.LOCAL_STORAGE === 'true'
  : !hasBucket;

// ─── Server ───────────────────────────────────────────────────────────────────
export const PORT = parseInt(process.env.PORT || '3003', 10);
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// ─── Auth / API keys ──────────────────────────────────────────────────────────
// Supports both naming conventions:
//   BAILEYS_API_KEY (baileys-service style)
//   INTERNAL_API_KEY (whatsapp-platform / ECS style)
export const BAILEYS_API_KEY = process.env.BAILEYS_API_KEY || process.env.INTERNAL_API_KEY || '';
export const BAILEYS_ADMIN_API_KEY = process.env.BAILEYS_ADMIN_API_KEY || '';
export const BAILEYS_WEBHOOK_SECRET = process.env.BAILEYS_WEBHOOK_SECRET || '';
export const AUTH_ENCRYPTION_KEY = process.env.AUTH_ENCRYPTION_KEY || '';

// ─── CRM / Webhook ────────────────────────────────────────────────────────────
export const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL || '';
export const CRM_WEBHOOK_SECRET = process.env.CRM_WEBHOOK_SECRET || BAILEYS_WEBHOOK_SECRET;

// ─── Local filesystem (LOCAL_STORAGE=true) ────────────────────────────────────
export const AUTH_STATE_DIR = process.env.AUTH_STATE_DIR || './auth_state';
export const AUTH_BACKUP_DIR = process.env.AUTH_BACKUP_DIR || './auth-backups';

// ─── AWS / S3 / DynamoDB (LOCAL_STORAGE=false) ────────────────────────────────
export const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
export const SESSION_BUCKET_NAME = process.env.SESSION_BUCKET_NAME || '';
export const SESSION_KMS_KEY_ID = process.env.SESSION_KMS_KEY_ID || '';
export const SESSION_TABLE_NAME = process.env.SESSION_TABLE_NAME || 'whatsapp-sessions';

// ─── EventBridge ──────────────────────────────────────────────────────────────
// USE_EVENTBRIDGE=true  → publish to EventBridge (ECS)
// USE_EVENTBRIDGE=false → forward directly to CRM_WEBHOOK_URL (default local)
const hasEventBus = Boolean(process.env.EVENT_BUS_NAME);
export const USE_EVENTBRIDGE = process.env.USE_EVENTBRIDGE
  ? process.env.USE_EVENTBRIDGE === 'true'
  : hasEventBus && !LOCAL_STORAGE;
export const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'default';

// ─── CloudWatch ───────────────────────────────────────────────────────────────
export const CLOUDWATCH_METRICS_ENABLED = process.env.CLOUDWATCH_METRICS_ENABLED === 'true';
export const CLOUDWATCH_METRICS_NAMESPACE = process.env.CLOUDWATCH_METRICS_NAMESPACE || 'WhatsAppPlatform';

// ─── ECS metadata ─────────────────────────────────────────────────────────────
export const ECS_TASK_ID = process.env.ECS_TASK_ID || process.env.HOSTNAME || 'local';
export const ECS_TASK_ARN = process.env.ECS_TASK_ARN || '';
export const MAX_SESSIONS_PER_TASK = parseInt(process.env.MAX_SESSIONS_PER_TASK || '100', 10);
export const RESTORE_ON_STARTUP = process.env.RESTORE_ON_STARTUP !== 'false';

// ─── Baileys session tuning ───────────────────────────────────────────────────
export const DEFAULT_SESSION_PHONE = process.env.DEFAULT_SESSION_PHONE || '';
export const BROWSER_NAME = process.env.BROWSER_NAME || 'Chrome';
export const QR_TIMEOUT_MS = parseInt(process.env.QR_TIMEOUT_MS || '60000', 10);
export const SEND_MESSAGE_TIMEOUT_MS = parseInt(process.env.SEND_MESSAGE_TIMEOUT_MS || '30000', 10);
export const MESSAGE_DEBOUNCE_MS = parseInt(process.env.MESSAGE_DEBOUNCE_MS || '0', 10);
export const HEALTH_PROBE_INTERVAL_MS = parseInt(process.env.HEALTH_PROBE_INTERVAL_MS || '30000', 10);
export const HEALTH_PROBE_TIMEOUT_MS = parseInt(process.env.HEALTH_PROBE_TIMEOUT_MS || '10000', 10);
export const DEFAULT_QUERY_TIMEOUT_MS = parseInt(process.env.DEFAULT_QUERY_TIMEOUT_MS || '60000', 10);
export const PREKEY_ROTATION_INTERVAL_MS = parseInt(process.env.PREKEY_ROTATION_INTERVAL_MS || '21600000', 10);
export const SOFT_RESET_MAX_RETRIES = parseInt(process.env.SOFT_RESET_MAX_RETRIES || '2', 10);

// ─── Startup validation ───────────────────────────────────────────────────────
if (NODE_ENV === 'production') {
  if (!BAILEYS_API_KEY) throw new Error('BAILEYS_API_KEY (or INTERNAL_API_KEY) must be set in production');
  if (!BAILEYS_ADMIN_API_KEY) throw new Error('BAILEYS_ADMIN_API_KEY must be set in production');
  if (!BAILEYS_WEBHOOK_SECRET) throw new Error('BAILEYS_WEBHOOK_SECRET must be set in production');
  if (!CRM_WEBHOOK_URL && !USE_EVENTBRIDGE) throw new Error('CRM_WEBHOOK_URL must be set in production when USE_EVENTBRIDGE=false');
  if (!AUTH_ENCRYPTION_KEY) throw new Error('AUTH_ENCRYPTION_KEY must be set in production');
  if (!LOCAL_STORAGE && !SESSION_BUCKET_NAME) throw new Error('SESSION_BUCKET_NAME must be set when LOCAL_STORAGE=false');
}

if (isNaN(QR_TIMEOUT_MS) || QR_TIMEOUT_MS < 1000) throw new Error('QR_TIMEOUT_MS must be >= 1000');
if (isNaN(SEND_MESSAGE_TIMEOUT_MS) || SEND_MESSAGE_TIMEOUT_MS < 1000) throw new Error('SEND_MESSAGE_TIMEOUT_MS must be >= 1000');
if (isNaN(MESSAGE_DEBOUNCE_MS) || MESSAGE_DEBOUNCE_MS < 0) throw new Error('MESSAGE_DEBOUNCE_MS must be >= 0');
if (MESSAGE_DEBOUNCE_MS > 60000) throw new Error('MESSAGE_DEBOUNCE_MS must be <= 60000');
if (isNaN(HEALTH_PROBE_INTERVAL_MS) || HEALTH_PROBE_INTERVAL_MS < 5000) throw new Error('HEALTH_PROBE_INTERVAL_MS must be >= 5000');
if (isNaN(HEALTH_PROBE_TIMEOUT_MS) || HEALTH_PROBE_TIMEOUT_MS < 1000) throw new Error('HEALTH_PROBE_TIMEOUT_MS must be >= 1000');
if (isNaN(DEFAULT_QUERY_TIMEOUT_MS) || DEFAULT_QUERY_TIMEOUT_MS < 5000) throw new Error('DEFAULT_QUERY_TIMEOUT_MS must be >= 5000');
if (isNaN(PREKEY_ROTATION_INTERVAL_MS) || PREKEY_ROTATION_INTERVAL_MS < 60000) throw new Error('PREKEY_ROTATION_INTERVAL_MS must be >= 60000');
if (isNaN(SOFT_RESET_MAX_RETRIES) || SOFT_RESET_MAX_RETRIES < 0) throw new Error('SOFT_RESET_MAX_RETRIES must be >= 0');
