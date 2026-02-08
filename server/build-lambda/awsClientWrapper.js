import { logger } from './logger.js';

export function wrapAwsClient(client, clientName, extra = {}) {
  const base = logger.child({ client: clientName, ...(extra || {}) });

  return new Proxy(client, {
    get(target, prop) {
      const value = target[prop];
      if (prop !== 'send' || typeof value !== 'function') {
        return typeof value === 'function' ? value.bind(target) : value;
      }

      return async (command, options) => {
        const commandName = command?.constructor?.name || 'UnknownCommand';
        return base.span('aws.send', { command: commandName }, async () => {
          try {
            return await value.call(target, command, options);
          } catch (err) {
            err.service = err.service || clientName;
            err.command = err.command || commandName;
            throw err;
          }
        });
      };
    },
  });
}
