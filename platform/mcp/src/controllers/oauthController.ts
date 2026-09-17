/**
 * OAuth Controller — Authorization and token endpoints for MCP
 *
 * Endpoints:
 * - GET  /oauth/authorize — Authorization page (user approves/denies access)
 * - POST /oauth/authorize — Process approval/denial
 * - POST /oauth/token    — Token exchange (authorization code → access token)
 * - POST /oauth/revoke   — Token revocation
 * - POST /oauth/register — Dynamic Client Registration (RFC 7591)
 *
 * Uses Dynamic Client Registration (DCR) exclusively. All clients are
 * public clients (no client_secret) that authenticate via PKCE.
 * Clients self-register via POST /oauth/register and receive a 'dcr_'-prefixed
 * client_id stored in DynamoDB.
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { generateTokenPair, validateAccessToken, validateRefreshToken } from '../services/tokenService';
import {
  registerClient,
  getClient,
  isDcrClient,
  isRedirectUriAllowed,
} from '../services/clientRegistry';
import { resolveOAuthUser } from '../middleware/validateToken';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const OAUTH_TABLE = process.env.OAUTH_CODES_TABLE_NAME || 'realtyflow-oauth-codes';

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Verify a PKCE code_verifier against a stored code_challenge. */
function verifyPkce(
  codeVerifier: string,
  codeChallenge: string,
  method: string
): boolean {
  if (method === 'S256') {
    const expected = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    return expected === codeChallenge;
  }
  // plain method
  return codeVerifier === codeChallenge;
}

/**
 * Wrap resolveOAuthUser middleware in a Promise.
 * Checks res.headersSent so the controller does not double-respond.
 */
function authenticate(req: Request, res: Response): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    resolveOAuthUser(req, res, (err?: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Resolve a DCR-registered client by client_id.
 * Returns { name, redirectUris } or null if unknown/not a DCR client.
 */
async function resolveClient(
  client_id: string
): Promise<{ name: string; redirectUris: string[] } | null> {
  if (!isDcrClient(client_id)) return null;
  const client = await getClient(client_id);
  if (!client) return null;
  return { name: client.client_name, redirectUris: client.redirect_uris };
}

// ---------------------------------------------------------------------------
// GET /oauth/authorize — Show authorization consent page
// ---------------------------------------------------------------------------
export async function getAuthorize(req: Request, res: Response): Promise<void> {
  await authenticate(req, res);
  if (res.headersSent) return;

  try {
    const {
      client_id,
      redirect_uri,
      scope,
      state,
      session,
      code_challenge,
      code_challenge_method,
    } = req.query;

    const clientInfo = await resolveClient(client_id as string);
    if (!clientInfo) {
      logger.warn('oauth.authorize.invalid_client', { client_id });
      res.status(400).json({ error: 'invalid_client', error_description: 'Unknown client_id' });
      return;
    }

    // Validate redirect_uri
    if (!redirect_uri || !isRedirectUriAllowed({ redirect_uris: clientInfo.redirectUris }, redirect_uri as string)) {
      logger.warn('oauth.authorize.invalid_redirect_uri', {
        client_id,
        redirect_uri,
        allowed_uris: clientInfo.redirectUris,
      });
      res.status(400).json({ error: 'invalid_request', error_description: 'Invalid redirect_uri' });
      return;
    }

    // PKCE is required for all DCR clients
    if (!code_challenge) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'code_challenge is required',
      });
      return;
    }

    const user = req.user!;
    const tenantId = user.tenantId;
    if (!tenantId) {
      logger.warn('oauth.authorize.no_tenant', { userId: user.userId });
      res.status(400).json({ error: 'invalid_request', error_description: 'User has no tenant' });
      return;
    }

    res.render('oauth-authorize', {
      client_name: clientInfo.name,
      client_id,
      scope: scope || '',
      state: state || '',
      redirect_uri,
      session: session || '',
      code_challenge: code_challenge || '',
      code_challenge_method: code_challenge_method || 'S256',
      user: { name: user.name, email: user.email, tenantId },
    });
  } catch (err: any) {
    logger.error('oauth.authorize.error', { error: err.message, stack: err.stack });
    if (!res.headersSent) {
      res.status(500).json({ error: 'server_error', error_description: 'An internal error occurred' });
    }
  }
}

// ---------------------------------------------------------------------------
// POST /oauth/authorize — Process user's approval or denial
// ---------------------------------------------------------------------------
export async function postAuthorize(req: Request, res: Response): Promise<void> {
  await authenticate(req, res);
  if (res.headersSent) return;

  try {
    const {
      client_id,
      redirect_uri,
      state,
      action,
      scope,
      code_challenge,
      code_challenge_method,
    } = req.body;

    const clientInfo = await resolveClient(client_id);
    if (!clientInfo) {
      logger.warn('oauth.authorize.post.invalid_client', { client_id });
      res.status(400).json({ error: 'invalid_client' });
      return;
    }

    if (!redirect_uri || !isRedirectUriAllowed({ redirect_uris: clientInfo.redirectUris }, redirect_uri)) {
      logger.warn('oauth.authorize.post.invalid_redirect_uri', {
        client_id,
        redirect_uri,
        allowed_uris: clientInfo.redirectUris,
      });
      res.status(400).json({ error: 'invalid_request', error_description: 'Invalid redirect_uri' });
      return;
    }

    const user = req.user!;
    const tenantId = user.tenantId;
    const userId = user.userId;

    // Scope is required — public clients must explicitly request what they need
    if (!scope || !scope.trim()) {
      logger.warn('oauth.authorize.post.missing_scope', { client_id, userId, tenantId });
      res.status(400).json({ error: 'invalid_request', error_description: 'scope is required' });
      return;
    }

    // Denial
    if (action === 'deny') {
      const errorUrl = new URL(redirect_uri);
      errorUrl.searchParams.append('error', 'access_denied');
      errorUrl.searchParams.append('error_description', 'User denied authorization');
      if (state) errorUrl.searchParams.append('state', state);
      logger.info('oauth.authorize.denied', { client_id, userId, tenantId });
      res.redirect(errorUrl.toString());
      return;
    }

    // Approval
    if (action === 'allow') {
      const authCode = uuidv4();
      const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60; // 10 min

      await docClient.send(
        new PutCommand({
          TableName: OAUTH_TABLE,
          Item: {
            code: authCode,
            client_id,
            tenantId,
            userId,
            expiresAt,
            scope: scope.trim(),
            codeChallenge: code_challenge || null,
            codeChallengeMethod: code_challenge_method || 'S256',
            createdAt: new Date().toISOString(),
          },
        })
      );

      logger.info('oauth.authorize.approved', { client_id, userId, tenantId });

      const successUrl = new URL(redirect_uri);
      successUrl.searchParams.append('code', authCode);
      if (state) successUrl.searchParams.append('state', state);
      res.redirect(successUrl.toString());
      return;
    }

    logger.warn('oauth.authorize.post.invalid_action', { client_id, action });
    res.status(400).json({ error: 'invalid_request', error_description: 'Invalid action' });
  } catch (err: any) {
    logger.error('oauth.authorize.post.error', { error: err.message, stack: err.stack });
    if (!res.headersSent) {
      res.status(500).json({ error: 'server_error', error_description: 'An internal error occurred' });
    }
  }
}

// ---------------------------------------------------------------------------
// POST /oauth/token — Exchange code for tokens
// ---------------------------------------------------------------------------
export async function postToken(req: Request, res: Response): Promise<void> {
  try {
    const {
      grant_type,
      code,
      client_id,
      code_verifier,
      refresh_token,
    } = req.body;

    if (!client_id) {
      res.status(400).json({ error: 'invalid_client' });
      return;
    }

    // Only DCR clients are supported
    if (!isDcrClient(client_id)) {
      logger.warn('oauth.token.unknown_client', { client_id });
      res.status(400).json({ error: 'invalid_client' });
      return;
    }

    // Authorization Code Grant
    if (grant_type === 'authorization_code') {
      if (!code) {
        res.status(400).json({ error: 'invalid_request', error_description: 'code is required' });
        return;
      }

      const result = await docClient.send(
        new GetCommand({ TableName: OAUTH_TABLE, Key: { code } })
      );

      const authCodeItem = result.Item;
      if (!authCodeItem) {
        logger.warn('oauth.token.code_not_found', { code });
        res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code not found' });
        return;
      }

      if (authCodeItem.expiresAt < Math.floor(Date.now() / 1000)) {
        logger.warn('oauth.token.code_expired', { code });
        res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code expired' });
        return;
      }

      if (authCodeItem.client_id !== client_id) {
        logger.warn('oauth.token.code_client_mismatch', { code, client_id });
        res.status(400).json({ error: 'invalid_grant' });
        return;
      }

      const { tenantId, userId, scope, codeChallenge, codeChallengeMethod } = authCodeItem;

      // PKCE is mandatory for all DCR clients
      if (codeChallenge) {
        if (!code_verifier || typeof code_verifier !== 'string') {
          res.status(400).json({
            error: 'invalid_request',
            error_description: 'code_verifier is required',
          });
          return;
        }
        if (!verifyPkce(code_verifier, codeChallenge, codeChallengeMethod || 'S256')) {
          logger.warn('oauth.token.pkce_failed', { code, client_id });
          res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
          return;
        }
      } else {
        // DCR clients must always use PKCE. If codeChallenge is missing, the
        // authorization step was bypassed or malformed.
        logger.warn('oauth.token.pkce_missing', { code, client_id });
        res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE code_challenge missing' });
        return;
      }

      // Atomically consume the auth code (single-use)
      try {
        await docClient.send(
          new DeleteCommand({
            TableName: OAUTH_TABLE,
            Key: { code },
            ConditionExpression: 'attribute_exists(#c)',
            ExpressionAttributeNames: { '#c': 'code' },
          })
        );
      } catch (err: any) {
        if (err.name === 'ConditionalCheckFailedException') {
          // Already consumed — replay attack
          logger.warn('oauth.token.code_replay', { code });
          res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code already used' });
          return;
        }
        throw err;
      }

      const scopes = (scope || '').split(' ').filter(Boolean);
      const tokenPair = generateTokenPair(userId, tenantId, scopes, client_id);

      logger.info('oauth.token.issued', { client_id, userId, tenantId });
      res.json(tokenPair);
      return;
    }

    // Refresh Token Grant
    if (grant_type === 'refresh_token') {
      if (!refresh_token) {
        res.status(400).json({ error: 'invalid_request', error_description: 'refresh_token is required' });
        return;
      }

      const { valid, decoded } = validateRefreshToken(refresh_token);
      if (!valid || !decoded) {
        logger.warn('oauth.token.invalid_refresh_token', { client_id });
        res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired refresh token' });
        return;
      }

      if (decoded.clientId !== client_id) {
        logger.warn('oauth.token.refresh_client_mismatch', { client_id, tokenClientId: decoded.clientId });
        res.status(400).json({ error: 'invalid_grant', error_description: 'client_id mismatch' });
        return;
      }

      // Check revocation
      const revokedCheck = await docClient.send(
        new GetCommand({
          TableName: OAUTH_TABLE,
          Key: { code: `revoked:${decoded.jti}` },
        })
      );
      if (revokedCheck.Item) {
        logger.warn('oauth.token.refresh_revoked', { client_id, jti: decoded.jti });
        res.status(400).json({ error: 'invalid_grant', error_description: 'Token has been revoked' });
        return;
      }

      // Revoke old refresh token jti
      const oldJti = decoded.jti;
      const revokedExpiresAt = decoded.exp + 60;
      await docClient.send(
        new PutCommand({
          TableName: OAUTH_TABLE,
          Item: {
            code: `revoked:${oldJti}`,
            type: 'revoked_token',
            revokedAt: new Date().toISOString(),
            expiresAt: revokedExpiresAt,
          },
        })
      );

      const { tenantId, sub: userId, scopes } = decoded as any;
      const tokenPair = generateTokenPair(userId, tenantId, scopes || [], client_id);

      logger.info('oauth.token.refreshed', { client_id, tenantId });
      res.json(tokenPair);
      return;
    }

    logger.warn('oauth.token.unsupported_grant_type', { grant_type, client_id });
    res.status(400).json({ error: 'unsupported_grant_type' });
  } catch (err: any) {
    logger.error('oauth.token.error', { error: err.message, stack: err.stack });
    if (!res.headersSent) {
      res.status(500).json({ error: 'server_error', error_description: 'An internal error occurred' });
    }
  }
}

// ---------------------------------------------------------------------------
// POST /oauth/revoke — Revoke an access or refresh token
// ---------------------------------------------------------------------------
export async function postRevoke(req: Request, res: Response): Promise<void> {
  try {
    const { token, client_id } = req.body;
    if (!token) {
      res.status(400).json({ error: 'invalid_request', error_description: 'token is required' });
      return;
    }

    // Try access token first, then refresh token
    let decoded: any = null;
    const accessResult = validateAccessToken(token);
    if (accessResult.valid) {
      decoded = accessResult.decoded;
    } else {
      const refreshResult = validateRefreshToken(token);
      if (refreshResult.valid) decoded = refreshResult.decoded;
    }

    if (!decoded) {
      // Invalid token — per RFC 7009, still return 200
      res.status(200).json({ revoked: true });
      return;
    }

    // Optionally verify client_id matches
    if (client_id && decoded.clientId && decoded.clientId !== client_id) {
      logger.warn('oauth.revoke.client_mismatch', { client_id, tokenClientId: decoded.clientId });
      res.status(400).json({ error: 'invalid_client' });
      return;
    }

    const revokedExpiresAt = decoded.exp + 300;
    await docClient.send(
      new PutCommand({
        TableName: OAUTH_TABLE,
        Item: {
          code: `revoked:${decoded.jti}`,
          type: 'revoked_token',
          revokedAt: new Date().toISOString(),
          expiresAt: revokedExpiresAt,
        },
      })
    );

    logger.info('oauth.revoke.success', { jti: decoded.jti, client_id });
    res.status(200).json({ revoked: true });
  } catch (err: any) {
    logger.error('oauth.revoke.error', { error: err.message, stack: err.stack });
    if (!res.headersSent) {
      res.status(500).json({ error: 'server_error', error_description: 'An internal error occurred' });
    }
  }
}

// ---------------------------------------------------------------------------
// POST /oauth/register — Dynamic Client Registration (RFC 7591)
// ---------------------------------------------------------------------------
export async function postRegister(req: Request, res: Response): Promise<void> {
  try {
    const {
      client_name,
      redirect_uris,
      grant_types,
      response_types,
      token_endpoint_auth_method,
    } = req.body;

    // registerClient validates redirect_uris, client_name, and limits
    const client = await registerClient({
      client_name,
      redirect_uris,
      grant_types,
      response_types,
      token_endpoint_auth_method,
    });

    logger.info('oauth.register.success', {
      client_id: client.client_id,
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
    });

    // RFC 7591 response — 201 Created
    res.status(201).json({
      client_id: client.client_id,
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      grant_types: client.grant_types,
      response_types: client.response_types,
      token_endpoint_auth_method: client.token_endpoint_auth_method,
      registered_at: client.registered_at,
    });
  } catch (err: any) {
    const message = err.message || 'Registration failed';
    logger.error('oauth.register.error', { error: message });

    if (!res.headersSent) {
      // Determine the appropriate RFC 7591 error code based on message
      let errorCode = 'invalid_client_metadata';
      if (message.includes('redirect_uri')) {
        errorCode = 'invalid_redirect_uri';
      }

      res.status(400).json({
        error: errorCode,
        error_description: message,
      });
    }
  }
}
