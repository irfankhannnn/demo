/**
 * Connection State Module (P1.5)
 * 
 * Implements a formal state machine for connection lifecycle:
 * - Defines valid state transitions
 * - Enforces state invariants
 * - Tracks state history
 * - Provides state-based decision making
 */

import { logger } from './logger.js';

/**
 * Valid connection states
 */
export const STATES = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  WAITING_QR: 'waiting_qr',
  AUTHENTICATING: 'authenticating',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  FRESH_LINK_REQUIRED: 'fresh_link_required',
  CONFLICT: 'conflict',
  LOGGED_OUT: 'logged_out',
  TERMINATED: 'terminated',
};

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS = {
  [STATES.IDLE]: [STATES.CONNECTING, STATES.TERMINATED],
  [STATES.CONNECTING]: [STATES.WAITING_QR, STATES.AUTHENTICATING, STATES.ERROR, STATES.DISCONNECTED],
  [STATES.WAITING_QR]: [STATES.AUTHENTICATING, STATES.ERROR, STATES.DISCONNECTED],
  [STATES.AUTHENTICATING]: [STATES.CONNECTED, STATES.ERROR, STATES.DISCONNECTED],
  [STATES.CONNECTED]: [STATES.RECONNECTING, STATES.CONNECTING, STATES.DISCONNECTED, STATES.ERROR, STATES.FRESH_LINK_REQUIRED, STATES.CONFLICT, STATES.LOGGED_OUT],
  [STATES.RECONNECTING]: [STATES.CONNECTED, STATES.CONNECTING, STATES.ERROR, STATES.DISCONNECTED, STATES.FRESH_LINK_REQUIRED],
  [STATES.DISCONNECTED]: [STATES.RECONNECTING, STATES.CONNECTING, STATES.TERMINATED, STATES.FRESH_LINK_REQUIRED],
  [STATES.ERROR]: [STATES.RECONNECTING, STATES.CONNECTING, STATES.DISCONNECTED, STATES.TERMINATED, STATES.FRESH_LINK_REQUIRED],
  [STATES.FRESH_LINK_REQUIRED]: [STATES.CONNECTING, STATES.TERMINATED],
  [STATES.CONFLICT]: [STATES.TERMINATED],
  [STATES.LOGGED_OUT]: [STATES.TERMINATED],
  [STATES.TERMINATED]: [],
};

/**
 * Connection state machine
 */
export class ConnectionStateMachine {
  constructor(phone) {
    this.phone = phone;
    this.currentState = STATES.IDLE;
    this.previousState = null;
    this.stateHistory = [];
    this.stateMetadata = {};
    this.transitionCallbacks = {};
  }

  /**
   * Transition to a new state
   * @param {string} newState
   * @param {Object} metadata
   * @returns {boolean} true if transition was successful
   */
  transition(newState, metadata = {}) {
    if (!VALID_TRANSITIONS[this.currentState]?.includes(newState)) {
      logger.warn(
        {
          phone: this.phone,
          from: this.currentState,
          to: newState,
          validTransitions: VALID_TRANSITIONS[this.currentState],
        },
        'connection_state.invalid_transition'
      );
      return false;
    }

    const oldState = this.currentState;
    this.previousState = oldState;
    this.currentState = newState;
    this.stateMetadata = {
      ...metadata,
      timestamp: new Date().toISOString(),
      duration: this.getStateDuration(),
    };

    // Track in history
    this.stateHistory.push({
      from: oldState,
      to: newState,
      timestamp: this.stateMetadata.timestamp,
      metadata,
    });

    // Limit history size
    if (this.stateHistory.length > 100) {
      this.stateHistory.shift();
    }

    logger.info(
      {
        phone: this.phone,
        from: oldState,
        to: newState,
        metadata,
      },
      'connection_state.transition'
    );

    // Execute callbacks
    this.executeCallbacks(oldState, newState, metadata);

    return true;
  }

  /**
   * Register a callback for state transitions
   * @param {string} fromState
   * @param {string} toState
   * @param {Function} callback
   */
  onTransition(fromState, toState, callback) {
    const key = `${fromState}->${toState}`;
    if (!this.transitionCallbacks[key]) {
      this.transitionCallbacks[key] = [];
    }
    this.transitionCallbacks[key].push(callback);
  }

  /**
   * Execute registered callbacks
   */
  executeCallbacks(fromState, toState, metadata) {
    const exactKey = `${fromState}->${toState}`;
    const wildcardKey = `*->${toState}`;
    const callbacks = [
      ...(this.transitionCallbacks[exactKey] || []),
      ...(this.transitionCallbacks[wildcardKey] || []),
    ];
    callbacks.forEach(cb => {
      try {
        cb(metadata);
      } catch (err) {
        logger.error(
          { phone: this.phone, error: err.message },
          'connection_state.callback_error'
        );
      }
    });
  }

  /**
   * Get current state
   * @returns {string}
   */
  getState() {
    return this.currentState;
  }

  /**
   * Check if in a specific state
   * @param {string} state
   * @returns {boolean}
   */
  isInState(state) {
    return this.currentState === state;
  }

  /**
   * Check if connected (in CONNECTED state)
   * @returns {boolean}
   */
  isConnected() {
    return this.currentState === STATES.CONNECTED;
  }

  /**
   * Check if can accept messages (in CONNECTED state)
   * @returns {boolean}
   */
  canAcceptMessages() {
    return this.currentState === STATES.CONNECTED;
  }

  /**
   * Get time spent in current state
   * @returns {number} milliseconds
   */
  getStateDuration() {
    if (this.stateHistory.length === 0) return 0;
    const lastTransition = this.stateHistory[this.stateHistory.length - 1];
    return Date.now() - new Date(lastTransition.timestamp).getTime();
  }

  /**
   * Get state history
   * @returns {Array}
   */
  getHistory() {
    return this.stateHistory;
  }

  /**
   * Get current state details
   * @returns {Object}
   */
  getStateDetails() {
    return {
      phone: this.phone,
      currentState: this.currentState,
      previousState: this.previousState,
      duration: this.getStateDuration(),
      metadata: this.stateMetadata,
      validNextStates: VALID_TRANSITIONS[this.currentState],
    };
  }

  /**
   * Get diagnostics
   * @returns {Object}
   */
  getDiagnostics() {
    return {
      ...this.getStateDetails(),
      history: this.stateHistory.slice(-10),
      totalTransitions: this.stateHistory.length,
    };
  }

  /**
   * Reset state machine (for testing)
   */
  reset() {
    this.currentState = STATES.IDLE;
    this.previousState = null;
    this.stateHistory = [];
    this.stateMetadata = {};
    logger.debug({ phone: this.phone }, 'connection_state.reset');
  }
}

export default ConnectionStateMachine;
