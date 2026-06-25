import rateLimit from 'express-rate-limit';
import { logger } from '../logger.js';

/**
 * Normalize a phone number for use as a rate-limit key.
 * Strips whitespace and non-digit characters (except leading +) to prevent
 * key manipulation via formatting variations (e.g., "+91 98765" vs "9198765").
 */
function normalizePhoneForKey(phone) {
  if (!phone || typeof phone !== 'string') return 'unknown';
  const digits = phone.replace(/[^\d]/g, '');
  return digits || 'unknown';
}

/**
 * Primary rate limiter: per (phone + IP) — prevents bypass by rotating phone values.
 * Max 5 requests per minute per phone+IP combination.
 */
const perPhoneIpLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const phone = normalizePhoneForKey(req.body?.phone || req.params?.phone);
    const ip = req.ip || 'unknown-ip';
    return `pairing:${phone}:${ip}`;
  },
  handler: (req, res) => {
    const phone = req.body?.phone || req.params?.phone || 'unknown';
    logger.warn(
      { phone, path: req.path, method: req.method, ip: req.ip, limit: 'perPhoneIp' },
      'pairingRateLimit.exceeded'
    );
    res.status(429).json({
      error: 'Too many requests',
      message: 'Maximum 5 pairing requests per minute per phone number',
    });
  },
  skip: (req) => req.method === 'GET',
});

/**
 * Secondary rate limiter: per phone only (IP-independent).
 * Max 10 requests per minute per phone across ALL IPs.
 * This prevents an attacker with multiple IPs (botnet, VPN pool) from
 * bypassing the per-IP limit by distributing requests across many sources.
 */
const perPhoneGlobalLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const phone = normalizePhoneForKey(req.body?.phone || req.params?.phone);
    return `pairing-global:${phone}`;
  },
  handler: (req, res) => {
    const phone = req.body?.phone || req.params?.phone || 'unknown';
    logger.warn(
      { phone, path: req.path, method: req.method, ip: req.ip, limit: 'perPhoneGlobal' },
      'pairingRateLimit.globalExceeded'
    );
    res.status(429).json({
      error: 'Too many requests',
      message: 'Maximum 10 pairing requests per minute per phone number (global limit)',
    });
  },
  skip: (req) => req.method === 'GET',
});

/**
 * Combined rate limiter for pairing endpoints.
 * Applies both per-phone+IP and per-phone-global limits.
 * The stricter limit (lower remaining count) will trigger first.
 */
export const pairingRateLimit = [perPhoneIpLimit, perPhoneGlobalLimit];
