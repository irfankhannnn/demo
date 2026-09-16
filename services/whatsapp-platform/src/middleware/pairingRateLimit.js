import rateLimit from 'express-rate-limit';
import { NODE_ENV } from '../config.js';

// Loosen limits in non-production so local testing isn't blocked.
const multiplier = NODE_ENV === 'production' ? 1 : 10;

// Per phone+IP: 5 requests / minute (50 in dev)
const perIpLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5 * multiplier,
  keyGenerator: (req) => {
    const phone = (req.body?.phone || '').replace(/\D/g, '') || 'unknown';
    return `${req.ip}:${phone}`;
  },
  message: { error: 'too_many_pairing_requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Per phone global: 10 requests / minute (100 in dev)
const perPhoneLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10 * multiplier,
  keyGenerator: (req) => {
    return `phone:${(req.body?.phone || '').replace(/\D/g, '') || 'unknown'}`;
  },
  message: { error: 'too_many_pairing_requests_for_phone' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const pairingRateLimit = [perIpLimit, perPhoneLimit];
