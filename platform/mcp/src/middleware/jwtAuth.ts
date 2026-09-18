/**
 * In-Lambda JWT validation middleware for the MCP /mcp endpoint.
 *
 * API Gateway custom authorizers return a generic 403 response, which breaks
 * MCP OAuth discovery (clients expect 401 + WWW-Authenticate). By handling
 * authentication inside the MCP Lambda, we can return a proper 401 response
 * with a WWW-Authenticate header pointing to the protected resource metadata.
 */

import { Request, Response, NextFunction } from 'express';
import { validateAccessToken } from '../services/tokenService';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { logger } from '../utils/logger';
import { getMcpPublicBaseUrl } from '../config/config';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const OAUTH_TABLE = process.env.OAUTH_CODES_TABLE_NAME || 'realtyflow-oauth-codes';

/**
 * Check whether a token has been revoked.
 */
async function isTokenRevoked(decoded: any): Promise<boolean> {
  const jti = decoded?.jti;
  if (!jti) return true; // fail-closed: no jti means we cannot check revocation
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: OAUTH_TABLE,
        Key: { code: `revoked:${jti}` },
      })
    );
    return !!result.Item;
  } catch (err: any) {
    logger.error('jwtAuth.revocation_check.error', { error: err.message });
    return true; // fail-closed
  }
}

/**
 * Extract Bearer token from Authorization header.
 */
function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}

export async function mcpJwtAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const baseUrl = getMcpPublicBaseUrl();

  const authHeader = req.headers.authorization as string | undefined;
  const token = extractBearerToken(authHeader);

  if (!token) {
    logger.warn('jwtAuth.no_token');
    if (baseUrl) {
      res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`);
    }
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Unauthorized: Bearer token required' },
      id: req.body?.id,
    });
    return;
  }

  const { valid, decoded, error } = validateAccessToken(token);
  if (!valid || !decoded) {
    logger.warn('jwtAuth.invalid_token', { error });
    if (baseUrl) {
      res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`);
    }
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Unauthorized: Invalid token' },
      id: req.body?.id,
    });
    return;
  }

  if (await isTokenRevoked(decoded)) {
    logger.warn('jwtAuth.revoked_token', { jti: decoded.jti });
    if (baseUrl) {
      res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`);
    }
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Unauthorized: Token revoked' },
      id: req.body?.id,
    });
    return;
  }

  const { sub: userId, tenantId, clientId, scopes } = decoded as any;
  if (!tenantId) {
    logger.warn('jwtAuth.no_tenant_id');
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Unauthorized: Token missing tenantId' },
      id: req.body?.id,
    });
    return;
  }

  // Set context for downstream handlers (same shape as x-* headers from authorizer)
  (req as any).tenantId = tenantId;
  (req as any).userId = userId || 'mcp-agent';
  (req as any).clientId = clientId || 'unknown';
  (req as any).scopes = (scopes || []).join(',').split(',').map((s: string) => s.trim()).filter(Boolean);

  // Also set headers so the MCP controller can read them via req.headers['x-tenant-id']
  req.headers['x-tenant-id'] = tenantId;
  req.headers['x-user-id'] = userId || 'mcp-agent';
  req.headers['x-client-id'] = clientId || 'unknown';
  req.headers['x-scopes'] = (scopes || []).join(',');

  next();
}
