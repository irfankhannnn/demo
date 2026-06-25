import pino from 'pino';
import { LOG_LEVEL } from './config.js';

export const logger = pino({
  level: LOG_LEVEL,
  base: { service: 'baileys-service' },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

export default logger;
