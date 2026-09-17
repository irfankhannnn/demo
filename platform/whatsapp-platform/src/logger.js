import pino from 'pino';
import { LOG_LEVEL } from './config.js';

export const logger = pino({
  name: 'whatsapp-platform',
  level: LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
});
