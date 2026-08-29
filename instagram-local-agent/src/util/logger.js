/**
 * Structured line logger. Human-readable on stderr, JSON-ish on the file so the
 * console UI and `doctor` can read it back.
 */
import fs from 'node:fs';
import { ensureHome, logPath } from './paths.js';
import { iso } from './time.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[process.env.IG_AGENT_LOG_LEVEL || 'info'] ?? 20;
let stream = null;

function fileStream() {
  if (process.env.IG_AGENT_NO_FILE_LOG === '1') return null;
  if (!stream) {
    try {
      ensureHome();
      stream = fs.createWriteStream(logPath(), { flags: 'a' });
    } catch {
      stream = null;
      process.env.IG_AGENT_NO_FILE_LOG = '1';
    }
  }
  return stream;
}

function emit(level, scope, msg, fields) {
  if (LEVELS[level] < threshold) return;
  const rec = { ts: iso(), level, scope, msg, ...(fields || {}) };
  const s = fileStream();
  if (s) s.write(JSON.stringify(rec) + '\n');
  if (process.env.IG_AGENT_QUIET === '1') return;
  const extra = fields && Object.keys(fields).length ? ' ' + JSON.stringify(fields) : '';
  process.stderr.write(`${rec.ts} ${level.toUpperCase().padEnd(5)} [${scope}] ${msg}${extra}\n`);
}

export function logger(scope) {
  return {
    debug: (m, f) => emit('debug', scope, m, f),
    info: (m, f) => emit('info', scope, m, f),
    warn: (m, f) => emit('warn', scope, m, f),
    error: (m, f) => emit('error', scope, m, f),
  };
}

export default logger;
