/**
 * Unit tests for ConnectionController robustness features.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock auth-state-utils before importing ConnectionController so soft reset
// does not touch the real auth_state filesystem.
jest.unstable_mockModule('../src/auth-state-utils.js', () => ({
  softResetSession: jest.fn().mockResolvedValue({ error: null, deleted: [], preserved: [] }),
  backupCredsJsonAtomically: jest.fn().mockResolvedValue(true),
  restoreCredsFromBackup: jest.fn().mockResolvedValue(false),
}));

const { ConnectionController } = await import('../src/connection-controller.js');
const { softResetSession } = await import('../src/auth-state-utils.js');

/**
 * Build a fake socket with the methods ConnectionController needs.
 */
function createFakeSocket() {
  return {
    end: jest.fn(),
    authState: { creds: { me: { id: '918291537522@s.whatsapp.net' } } },
    uploadPreKeysToServerIfRequired: jest.fn().mockResolvedValue(undefined),
  };
}

jest.useFakeTimers();

describe('ConnectionController', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.clearAllTimers();
  });

  test('proactive pre-key rotation timer is started on open', async () => {
    const socket = createFakeSocket();
    const controller = new ConnectionController('918291537522', socket);
    await controller.initialize();

    controller.handleConnectionUpdate('open');
    expect(controller.preKeyRotationTimer).not.toBeNull();

    controller.shutdown();
    expect(controller.preKeyRotationTimer).toBeNull();
  });

  test('proactive pre-key rotation is performed when threshold is crossed', async () => {
    const socket = createFakeSocket();
    const controller = new ConnectionController('918291537522', socket);
    await controller.initialize();
    controller.handleConnectionUpdate('open');

    controller.preKeyRecovery.preKeyState.available = 5; // below threshold
    await controller.performPreKeyRotation();

    expect(socket.uploadPreKeysToServerIfRequired).toHaveBeenCalled();

    controller.shutdown();
  });

  test('soft reset is triggered after repeated high-severity crypto errors', async () => {
    const socket = createFakeSocket();
    delete socket.uploadPreKeysToServerIfRequired;
    const controller = new ConnectionController('918291537522', socket);
    await controller.initialize();
    controller.handleConnectionUpdate('open');

    const error = new Error('Bad MAC: no matching session');
    const result = await controller.handleCryptoError(error);

    // Should transition to reconnecting and force socket.end
    expect(result).toBe(false);
    expect(socket.end).toHaveBeenCalled();
    expect(controller.getState()).toMatch(/reconnecting|error/i);

    // Should have invoked the soft reset helper without touching the real FS
    expect(softResetSession).toHaveBeenCalledWith('918291537522');

    controller.shutdown();
  });
});
