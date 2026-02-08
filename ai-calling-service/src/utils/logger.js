// Structured CloudWatch Logger for AI Calling Service

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const currentLevel = process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] : LOG_LEVELS.INFO;

function maskSensitive(data) {
  if (!data) return data;
  if (typeof data === 'string') {
    // Mask phone numbers
    return data.replace(/(\+91|91)?[\s-]?\d{5}[\s-]?\d{5}/g, (match) => {
      return match.slice(0, -4) + '****';
    });
  }
  if (typeof data === 'object') {
    const masked = { ...data };
    if (masked.phone) masked.phone = maskSensitive(masked.phone);
    if (masked.apiKey) masked.apiKey = '***REDACTED***';
    if (masked.token) masked.token = '***REDACTED***';
    return masked;
  }
  return data;
}

function formatLog(level, message, context = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: 'ai-calling',
    message,
    ...maskSensitive(context),
  });
}

export const logger = {
  debug(message, context = {}) {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.log(formatLog('DEBUG', message, context));
    }
  },

  info(message, context = {}) {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.log(formatLog('INFO', message, context));
    }
  },

  warn(message, context = {}) {
    if (currentLevel <= LOG_LEVELS.WARN) {
      console.warn(formatLog('WARN', message, context));
    }
  },

  error(message, error, context = {}) {
    if (currentLevel <= LOG_LEVELS.ERROR) {
      console.error(formatLog('ERROR', message, {
        ...context,
        error: error?.message || error,
        stack: error?.stack,
      }));
    }
  },

  metric(metricName, value, unit = 'Count', context = {}) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'METRIC',
      service: 'ai-calling',
      metricName,
      value,
      unit,
      ...context,
    }));
  },

  callEvent(eventType, callSessionId, tenantId, details = {}) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service: 'ai-calling',
      eventType,
      callSessionId,
      tenantId,
      ...maskSensitive(details),
    }));
  },
};

export default logger;
