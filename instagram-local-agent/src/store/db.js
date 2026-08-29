/**
 * SQLite connection.
 *
 * Two drivers behind ONE interface:
 *   1. `better-sqlite3` - preferred, used when the native module built.
 *   2. `node:sqlite`    - built into Node 22+, used when it did not.
 *
 * Nothing above this file may know which one is live. The exposed surface is the
 * better-sqlite3 shape, because it is the smaller of the two:
 *
 *   db.exec(sql)                        -> void
 *   db.prepare(sql)                     -> { run(...p), get(...p), all(...p) }
 *   db.transaction(fn)                  -> wrapped fn (BEGIN/COMMIT/ROLLBACK)
 *   db.pragma('journal_mode = WAL')     -> row(s)
 *   db.driver                           -> 'better-sqlite3' | 'node:sqlite'
 *   db.close()
 *
 * The database lives at ~/.ig-agent/agent.db and is the source of truth for the
 * whole product. The cloud copy is a projection of it (PLAN A9).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dbPath, ensureHome } from '../util/paths.js';
import { logger } from '../util/logger.js';

const log = logger('store/db');
const require_ = createRequire(import.meta.url);

let cached = null;

function loadDriver() {
  if (process.env.IG_AGENT_SQLITE_DRIVER !== 'node') {
    try {
      const Database = require_('better-sqlite3');
      return { kind: 'better-sqlite3', Database };
    } catch (err) {
      log.debug('better-sqlite3 unavailable, falling back to node:sqlite', { reason: err.code || err.message });
    }
  }
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require_('node:sqlite'));
  } catch {
    throw new Error(
      'No SQLite driver available. Either install better-sqlite3 (needs a C++ toolchain) ' +
        'or run on Node 22+ where node:sqlite is built in.',
    );
  }
  if (!DatabaseSync) throw new Error('node:sqlite present but DatabaseSync missing - Node 22+ required.');
  return { kind: 'node:sqlite', DatabaseSync };
}

/** Wrap a node:sqlite handle so it quacks like better-sqlite3. */
function adaptNodeSqlite(handle) {
  const clean = (row) => (row == null ? row : { ...row }); // strip the null prototype
  const api = {
    driver: 'node:sqlite',
    raw: handle,
    exec: (sql) => handle.exec(sql),
    prepare(sql) {
      const st = handle.prepare(sql);
      return {
        run: (...p) => st.run(...p),
        get: (...p) => clean(st.get(...p)),
        all: (...p) => st.all(...p).map(clean),
      };
    },
    pragma(stmt) {
      const text = String(stmt).trim();
      const sql = `PRAGMA ${text}`;
      // A pragma that assigns still returns rows on some builds; tolerate both.
      try {
        return handle.prepare(sql).all().map(clean);
      } catch {
        handle.exec(sql);
        return [];
      }
    },
    transaction(fn) {
      return (...args) => {
        handle.exec('BEGIN');
        try {
          const out = fn(...args);
          handle.exec('COMMIT');
          return out;
        } catch (err) {
          try {
            handle.exec('ROLLBACK');
          } catch { /* the transaction was already unwound */ }
          throw err;
        }
      };
    },
    close: () => handle.close(),
  };
  return api;
}

function adaptBetter(handle) {
  return {
    driver: 'better-sqlite3',
    raw: handle,
    exec: (sql) => handle.exec(sql),
    prepare: (sql) => handle.prepare(sql),
    pragma: (stmt) => handle.pragma(stmt),
    transaction: (fn) => handle.transaction(fn),
    close: () => handle.close(),
  };
}

/**
 * Open a database. `file` defaults to ~/.ig-agent/agent.db; pass ':memory:' or a
 * temp path in tests.
 */
export function openDatabase(file = dbPath()) {
  const driver = loadDriver();
  if (file !== ':memory:') {
    const dir = path.dirname(file);
    if (dir === path.dirname(dbPath())) ensureHome();
    else fs.mkdirSync(dir, { recursive: true });
  }

  const db =
    driver.kind === 'better-sqlite3'
      ? adaptBetter(new driver.Database(file))
      : adaptNodeSqlite(new driver.DatabaseSync(file));

  // WAL keeps the console readable while a collector writes. Not available for
  // :memory:, where the pragma is a harmless no-op.
  try {
    db.pragma('journal_mode = WAL');
  } catch (err) {
    log.warn('could not enable WAL', { error: err.message });
  }
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  // Tighten permissions on the file - it holds every DM the owner ever received.
  if (file !== ':memory:' && process.platform !== 'win32') {
    try {
      fs.chmodSync(file, 0o600);
    } catch { /* best effort */ }
  }
  return db;
}

/** Process-wide singleton used by the CLI, collectors and console. */
export function getDb() {
  if (!cached) {
    cached = openDatabase();
    log.debug('database opened', { driver: cached.driver, file: dbPath() });
  }
  return cached;
}

export function closeDb() {
  if (cached) {
    try {
      cached.close();
    } catch { /* already closed */ }
    cached = null;
  }
}

export function driverName() {
  return getDb().driver;
}
