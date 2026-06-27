/**
 * OAuth Token Validator — JWT token validation for MCP authentication
 * 
 * Validates JWT tokens, extracts claims, and checks expiry.
 * Used by API Gateway JWT authorizer and Lambda for token validation.
 */

import jwt from 'jsonwebtoken';
import { logger } from '../logger.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Validate OAuth access token
 * @param {string} token - JWT token
 * @returns {Object} { valid: boolean, decoded: Object|null, error: string|null }
 */
export function validateAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    return { valid: true, decoded, error: null };
  } catch (err) {
    logger.warn('oauth.validateAccessToken.failed', { error: err.message });
    return { valid: false, decoded: null, error: err.message };
  }
}

/**
 * Extract tenantId from token
 * @param {string} token - JWT token
 * @returns {string|null} tenantId or null if invalid
 */
export function extractTenantId(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    return decoded.tenantId || null;
  } catch (err) {
    logger.warn('oauth.extractTenantId.failed', { error: err.message });
    return null;
  }
}

/**
 * Extract userId from token
 * @param {string} token - JWT token
 * @returns {string|null} userId or null if invalid
 */
export function extractUserId(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    return decoded.sub || null;
  } catch (err) {
    logger.warn('oauth.extractUserId.failed', { error: err.message });
    return null;
  }
}

/**
 * Extract all claims from token
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded token or null if invalid
 */
export function extractClaims(token) {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    logger.warn('oauth.extractClaims.failed', { error: err.message });
    return null;
  }
}

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @returns {boolean} true if expired, false if valid or invalid
 */
export function isTokenExpired(token) {
  try {
    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    return false; // Token is valid, not expired
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return true;
    }
    // Other errors (invalid signature, etc.) are not "expired"
    return false;
  }
}

/**
 * Get token expiry time (Unix timestamp)
 * @param {string} token - JWT token
 * @returns {number|null} Expiry timestamp or null if invalid
 */
export function getTokenExpiry(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded?.exp || null;
  } catch (err) {
    return null;
  }
}

/**
 * Get time until token expires (in seconds)
 * @param {string} token - JWT token
 * @returns {number|null} Seconds until expiry, or null if invalid
 */
export function getTimeUntilExpiry(token) {
  const expiry = getTokenExpiry(token);
  if (!expiry) return null;

  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, expiry - now);
}

/**
 * Validate token and return detailed result
 * @param {string} token - JWT token
 * @returns {Object} { valid, tenantId, userId, clientId, scopes, expiresIn, error }
 */
export function validateTokenDetailed(token) {
  const { valid, decoded, error } = validateAccessToken(token);

  if (!valid) {
    return {
      valid: false,
      tenantId: null,
      userId: null,
      clientId: null,
      scopes: [],
      expiresIn: null,
      error,
    };
  }

  return {
    valid: true,
    tenantId: decoded.tenantId,
    userId: decoded.sub,
    clientId: decoded.clientId,
    scopes: decoded.scopes || [],
    expiresIn: getTimeUntilExpiry(token),
    error: null,
  };
}
