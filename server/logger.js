const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const CURRENT_LEVEL = LEVELS[DEFAULT_LEVEL] ?? LEVELS.info;

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ message: 'Failed to stringify log payload' });
  }
}

function redact(value) {
  if (value == null) return value;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) return value.map(redact);

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const key = k.toLowerCase();
    if (
      key.includes('authorization') ||
      key.includes('password') ||
      key.includes('token') ||
      key.includes('secret') ||
      key.includes('razorpaypaymentid') ||
      key.includes('razorpayorderid') ||
      key.includes('amountpaise') ||
      key.includes('razorpaykeysecret') ||
      key.includes('razorpaywebhooksecret') ||
      key.includes('adminpasswordhash') ||
      key.includes('jwtsecret') ||
      key.includes('contactphone') ||
      key.includes('contactemail') ||
      key.includes('adminemail') ||
      key.includes('adminphone') ||
      key === 'phone' ||
      key === 'email'
    ) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redact(v);
    }
  }
  return out;
}

export function createLogger(baseFields = {}) {
  const base = redact(baseFields);

  const write = (level, message, fields) => {
    if ((LEVELS[level] ?? 100) < CURRENT_LEVEL) return;

    const payload = {
      ts: new Date().toISOString(),
      level,
      message,
      ...base,
      ...(fields ? redact(fields) : {}),
    };

    const line = safeStringify(payload);

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  };

  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),

    child: (moreFields) => createLogger({ ...base, ...(moreFields || {}) }),

    async span(name, fields, fn) {
      const start = Date.now();
      try {
        const result = await fn();
        write('info', name, { ...(fields || {}), durationMs: Date.now() - start, ok: true });
        return result;
      } catch (err) {
        write('error', name, {
          ...(fields || {}),
          durationMs: Date.now() - start,
          ok: false,
          errorMessage: err?.message,
          errorName: err?.name,
          stack: err?.stack,
        });
        throw err;
      }
    },
  };
}

export const logger = createLogger({ service: 'real-estate-api' });
