import { findExpiringAgreements } from '../dataQualityService.js';
import { sendEmail } from '../emailService.js';
import { sendWhatsAppMessage, isBaileyEnabled } from '../bailey.js';
import { logger } from '../logger.js';

export async function handler() {
  logger.info('expiringAgreements.cron.started');
  return { ok: true };
}
