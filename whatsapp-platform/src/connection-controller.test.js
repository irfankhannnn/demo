import { ConnectionController } from './connection-controller.js';
import { jest } from '@jest/globals';

describe('crypto recovery safety', () => {
  test('does not close or erase a session after a failed crypto recovery', async () => {
    const socket = { end: jest.fn() };
    const controller = new ConnectionController('919999999999', socket);
    await controller.initialize();

    await controller.handleCryptoError(new Error('bad mac'));

    expect(socket.end).not.toHaveBeenCalled();
    controller.shutdown();
  });
});
