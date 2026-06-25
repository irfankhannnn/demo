/**
 * PreKey Recovery Module (P1.0)
 * 
 * Handles PreKey exhaustion errors and implements recovery strategies:
 * - Detects PreKeyError: Invalid PreKey ID
 * - Implements PreKey rotation on demand
 * - Tracks PreKey state and usage
 * - Provides fallback mechanisms for exhaustion
 */

import { logger } from './logger.js';

const MAX_PREKEY_ATTEMPTS = 3;
const PREKEY_ROTATION_THRESHOLD = 10; // Rotate when < 10 keys remaining

/**
 * Check if an error is a PreKey-related error
 * @param {Error} error
 * @returns {boolean}
 */
export function isPreKeyError(error) {
  if (!error) return false;
  const message = String(error.message || error).toLowerCase();
  return (
    message.includes('invalid prekey id') ||
    message.includes('prekey exhausted') ||
    message.includes('prekey bundle') ||
    message.includes('bad mac') ||
    message.includes('no matching sessions') ||
    message.includes('session not found')
  );
}

/**
 * Classify PreKey error type
 * @param {Error} error
 * @returns {'invalid_id' | 'exhausted' | 'bad_mac' | 'unknown'}
 */
export function classifyPreKeyError(error) {
  const message = String(error.message || error).toLowerCase();
  if (message.includes('invalid prekey id')) return 'invalid_id';
  if (message.includes('exhausted')) return 'exhausted';
  if (message.includes('bad mac')) return 'bad_mac';
  return 'unknown';
}

/**
 * PreKey recovery strategy executor
 * Attempts to recover from PreKey errors with escalating strategies
 */
export class PreKeyRecoveryManager {
  constructor(socket, phone) {
    this.socket = socket;
    this.phone = phone;
    this.attemptCount = 0;
    this.lastRotationTime = null;
    this.preKeyState = {
      available: 0,
      used: 0,
      exhausted: false,
    };
  }

  /**
   * Attempt recovery from a PreKey error
   * @param {Error} error
   * @returns {Promise<boolean>} true if recovery succeeded
   */
  async attemptRecovery(error) {
    const errorType = classifyPreKeyError(error);
    logger.warn(
      { phone: this.phone, errorType, attempt: this.attemptCount + 1 },
      'prekey.recovery.attempt'
    );

    if (this.attemptCount >= MAX_PREKEY_ATTEMPTS) {
      logger.error(
        { phone: this.phone, attempts: MAX_PREKEY_ATTEMPTS },
        'prekey.recovery.exhausted'
      );
      return false;
    }

    this.attemptCount++;

    try {
      switch (errorType) {
        case 'invalid_id':
          return await this.recoverFromInvalidId();
        case 'exhausted':
          return await this.recoverFromExhaustion();
        case 'bad_mac':
          return await this.recoverFromBadMac();
        default:
          return await this.recoverFromUnknown();
      }
    } catch (recoveryErr) {
      logger.error(
        { phone: this.phone, error: recoveryErr.message },
        'prekey.recovery.failed'
      );
      return false;
    }
  }

  /**
   * Recover from invalid PreKey ID error
   * Strategy: Request new PreKeys from server
   */
  async recoverFromInvalidId() {
    logger.info({ phone: this.phone }, 'prekey.recovery.invalid_id.start');
    try {
      // Use uploadPreKeysToServerIfRequired if available (preferred), else uploadPreKeys
      if (this.socket?.uploadPreKeysToServerIfRequired) {
        await this.socket.uploadPreKeysToServerIfRequired();
        this.preKeyState.available = 50; // Reset to expected count
        logger.info({ phone: this.phone }, 'prekey.recovery.invalid_id.success');
        return true;
      }
      if (this.socket?.uploadPreKeys) {
        await this.socket.uploadPreKeys();
        this.preKeyState.available = 50;
        logger.info({ phone: this.phone }, 'prekey.recovery.invalid_id.success');
        return true;
      }
    } catch (err) {
      logger.warn({ phone: this.phone, error: err.message }, 'prekey.recovery.invalid_id.failed');
    }
    return false;
  }

  /**
   * Recover from PreKey exhaustion
   * Strategy: Signal that a full re-link is needed (handled by connection controller)
   */
  async recoverFromExhaustion() {
    logger.info({ phone: this.phone }, 'prekey.recovery.exhaustion.start');
    this.preKeyState.exhausted = true;
    // Return false to signal that a full re-link is needed.
    // The connection controller will transition to FRESH_LINK_REQUIRED state.
    return false;
  }

  /**
   * Recover from Bad MAC error (decryption failure)
   * Strategy: Refresh session by requesting new PreKeys
   */
  async recoverFromBadMac() {
    logger.info({ phone: this.phone }, 'prekey.recovery.bad_mac.start');
    try {
      if (this.socket?.uploadPreKeysToServerIfRequired) {
        await this.socket.uploadPreKeysToServerIfRequired();
        logger.info({ phone: this.phone }, 'prekey.recovery.bad_mac.success');
        return true;
      }
      if (this.socket?.uploadPreKeys) {
        await this.socket.uploadPreKeys();
        logger.info({ phone: this.phone }, 'prekey.recovery.bad_mac.success');
        return true;
      }
    } catch (err) {
      logger.warn({ phone: this.phone, error: err.message }, 'prekey.recovery.bad_mac.failed');
    }
    return false;
  }

  /**
   * Recover from unknown PreKey error
   * Strategy: Attempt PreKey rotation
   */
  async recoverFromUnknown() {
    logger.info({ phone: this.phone }, 'prekey.recovery.unknown.start');
    try {
      if (this.socket?.uploadPreKeysToServerIfRequired) {
        await this.socket.uploadPreKeysToServerIfRequired();
        logger.info({ phone: this.phone }, 'prekey.recovery.unknown.success');
        return true;
      }
      if (this.socket?.uploadPreKeys) {
        await this.socket.uploadPreKeys();
        logger.info({ phone: this.phone }, 'prekey.recovery.unknown.success');
        return true;
      }
    } catch (err) {
      logger.warn({ phone: this.phone, error: err.message }, 'prekey.recovery.unknown.failed');
    }
    return false;
  }

  /**
   * Check if PreKey rotation is needed
   * @returns {boolean}
   */
  shouldRotatePreKeys() {
    const now = Date.now();
    const timeSinceLastRotation = this.lastRotationTime ? now - this.lastRotationTime : Infinity;
    // Rotate if: (1) never rotated, or (2) 24 hours have passed, or (3) < 10 keys available
    return timeSinceLastRotation > 24 * 60 * 60 * 1000 || this.preKeyState.available < PREKEY_ROTATION_THRESHOLD;
  }

  /**
   * Perform proactive PreKey rotation
   */
  async rotatePreKeys() {
    logger.info({ phone: this.phone }, 'prekey.rotation.start');
    try {
      if (this.socket?.uploadPreKeysToServerIfRequired) {
        await this.socket.uploadPreKeysToServerIfRequired();
        this.lastRotationTime = Date.now();
        this.attemptCount = 0;
        this.preKeyState.available = 50;
        logger.info({ phone: this.phone }, 'prekey.rotation.success');
        return true;
      }
      if (this.socket?.uploadPreKeys) {
        await this.socket.uploadPreKeys();
        this.lastRotationTime = Date.now();
        this.attemptCount = 0;
        this.preKeyState.available = 50;
        logger.info({ phone: this.phone }, 'prekey.rotation.success');
        return true;
      }
    } catch (err) {
      logger.warn({ phone: this.phone, error: err.message }, 'prekey.rotation.failed');
    }
    return false;
  }

  /**
   * Check if a fresh re-link is required (PreKey exhaustion)
   * @returns {boolean}
   */
  needsFreshLink() {
    return this.preKeyState.exhausted;
  }

  /**
   * Reset recovery state (called on successful connection)
   */
  reset() {
    this.attemptCount = 0;
    this.preKeyState.exhausted = false;
    logger.debug({ phone: this.phone }, 'prekey.recovery.reset');
  }
}

export default PreKeyRecoveryManager;
