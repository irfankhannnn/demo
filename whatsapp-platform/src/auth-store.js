/**
 * Auth Store Module (P1.1)
 * 
 * Handles credential backup and restoration:
 * - Encrypts and stores credentials locally
 * - Provides recovery mechanism for lost credentials
 * - Tracks credential state and validity
 * - Implements credential rotation
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from './logger.js';

const BACKUP_DIR = process.env.AUTH_BACKUP_DIR || './auth-backups';
const ENCRYPTION_KEY = process.env.AUTH_ENCRYPTION_KEY || '';

/**
 * Derive a key from the encryption key and a salt using scrypt
 * @param {string} encryptionKey
 * @param {Buffer} salt
 * @returns {Buffer} 32-byte derived key
 */
function deriveKey(encryptionKey, salt) {
  return crypto.scryptSync(encryptionKey, salt, 32);
}

/**
 * Encrypt credentials using AES-256-GCM with a random salt per encryption
 * @param {Object} credentials
 * @param {string} encryptionKey
 * @returns {string} encrypted and base64-encoded credentials
 */
function encryptCredentials(credentials, encryptionKey) {
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    deriveKey(encryptionKey, salt),
    iv
  );

  let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted,
  });
}

/**
 * Decrypt credentials
 * @param {string} encryptedData
 * @param {string} encryptionKey
 * @returns {Object|null} decrypted credentials or null if decryption fails
 */
function decryptCredentials(encryptedData, encryptionKey) {
  try {
    const { iv, salt, authTag, data } = JSON.parse(encryptedData);
    // Support both old format (no salt — fixed 'salt' string) and new format
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : Buffer.from('salt');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      deriveKey(encryptionKey, saltBuffer),
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (err) {
    logger.warn({ error: err.message }, 'auth_store.decrypt.failed');
    return null;
  }
}

/**
 * Credential backup and restoration manager
 */
export class AuthStore {
  constructor(phone) {
    this.phone = phone;
    this.backupPath = path.join(BACKUP_DIR, `${phone}-backup.json`);
  }

  /**
   * Backup credentials to encrypted file
   * @param {Object} credentials
   * @returns {Promise<boolean>}
   */
  async backupCredentials(credentials) {
    if (!ENCRYPTION_KEY) {
      logger.error({ phone: this.phone }, 'auth_store.backup.no_key');
      return false;
    }
    try {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
      const encrypted = encryptCredentials(credentials, ENCRYPTION_KEY);
      const backup = {
        phone: this.phone,
        timestamp: new Date().toISOString(),
        data: encrypted,
      };
      // Atomic write: write to temp file then rename
      const tempPath = `${this.backupPath}.tmp.${Date.now()}`;
      await fs.writeFile(tempPath, JSON.stringify(backup, null, 2), 'utf-8');
      await fs.rename(tempPath, this.backupPath);
      logger.info({ phone: this.phone }, 'auth_store.backup.success');
      return true;
    } catch (err) {
      logger.error({ phone: this.phone, error: err.message }, 'auth_store.backup.failed');
      return false;
    }
  }

  /**
   * Restore credentials from backup
   * @param {Object} options - { allowStale: boolean }
   * @returns {Promise<Object|null>}
   */
  async restoreCredentials({ allowStale = false } = {}) {
    if (!ENCRYPTION_KEY) {
      logger.error({ phone: this.phone }, 'auth_store.restore.no_key');
      return null;
    }
    try {
      const backupData = await fs.readFile(this.backupPath, 'utf-8');
      const backup = JSON.parse(backupData);

      // Check staleness
      if (!allowStale && await this.isStale()) {
        logger.warn({ phone: this.phone }, 'auth_store.restore.stale_backup');
        return null;
      }

      const credentials = decryptCredentials(backup.data, ENCRYPTION_KEY);
      if (credentials) {
        logger.info({ phone: this.phone }, 'auth_store.restore.success');
        return credentials;
      }
    } catch (err) {
      logger.warn({ phone: this.phone, error: err.message }, 'auth_store.restore.failed');
    }
    return null;
  }

  /**
   * Check if backup exists
   * @returns {Promise<boolean>}
   */
  async hasBackup() {
    try {
      await fs.access(this.backupPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get backup metadata
   * @returns {Promise<Object|null>}
   */
  async getBackupMetadata() {
    try {
      const backupData = await fs.readFile(this.backupPath, 'utf-8');
      const backup = JSON.parse(backupData);
      return {
        phone: backup.phone,
        timestamp: backup.timestamp,
        age: Date.now() - new Date(backup.timestamp).getTime(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Delete backup
   * @returns {Promise<boolean>}
   */
  async deleteBackup() {
    try {
      await fs.unlink(this.backupPath);
      logger.info({ phone: this.phone }, 'auth_store.backup.deleted');
      return true;
    } catch (err) {
      logger.warn({ phone: this.phone, error: err.message }, 'auth_store.backup.delete_failed');
      return false;
    }
  }

  /**
   * Validate credential integrity
   * @param {Object} credentials
   * @returns {boolean}
   */
  validateCredentials(credentials) {
    if (!credentials) return false;
    // Check for required fields in Baileys credentials
    const requiredFields = ['creds', 'keys'];
    return requiredFields.every(field => field in credentials);
  }

  /**
   * Check if credentials are stale (older than threshold)
   * @param {number} maxAgeMs - maximum age in milliseconds (default: 30 days)
   * @returns {Promise<boolean>}
   */
  async isStale(maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
    const metadata = await this.getBackupMetadata();
    if (!metadata) return true;
    return metadata.age > maxAgeMs;
  }
}

export default AuthStore;
