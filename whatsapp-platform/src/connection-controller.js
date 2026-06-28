/**
 * Connection Controller Module (P1.6)
 * 
 * Centralized controller orchestrating all P1 modules:
 * - PreKey recovery
 * - Auth store (credential backup)
 * - Crypto error detection
 * - Connection watchdog
 * - Reconnect policy
 * - Connection state machine
 * 
 * Provides unified interface for connection lifecycle management
 */

import PreKeyRecoveryManager from './prekey-recovery.js';
import AuthStore from './auth-store.js';
import CryptoErrorDetector from './crypto-error-detector.js';
import ConnectionWatchdog from './watchdog.js';
import ReconnectPolicy from './reconnect-policy.js';
import ConnectionStateMachine, { STATES } from './connection-state.js';
import PendingDeliveriesQueue from './pending-deliveries.js';
import { softResetSession } from './auth-state-utils.js';
import { logger } from './logger.js';
import { SOFT_RESET_MAX_RETRIES, PREKEY_ROTATION_INTERVAL_MS } from './config.js';

/**
 * Unified connection controller
 */
export class ConnectionController {
  constructor(phone, socket, options = {}) {
    this.phone = phone;
    this.socket = socket;

    // Initialize all sub-modules
    this.preKeyRecovery = new PreKeyRecoveryManager(socket, phone);
    this.authStore = new AuthStore(phone);
    this.cryptoErrorDetector = new CryptoErrorDetector(phone);
    this.watchdog = new ConnectionWatchdog(phone, options.watchdog);
    this.reconnectPolicy = new ReconnectPolicy(options.reconnect);
    this.stateMachine = new ConnectionStateMachine(phone);
    this.pendingDeliveries = new PendingDeliveriesQueue(phone, options.pendingDeliveries);

    this.softResetRetries = 0;
    this.preKeyRotationTimer = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the controller
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;

    // Transition to connecting state
    this.stateMachine.transition(STATES.CONNECTING);

    // Setup watchdog
    this.watchdog.start(() => this.handleStaleConnection());

    // Setup state machine callbacks
    this.setupStateCallbacks();

    this.isInitialized = true;
    logger.info({ phone: this.phone }, 'connection_controller.initialized');
  }

  /**
   * Setup state machine callbacks
   */
  setupStateCallbacks() {
    // On successful connection — listen for ANY transition to CONNECTED
    // (Baileys emits 'open' directly, bypassing AUTHENTICATING)
    this.stateMachine.onTransition('*', STATES.CONNECTED, async () => {
      this.preKeyRecovery.reset();
      this.cryptoErrorDetector.reset();
      this.softResetRetries = 0;
      this.reconnectPolicy.recordAttempt(true);
      this.watchdog.recordActivity();
      // Backup credentials on successful connection
      if (this.socket?.authState?.creds) {
        try {
          await this.authStore.backupCredentials(this.socket.authState);
        } catch (err) {
          logger.warn({ phone: this.phone, error: err.message }, 'connection_controller.backup_failed');
        }
      }
      // Drain pending deliveries queue (will be called by baileysClient)
    });

    // On disconnection
    this.stateMachine.onTransition(STATES.CONNECTED, STATES.DISCONNECTED, () => {
      this.watchdog.stop();
      this.stopPreKeyRotation();
    });

    // Start proactive pre-key rotation when connected
    this.stateMachine.onTransition('*', STATES.CONNECTED, () => {
      this.startPreKeyRotation();
    });
  }

  /**
   * Start a periodic proactive pre-key rotation timer.
   * This prevents pre-key exhaustion that leads to Invalid PreKey ID errors.
   */
  startPreKeyRotation() {
    this.stopPreKeyRotation();
    this.preKeyRotationTimer = setInterval(() => {
      this.performPreKeyRotation();
    }, PREKEY_ROTATION_INTERVAL_MS);
    if (this.preKeyRotationTimer && typeof this.preKeyRotationTimer.unref === 'function') {
      this.preKeyRotationTimer.unref();
    }
    logger.debug({ phone: this.phone, intervalMs: PREKEY_ROTATION_INTERVAL_MS }, 'connection_controller.prekey_rotation.started');
  }

  /**
   * Stop the proactive pre-key rotation timer.
   */
  stopPreKeyRotation() {
    if (this.preKeyRotationTimer) {
      clearInterval(this.preKeyRotationTimer);
      this.preKeyRotationTimer = null;
    }
  }

  /**
   * Perform a single proactive pre-key rotation if connected.
   */
  async performPreKeyRotation() {
    if (!this.isConnected()) {
      return;
    }
    if (this.preKeyRecovery.shouldRotatePreKeys()) {
      logger.info({ phone: this.phone }, 'connection_controller.prekey_rotation.attempt');
      try {
        await this.preKeyRecovery.rotatePreKeys();
      } catch (err) {
        logger.warn({ phone: this.phone, error: err.message }, 'connection_controller.prekey_rotation.failed');
      }
    }
  }

  /**
   * Handle incoming message (record activity)
   */
  handleIncomingMessage() {
    this.watchdog.recordActivity();
  }

  /**
   * Handle outgoing message (record activity)
   */
  handleOutgoingMessage() {
    this.watchdog.recordActivity();
  }

  /**
   * Record any activity (incoming/outgoing messages, health probe success, etc.)
   * to keep the watchdog from treating the connection as stale.
   */
  recordActivity() {
    this.watchdog.recordActivity();
  }

  /**
   * Handle crypto error
   * @param {Error} error
   * @returns {Promise<boolean>} true if recovery succeeded
   */
  async handleCryptoError(error) {
    const analysis = this.cryptoErrorDetector.analyzeError(error);

    // Check if PreKey exhaustion requires a fresh re-link
    if (this.preKeyRecovery.needsFreshLink()) {
      logger.error({ phone: this.phone }, 'connection_controller.fresh_link_required');
      this.stateMachine.transition(STATES.FRESH_LINK_REQUIRED, { error: analysis });
      return false;
    }

    if (analysis.severity === 'critical') {
      // Critical errors require immediate action
      this.stateMachine.transition(STATES.ERROR, { error: analysis });
      return false;
    }

    // Attempt recovery based on error type
    const recovered = await this.preKeyRecovery.attemptRecovery(error);
    if (recovered) {
      this.softResetRetries = 0;
      return true;
    }

    if (analysis.severity === 'high') {
      // Check if exhaustion was detected during recovery
      if (this.preKeyRecovery.needsFreshLink()) {
        this.stateMachine.transition(STATES.FRESH_LINK_REQUIRED, { error: analysis });
        return false;
      }

      // Try a soft session reset before giving up.  This preserves the
      // WhatsApp device pairing and only rebuilds the Signal session state.
      if (this.softResetRetries < SOFT_RESET_MAX_RETRIES) {
        this.softResetRetries++;
        logger.warn(
          { phone: this.phone, attempt: this.softResetRetries, errorType: analysis.errorType },
          'connection_controller.soft_reset.attempt'
        );
        const resetResult = await softResetSession(this.phone);
        if (resetResult.error) {
          logger.error(
            { phone: this.phone, error: resetResult.error },
            'connection_controller.soft_reset.failed'
          );
        } else {
          logger.info(
            { phone: this.phone, deleted: resetResult.deleted.length },
            'connection_controller.soft_reset.success'
          );
        }
        // Force a reconnect so the next session picks up the clean state.
        this.stateMachine.transition(STATES.RECONNECTING, { reason: 'soft_reset_after_crypto_error', error: analysis });
        if (this.socket && typeof this.socket.end === 'function') {
          try {
            this.socket.end();
          } catch (endErr) {
            logger.warn({ phone: this.phone, error: endErr.message }, 'connection_controller.soft_reset.end_failed');
          }
        }
        return false;
      }

      this.stateMachine.transition(STATES.RECONNECTING, { error: analysis });
    }

    return recovered;
  }

  /**
   * Handle stale connection detection. The watchdog only fires when there has
   * been no activity for the configured timeout. We close the socket so the
   * Baileys 'connection.update' close event fires and the existing reconnect
   * logic in baileysClient.js takes over. This prevents messages from being
   * queued forever while the socket is silently stuck.
   */
  async handleStaleConnection() {
    logger.warn({ phone: this.phone }, 'connection_controller.stale_connection');
    this.stateMachine.transition(STATES.RECONNECTING, { reason: 'stale_connection' });
    // Force the socket to end. baileysClient.js will see the 'close' event
    // and schedule a reconnect using this controller's reconnect policy.
    if (this.socket && typeof this.socket.end === 'function') {
      try {
        this.socket.end();
        logger.info({ phone: this.phone }, 'connection_controller.socket.end.stale');
      } catch (err) {
        logger.warn({ phone: this.phone, error: err.message }, 'connection_controller.socket.end_failed');
      }
    }
  }

  /**
   * Handle connection update
   * @param {string} newState
   */
  handleConnectionUpdate(newState) {
    switch (newState) {
      case 'open':
        // Transition to AUTHENTICATING first, then CONNECTED, so callbacks fire correctly
        if (this.stateMachine.isInState(STATES.CONNECTING)) {
          this.stateMachine.transition(STATES.AUTHENTICATING);
        }
        if (!this.stateMachine.transition(STATES.CONNECTED)) {
          // If direct transition fails, force it via ERROR->CONNECTED path
          logger.warn({ phone: this.phone, currentState: this.stateMachine.getState() }, 'connection_controller.transition_failed_open');
        }
        break;
      case 'connecting':
        if (!this.stateMachine.transition(STATES.CONNECTING)) {
          logger.warn({ phone: this.phone, currentState: this.stateMachine.getState() }, 'connection_controller.transition_failed_connecting');
        }
        break;
      case 'close':
        if (!this.stateMachine.transition(STATES.DISCONNECTED)) {
          logger.warn({ phone: this.phone, currentState: this.stateMachine.getState() }, 'connection_controller.transition_failed_close');
        }
        break;
    }
  }

  /**
   * Get next reconnection delay
   * @returns {number} milliseconds
   */
  getNextReconnectDelay() {
    return this.reconnectPolicy.getNextDelay();
  }

  /**
   * Record reconnection attempt
   * @param {boolean} success
   * @param {Error} error
   */
  recordReconnectAttempt(success, error = null) {
    this.reconnectPolicy.recordAttempt(success, error);
  }

  /**
   * Check if should continue retrying
   * @returns {boolean}
   */
  shouldRetry() {
    return this.reconnectPolicy.shouldRetry();
  }

  /**
   * Get current state
   * @returns {string}
   */
  getState() {
    return this.stateMachine.getState();
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this.stateMachine.isConnected();
  }

  /**
   * Check if can accept messages
   * @returns {boolean}
   */
  canAcceptMessages() {
    return this.stateMachine.canAcceptMessages();
  }

  /**
   * Get comprehensive diagnostics
   * @returns {Object}
   */
  async getDiagnostics() {
    return {
      phone: this.phone,
      state: this.stateMachine.getDiagnostics(),
      preKeyRecovery: {
        attemptCount: this.preKeyRecovery.attemptCount,
        exhausted: this.preKeyRecovery.preKeyState.exhausted,
      },
      cryptoErrors: this.cryptoErrorDetector.getDiagnostics(),
      watchdog: this.watchdog.getDiagnostics(),
      reconnectPolicy: this.reconnectPolicy.getDiagnostics(),
      authStore: {
        hasBackup: await this.authStore.hasBackup(),
        backupMetadata: await this.authStore.getBackupMetadata(),
      },
    };
  }

  /**
   * Shutdown the controller
   */
  shutdown() {
    this.watchdog.stop();
    this.stopPreKeyRotation();
    this.pendingDeliveries.clear();
    this.stateMachine.transition(STATES.TERMINATED);
    logger.info({ phone: this.phone }, 'connection_controller.shutdown');
  }

  /**
   * Update the socket reference (called when a new socket is created)
   * @param {Object} newSocket
   */
  updateSocket(newSocket) {
    this.socket = newSocket;
    // Propagate socket to sub-modules that need it
    this.preKeyRecovery.socket = newSocket;
    logger.debug({ phone: this.phone }, 'connection_controller.socket.updated');
  }

  /**
   * Check if the current socket is valid and connected
   * @returns {boolean}
   */
  isSocketValid() {
    return this.socket !== null && this.stateMachine.isConnected();
  }

  /**
   * Check if there are pending deliveries in the queue
   * @returns {boolean}
   */
  hasPendingDeliveries() {
    return !this.pendingDeliveries.isEmpty();
  }

  /**
   * Drain pending deliveries queue
   * @param {Function} sendFn - Function to send messages
   * @returns {Promise<{ success: number, failed: number }>}
   */
  async drainPendingDeliveries(sendFn) {
    return await this.pendingDeliveries.drain(sendFn);
  }

  /**
   * Add a message to pending deliveries queue
   * @param {string} id
   * @param {string} to
   * @param {string} text
   * @param {Object} media
   * @returns {boolean}
   */
  enqueuePendingDelivery(id, to, text, media = null) {
    return this.pendingDeliveries.enqueue(id, this.phone, to, text, media);
  }

  /**
   * Get pending deliveries queue size
   * @returns {number}
   */
  getPendingDeliveriesSize() {
    return this.pendingDeliveries.size();
  }
}

export default ConnectionController;
