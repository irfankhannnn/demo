/**
 * OAuth Token Generator — JWT token creation for MCP authentication
 * 
 * Generates access tokens and refresh tokens with custom claims (tenantId, scopes, clientId)
 * Tokens are signed with JWT_SECRET and JWT_REFRESH_SECRET from environment variables.
 * 
 * Access Token: 1 hour expiry
 * Refresh Token: 7 days expiry
 */

import jwt from 'jsonwebtoken';
import { logger } from '../logger.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET environment variables are required');
}

/**
 * Generate OAuth access token (JWT)
 * @param {string} userId - User ID (from Cognito or internal)
 * @param {string} tenantId - Tenant ID (agency ID)
 * @param {Array<string>} scopes - Requested scopes (e.g., ['read_leads', 'write_leads'])
 * @param {string} clientId - OAuth client ID ('anthropic' or 'openai')
 * @returns {string} JWT access token
 */
export function generateAccessToken(userId, tenantId, scopes, clientId) {
  if (!userId || !tenantId || !clientId) {
    throw new Error('userId, tenantId, and clientId are required');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://app.realtyflow.com',
    sub: userId,
    aud: 'mcp-server',
    exp: now + 3600, // 1 hour
    iat: now,
    tenantId,
    scopes: scopes || [],
    clientId,
  };

  const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
  logger.info('oauth.generateAccessToken', { userId, tenantId, clientId, expiresIn: '1h' });
  return token;
}

/**
 * Generate OAuth refresh token (JWT)
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @param {string} clientId - OAuth client ID
 * @returns {string} JWT refresh token
 */
export function generateRefreshToken(userId, tenantId, clientId) {
  if (!userId || !tenantId || !clientId) {
    throw new Error('userId, tenantId, and clientId are required');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://app.realtyflow.com',
    sub: userId,
    aud: 'mcp-server',
    exp: now + 7 * 24 * 3600, // 7 days
    iat: now,
    tenantId,
    clientId,
    type: 'refresh',
  };

  const token = jwt.sign(payload, JWT_REFRESH_SECRET, { algorithm: 'HS256' });
  logger.info('oauth.generateRefreshToken', { userId, tenantId, clientId, expiresIn: '7d' });
  return token;
}

/**
 * Generate both access and refresh tokens
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @param {Array<string>} scopes - Requested scopes
 * @param {string} clientId - OAuth client ID
 * @returns {Object} { accessToken, refreshToken, expiresIn, tokenType }
 */
export function generateTokenPair(userId, tenantId, scopes, clientId) {
  const accessToken = generateAccessToken(userId, tenantId, scopes, clientId);
  const refreshToken = generateRefreshToken(userId, tenantId, clientId);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 3600,
    token_type: 'Bearer',
    scope: (scopes || []).join(' '),
  };
}

/**
 * Decode token without verification (for inspection only)
 * @param {string} token - JWT token
 * @returns {Object} Decoded payload
 */
export function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch (err) {
    logger.warn('oauth.decodeToken.failed', { error: err.message });
    return null;
  }
}
