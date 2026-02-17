import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbFilePath = join(__dirname, 'admin.db');

logger.warn('sqlite.module_loaded', {
  dbFilePath,
  cwd: process.cwd(),
  isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
});

const db = new Database(dbFilePath);

logger.warn('sqlite.connection_opened', {
  dbFilePath,
});

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initializeDatabase() {
  const initLog = logger.child({ dbFilePath });
  initLog.warn('sqlite.initialize.start');

  // Admin users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Areas table
  db.exec(`
    CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Buildings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS buildings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      area_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
    )
  `);

  // Documents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_type TEXT NOT NULL,
      s3_key TEXT NOT NULL,
      file_size INTEGER,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for search
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_buildings_name ON buildings(name);
    CREATE INDEX IF NOT EXISTS idx_buildings_customer ON buildings(customer_name);
    CREATE INDEX IF NOT EXISTS idx_buildings_area ON buildings(area_id);
  `);

  // Create default admin if not exists
  const adminExists = db.prepare('SELECT id FROM admins WHERE username = ?')
    .get(process.env.DEFAULT_ADMIN_USERNAME || 'admin');
  
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync(
      process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 
      10
    );
    db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)')
      .run(process.env.DEFAULT_ADMIN_USERNAME || 'admin', hashedPassword);
    initLog.warn('sqlite.initialize.default_admin_created', {
      username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
    });
  }

  initLog.warn('sqlite.initialize.end');
}

export default db;
