// Structured CloudWatch logger — same shape as ai-calling-service's so the two
// services' logs read alike in Logs Insights. Phone numbers are masked before
// they reach a log line.

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

function currentLevel() {
  const configured = (process.env.LOG_LEVEL || 'info').toUpperCase();
  return LOG_LEVELS[configured] ?? LOG_LEVELS.INFO;
}

const PHONE_KEYS = new Set(['phone', 'leadPhone', 'toPhone', 'fromPhone', 'mobile', 'phoneNumber']);

export function maskPhone(value) {
  const s = String(value ?? '');
  const digits = s.replace(/\D/g, '');
  if (digits.length < 6) return s;
  return `${s.slice(0, Math.max(0, s.length - 10)).replace(/\d/g, '*')}******${digits.slice(-4)}`;
}

function maskSensitive(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(maskSensitive);
  const masked = {};
  for (const [key, value] of Object.entries(data)) {
    if (PHONE_KEYS.has(key) && value != null) masked[key] = maskPhone(value);
    else if (/apiKey|token|secret/i.test(key)) masked[key] = '***REDACTED***';
    else if (value && typeof value === 'object' && !(value instanceof Error)) masked[key] = maskSensitive(value);
    else masked[key] = value;
  }
  return masked;
}

function formatLog(level, message, context = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: 'followup-agent',
    message,
    ...maskSensitive(context),
  });
}

export const logger = {
  debug(message, context = {}) {
    if (currentLevel() <= LOG_LEVELS.DEBUG) console.log(formatLog('DEBUG', message, context));
  },
  info(message, context = {}) {
    if (currentLevel() <= LOG_LEVELS.INFO) console.log(formatLog('INFO', message, context));
  },
  warn(message, context = {}) {
    if (currentLevel() <= LOG_LEVELS.WARN) console.warn(formatLog('WARN', message, context));
  },
  error(message, error, context = {}) {
    if (currentLevel() <= LOG_LEVELS.ERROR) {
      console.error(formatLog('ERROR', message, {
        ...context,
        error: error?.message || error,
        stack: error?.stack,
      }));
    }
  },
  jobEvent(eventType, job, details = {}) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service: 'followup-agent',
      eventType,
      tenantId: job?.tenantId,
      jobId: job?.jobId,
      leadId: job?.leadId,
      jobType: job?.jobType,
      ...maskSensitive(details),
    }));
  },
};

export default logger;
