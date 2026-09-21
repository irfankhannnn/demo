/**
 * Structured JSON logging, matching the shape the other services in this repo
 * emit so CloudWatch Insights queries work across all of them.
 *
 * Nothing here may log a buyer's phone number, email, name, a JWT, or a
 * presigned URL: these logs outlive the data's usefulness, and a phone number
 * in a log line is a phone number in every downstream log sink. Log ids
 * (userId, threadId, propertyId) and reasons instead.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

function emit(level, event, fields = {}) {
  if (LEVELS[level] > threshold) return;
  const line = {
    level,
    event,
    ts: new Date().toISOString(),
    service: 'marketplace-api',
    ...fields,
  };
  const out = level === 'error' ? console.error : console.log;
  out(JSON.stringify(line));
}

export const logger = {
  error: (event, fields) => emit('error', event, fields),
  warn: (event, fields) => emit('warn', event, fields),
  info: (event, fields) => emit('info', event, fields),
  debug: (event, fields) => emit('debug', event, fields),
};
