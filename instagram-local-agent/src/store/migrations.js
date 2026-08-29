/**
 * Versioned, idempotent migrations.
 *
 * Rules for adding one:
 *  - Append to MIGRATIONS. Never renumber, never edit a shipped migration.
 *  - `up(db)` must be safe to re-run: IF NOT EXISTS on creates, and guard
 *    column adds with `hasColumn`.
 *  - Bump SCHEMA_VERSION in schema.js to the new highest version.
 *
 * `migrate()` is safe to call on every process start and is what `openStore()`
 * does, so a fresh laptop and an upgraded one take the same path.
 */
import { INITIAL_SCHEMA, CONTRACT_TABLES } from './schema.js';
import { logger } from '../util/logger.js';

const log = logger('store/migrations');

const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);`;

export const MIGRATIONS = [
  {
    version: 1,
    name: 'initial-schema',
    up(db) {
      db.exec(INITIAL_SCHEMA);
    },
  },
];

/** True when `table` already has `column`. Use this to guard ALTER TABLE adds. */
export function hasColumn(db, table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((r) => r.name === column);
}

export function hasTable(db, table) {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(table);
  return Boolean(row);
}

export function currentVersion(db) {
  db.exec(MIGRATIONS_TABLE);
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get();
  return row?.v ?? 0;
}

export function appliedMigrations(db) {
  db.exec(MIGRATIONS_TABLE);
  return db.prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all();
}

/**
 * Apply every migration newer than the recorded version.
 * Returns { from, to, applied: [names] }.
 */
export function migrate(db) {
  db.exec(MIGRATIONS_TABLE);
  const from = currentVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > from).sort((a, b) => a.version - b.version);
  const applied = [];

  for (const m of pending) {
    const run = db.transaction(() => {
      m.up(db);
      db.prepare('INSERT OR REPLACE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(m.version, m.name, Date.now());
    });
    run();
    applied.push(m.name);
    log.info('migration applied', { version: m.version, name: m.name });
  }

  const to = currentVersion(db);
  return { from, to, applied };
}

/**
 * Post-migration self-check: every table the contract names must exist.
 * `doctor` surfaces the result; the tests assert on it.
 */
export function verifySchema(db) {
  const missing = CONTRACT_TABLES.filter((t) => !hasTable(db, t));
  return { ok: missing.length === 0, missing };
}
