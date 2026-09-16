// Structured JSON logger. Deliberately a copy of the CRM's apps/crm/server/logger.js
// interface (info/warn/error/child) rather than an import — this service is a
// separate deployable and must not reach across the repo boundary.
//
// The redaction list is stricter here than in the CRM: this service handles
// Instagram device secrets, bearer tokens and enquiry phone numbers, and none
// of those may ever reach CloudWatch.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const CURRENT_LEVEL = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

const REDACT_SUBSTRINGS = [
  'authorization',
  'password',
  'token',
  'secret',
  'signature',
  'pairingcode',
  'paircode',
];

const REDACT_EXACT = new Set([
  'phone',
  'email',
  'notes',
  'caption',
  'message',
  'dmmessage',
  'publicreply',
]);

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ message: 'Failed to stringify log payload' });
  }
}

function redact(value, depth = 0) {
  if (value == null) return value;
  if (typeof value !== 'object') return value;
  // Guard against a cyclic or absurdly nested agent payload turning a log line
  // into a stack overflow.
  if (depth > 6) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const key = k.toLowerCase();
    if (REDACT_EXACT.has(key) || REDACT_SUBSTRINGS.some((s) => key.includes(s))) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

export function createLogger(baseFields = {}) {
  const base = redact(baseFields);

  const write = (level, message, fields) => {
    if ((LEVELS[level] ?? 100) < CURRENT_LEVEL) return;

    // ts, level and the event name are written last so a field that happens to
    // be called `message` (for example an error's) can never replace them.
    const extra = { ...base, ...(fields ? redact(fields) : {}) };
    delete extra.ts;
    delete extra.level;
    delete extra.message;
    const line = safeStringify({
      ts: new Date().toISOString(),
      level,
      message,
      ...extra,
    });

    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  };

  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
    child: (moreFields) => createLogger({ ...base, ...(moreFields || {}) }),
  };
}

export const logger = createLogger({ service: 'insta-sol-ms' });

export default logger;
