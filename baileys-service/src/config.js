export const PORT = parseInt(process.env.PORT || '3003', 10);
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const BAILEYS_WEBHOOK_SECRET = process.env.BAILEYS_WEBHOOK_SECRET || '';
export const BAILEYS_API_KEY = process.env.BAILEYS_API_KEY || '';
export const BAILEYS_ADMIN_API_KEY = process.env.BAILEYS_ADMIN_API_KEY || '';
export const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL || '';
export const CRM_WEBHOOK_SECRET = process.env.CRM_WEBHOOK_SECRET || BAILEYS_WEBHOOK_SECRET;
export const AUTH_ENCRYPTION_KEY = process.env.AUTH_ENCRYPTION_KEY || '';

if (!BAILEYS_WEBHOOK_SECRET && NODE_ENV === 'production') {
  throw new Error('BAILEYS_WEBHOOK_SECRET must be set in production');
}
if (!BAILEYS_API_KEY && NODE_ENV === 'production') {
  throw new Error('BAILEYS_API_KEY must be set in production');
}
if (!BAILEYS_ADMIN_API_KEY && NODE_ENV === 'production') {
  throw new Error('BAILEYS_ADMIN_API_KEY must be set in production (required for destructive operations)');
}
if (!CRM_WEBHOOK_URL && NODE_ENV === 'production') {
  throw new Error('CRM_WEBHOOK_URL must be set in production');
}
if (!AUTH_ENCRYPTION_KEY && NODE_ENV === 'production') {
  throw new Error('AUTH_ENCRYPTION_KEY must be set in production (required for credential backup encryption)');
}

export const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
export const AUTH_STATE_DIR = process.env.AUTH_STATE_DIR || './auth_state';
export const DEFAULT_SESSION_PHONE = process.env.DEFAULT_SESSION_PHONE || '';
export const BROWSER_NAME = process.env.BROWSER_NAME || 'Chrome';

export const QR_TIMEOUT_MS = parseInt(process.env.QR_TIMEOUT_MS || '60000', 10);
export const SEND_MESSAGE_TIMEOUT_MS = parseInt(process.env.SEND_MESSAGE_TIMEOUT_MS || '30000', 10);
export const MESSAGE_DEBOUNCE_MS = parseInt(process.env.MESSAGE_DEBOUNCE_MS || '0', 10);
export const HEALTH_PROBE_INTERVAL_MS = parseInt(process.env.HEALTH_PROBE_INTERVAL_MS || '30000', 10);
export const HEALTH_PROBE_TIMEOUT_MS = parseInt(process.env.HEALTH_PROBE_TIMEOUT_MS || '10000', 10);
export const DEFAULT_QUERY_TIMEOUT_MS = parseInt(process.env.DEFAULT_QUERY_TIMEOUT_MS || '60000', 10);
export const PREKEY_ROTATION_INTERVAL_MS = parseInt(process.env.PREKEY_ROTATION_INTERVAL_MS || '21600000', 10); // 6 hours
export const SOFT_RESET_MAX_RETRIES = parseInt(process.env.SOFT_RESET_MAX_RETRIES || '2', 10);

if (isNaN(QR_TIMEOUT_MS) || QR_TIMEOUT_MS < 1000) {
  throw new Error('QR_TIMEOUT_MS must be a valid number >= 1000');
}
if (isNaN(SEND_MESSAGE_TIMEOUT_MS) || SEND_MESSAGE_TIMEOUT_MS < 1000) {
  throw new Error('SEND_MESSAGE_TIMEOUT_MS must be a valid number >= 1000');
}
if (isNaN(MESSAGE_DEBOUNCE_MS) || MESSAGE_DEBOUNCE_MS < 0) {
  throw new Error('MESSAGE_DEBOUNCE_MS must be a valid number >= 0');
}
if (MESSAGE_DEBOUNCE_MS > 60000) {
  throw new Error('MESSAGE_DEBOUNCE_MS must be <= 60000 (1 minute) to avoid excessive message delay');
}
if (isNaN(HEALTH_PROBE_INTERVAL_MS) || HEALTH_PROBE_INTERVAL_MS < 5000) {
  throw new Error('HEALTH_PROBE_INTERVAL_MS must be a valid number >= 5000');
}
if (isNaN(HEALTH_PROBE_TIMEOUT_MS) || HEALTH_PROBE_TIMEOUT_MS < 1000) {
  throw new Error('HEALTH_PROBE_TIMEOUT_MS must be a valid number >= 1000');
}
if (isNaN(DEFAULT_QUERY_TIMEOUT_MS) || DEFAULT_QUERY_TIMEOUT_MS < 5000) {
  throw new Error('DEFAULT_QUERY_TIMEOUT_MS must be a valid number >= 5000');
}
if (isNaN(PREKEY_ROTATION_INTERVAL_MS) || PREKEY_ROTATION_INTERVAL_MS < 60000) {
  throw new Error('PREKEY_ROTATION_INTERVAL_MS must be a valid number >= 60000');
}
if (isNaN(SOFT_RESET_MAX_RETRIES) || SOFT_RESET_MAX_RETRIES < 0) {
  throw new Error('SOFT_RESET_MAX_RETRIES must be a valid number >= 0');
}
