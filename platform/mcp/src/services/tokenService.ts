/**
 * Token Service — JWT token generation and validation for MCP authentication
 *
 * Access Token: 1 hour expiry (signed with JWT_SECRET)
 * Refresh Token: 7 days expiry (signed with JWT_REFRESH_SECRET)
 */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error(
    `JWT secrets not configured: JWT_SECRET=${!!JWT_SECRET}, JWT_REFRESH_SECRET=${!!JWT_REFRESH_SECRET}. ` +
    'Set these environment variables before starting the service.'
  );
}

interface AccessTokenPayload {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  jti: string;
  tenantId: string;
  scopes: string[];
  clientId: string;
}

interface ValidationResult {
  valid: boolean;
  decoded: AccessTokenPayload | null;
  error: string | null;
}

/**
 * Generate OAuth access token (JWT)
 */
export function generateAccessToken(
  userId: string,
  tenantId: string,
  scopes: string[],
  clientId: string
): string {
  if (!userId || !tenantId || !clientId) {
    throw new Error('userId, tenantId, and clientId are required');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    iss: 'https://app.realtyflow.com',
    sub: userId,
    aud: 'mcp-server',
    exp: now + 3600,
    iat: now,
    jti: uuidv4(),
    tenantId,
    scopes: scopes || [],
    clientId,
  };

  const token = jwt.sign(payload, JWT_SECRET!, { algorithm: 'HS256' });
  logger.info('tokenService.generateAccessToken', { userId, tenantId, clientId, expiresIn: '1h' });
  return token;
}

/**
 * Generate OAuth refresh token (JWT)
 */
export function generateRefreshToken(
  userId: string,
  tenantId: string,
  clientId: string,
  scopes: string[] = []
): string {
  if (!userId || !tenantId || !clientId) {
    throw new Error('userId, tenantId, and clientId are required');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://app.realtyflow.com',
    sub: userId,
    aud: 'mcp-server',
    exp: now + 7 * 24 * 3600,
    iat: now,
    jti: uuidv4(),
    tenantId,
    clientId,
    scopes,
    type: 'refresh',
  };

  const token = jwt.sign(payload, JWT_REFRESH_SECRET!, { algorithm: 'HS256' });
  logger.info('tokenService.generateRefreshToken', { userId, tenantId, clientId, expiresIn: '7d' });
  return token;
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(
  userId: string,
  tenantId: string,
  scopes: string[],
  clientId: string
): {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
} {
  const accessToken = generateAccessToken(userId, tenantId, scopes, clientId);
  const refreshToken = generateRefreshToken(userId, tenantId, clientId, scopes);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 3600,
    token_type: 'Bearer',
    scope: (scopes || []).join(' '),
  };
}

/**
 * Validate OAuth access token
 */
export function validateAccessToken(token: string): ValidationResult {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!, { algorithms: ['HS256'] }) as AccessTokenPayload;
    return { valid: true, decoded, error: null };
  } catch (err: any) {
    logger.warn('tokenService.validateAccessToken.failed', { error: err.message });
    return { valid: false, decoded: null, error: err.message };
  }
}

/**
 * Validate OAuth refresh token (signed with JWT_REFRESH_SECRET)
 */
export function validateRefreshToken(token: string): ValidationResult {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET!, { algorithms: ['HS256'] }) as any;
    return { valid: true, decoded, error: null };
  } catch (err: any) {
    logger.warn('tokenService.validateRefreshToken.failed', { error: err.message });
    return { valid: false, decoded: null, error: err.message };
  }
}

/**
 * Generate a short-lived service JWT for calling the CRM backend.
 * This token has role 'mcp-agent' and is accepted by /api/crm/agent/tool.
 */
export function generateServiceToken(tenantId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'realtyflow-mcp',
    sub: 'mcp-service',
    aud: 'crm-backend',
    exp: now + 60,
    iat: now,
    jti: uuidv4(),
    tenantId,
    role: 'mcp-agent',
  };
  return jwt.sign(payload, JWT_SECRET!, { algorithm: 'HS256' });
}
