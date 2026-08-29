/**
 * Simple structured logger for the MCP microservice.
 * In production, integrates with CloudWatch via console output.
 */

const LEVELS: Record<string, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// LOG_LEVEL is validated by the zod schema in config.ts, but the logger
// may be imported before config is loaded, so we read process.env directly.
// Invalid values silently fall back to 'info'.
const DEFAULT_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const CURRENT_LEVEL = LEVELS[DEFAULT_LEVEL] ?? LEVELS.info;

function safeStringify(value: any): string {
  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (_key, val) => {
      if (val && typeof val === 'object') {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    });
  } catch {
    return JSON.stringify({ message: 'Failed to stringify log payload' });
  }
}

function redact(value: any, seen = new WeakSet()): any {
  if (value == null) return value;
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => redact(v, seen));

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    const key = k.toLowerCase();
    if (
      key.includes('authorization') ||
      key.includes('password') ||
      key.includes('token') ||
      key.includes('secret') ||
      key === 'phone' ||
      key === 'email'
    ) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redact(v, seen);
    }
  }
  return out;
}

function log(level: string, message: string, meta?: Record<string, any>): void {
  if (LEVELS[level] < CURRENT_LEVEL) return;

  const payload = meta ? redact(meta) : undefined;
  const entry = safeStringify({
    level,
    message,
    ...(payload && { ...payload }),
    timestamp: new Date().toISOString(),
  });

  if (level === 'error') {
    console.error(entry);
  } else if (level === 'warn') {
    console.warn(entry);
  } else {
    console.log(entry);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, any>) => log('debug', message, meta),
  info: (message: string, meta?: Record<string, any>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, any>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, any>) => log('error', message, meta),
};
