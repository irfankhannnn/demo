/**
 * AI Integrations Public Routes  (NO authentication required)
 *
 * These routes handle the OAuth callback redirect from the MCP server.
 * They MUST be mounted WITHOUT the validateToken middleware because the
 * browser redirect from MCP carries no Authorization header.
 *
 * Endpoints:
 * - GET /api/ai-integrations/callback — Receive authorization code from MCP,
 *     exchange it for tokens, and store the connection.
 *
 * Security:
 * - State parameter is validated against the stored pending OAuth record in DynamoDB.
 * - PKCE code_verifier (stored at connect time) is sent to the MCP token endpoint.
 * - The code is single-use (MCP deletes it after exchange).
 * - DynamoDB TTL on pending records prevents stale state from being exploited.
 */

import { Router } from 'express';
import axios from 'axios';
import { logger } from '../logger.js';
import { getMcpApiBaseUrl } from '../config/serviceUrls.js';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { OAUTH_PROVIDERS } from '../oauth/oauthProviders.js';

const router = Router();

const REGION = process.env.AWS_REGION || 'ap-south-1';
const OAUTH_CONNECTIONS_TABLE = process.env.OAUTH_CONNECTIONS_TABLE || 'realtyflow-oauth-connections';
const OAUTH_CODES_TABLE = process.env.OAUTH_CODES_TABLE_NAME || 'realtyflow-oauth-codes';

const rawClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(rawClient);

// The frontend URL to redirect to after completing (or failing) the OAuth flow.
function getFrontendReturnUrl() {
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}/crm/ai-integrations`;
}

/**
 * Redirect the browser back to the AI Integrations page with an error message.
 * This is used for all callback failure paths so the user sees a friendly message.
 */
function redirectError(res, returnUrl, message) {
  const params = new URLSearchParams({ oauth: 'error', message });
  return res.redirect(`${returnUrl}?${params.toString()}`);
}

// ---------------------------------------------------------------------------
// GET /api/ai-integrations/callback
//
// Called by the user's browser after they approve/deny on the MCP consent page.
// MCP redirects here with ?code=<auth_code>&state=<state> on approval, or
// ?error=access_denied&state=<state> on denial.
//
// Steps on success:
//   1. Look up pending OAuth record from DynamoDB using `pending_${state}` key
//   2. Validate record (type, TTL)
//   3. POST to MCP /oauth/token with { code, client_id: dcrClientId, code_verifier }
//   4. Store the connection in realtyflow-oauth-connections DynamoDB table
//   5. Clean up the pending record
//   6. Redirect browser to frontend with ?oauth=success
// ---------------------------------------------------------------------------
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const returnUrl = getFrontendReturnUrl();

  // Handle denial or error from MCP
  if (error) {
    logger.warn('ai_integrations.callback.denied', { error, error_description, state });
    return redirectError(
      res,
      returnUrl,
      error === 'access_denied'
        ? 'Access was denied. You can try connecting again.'
        : String(error_description || error)
    );
  }

  if (!code || !state) {
    logger.warn('ai_integrations.callback.missing_params', { code: !!code, state: !!state });
    return redirectError(res, returnUrl, 'Invalid callback: missing code or state parameter');
  }

  // 1. Look up the pending OAuth record
  let pending;
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: OAUTH_CODES_TABLE,
        Key: { code: `pending_${state}` },
      })
    );
    pending = result.Item;
  } catch (err) {
    logger.error('ai_integrations.callback.dynamo_error', { error: err.message });
    return redirectError(res, returnUrl, 'Internal error verifying session. Please try again.');
  }

  // 2. Validate pending record
  if (!pending || pending.type !== 'oauth_pending') {
    logger.warn('ai_integrations.callback.state_not_found', { state });
    return redirectError(res, returnUrl, 'OAuth session not found or already used. Please start over.');
  }

  if (pending.expiresAt < Math.floor(Date.now() / 1000)) {
    logger.warn('ai_integrations.callback.state_expired', { state });
    return redirectError(res, returnUrl, 'OAuth session expired. Please try connecting again.');
  }

  const { dcrClientId, codeVerifier, callbackUrl, tenantId, userId, clientId } = pending;

  let mcpBaseUrl = null;
  try {
    // Custom domain + base path; null when MCP is not configured.
    mcpBaseUrl = getMcpApiBaseUrl();
  } catch (err) {
    logger.error('ai_integrations.callback.mcp_base_url_invalid', { error: err.message });
  }
  if (!mcpBaseUrl) {
    logger.error('ai_integrations.callback.no_mcp_base_url');
    return redirectError(res, returnUrl, 'Server configuration error. Please contact support.');
  }

  // 3. Exchange authorization code for tokens at MCP /oauth/token
  let tokenData;
  try {
    const tokenResponse = await axios.post(
      `${mcpBaseUrl}/oauth/token`,
      {
        grant_type: 'authorization_code',
        code,
        client_id: dcrClientId,
        code_verifier: codeVerifier,
        redirect_uri: callbackUrl,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );
    tokenData = tokenResponse.data;
  } catch (err) {
    const errBody = err.response?.data;
    logger.error('ai_integrations.callback.token_exchange_failed', {
      error: err.message,
      responseData: errBody,
      state,
      dcrClientId,
    });
    return redirectError(
      res,
      returnUrl,
      `Failed to complete authorization: ${errBody?.error_description || errBody?.error || err.message}`
    );
  }

  const { access_token, refresh_token, scope } = tokenData;
  if (!access_token) {
    logger.error('ai_integrations.callback.no_access_token', { state });
    return redirectError(res, returnUrl, 'Token exchange returned no access token. Please try again.');
  }

  // 4. Store connection in DynamoDB
  const providerName = OAUTH_PROVIDERS[clientId]?.name || clientId;
  const scopes = (scope || '').split(' ').filter(Boolean);
  try {
    await docClient.send(
      new PutCommand({
        TableName: OAUTH_CONNECTIONS_TABLE,
        Item: {
          PK: `TENANT#${tenantId}#OAUTH_CLIENTS`,
          SK: `CLIENT#${clientId}`,
          clientId,
          clientName: providerName,
          dcrClientId,
          status: 'connected',
          userId,
          tenantId,
          scopes,
          connectedAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
        },
      })
    );
  } catch (err) {
    logger.error('ai_integrations.callback.store_connection_failed', {
      error: err.message,
      tenantId,
      clientId,
    });
    return redirectError(res, returnUrl, 'Failed to save connection. Please try again.');
  }

  // 5. Clean up the pending record (best-effort; TTL will handle it if this fails)
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: OAUTH_CODES_TABLE,
        Key: { code: `pending_${state}` },
      })
    );
  } catch (err) {
    logger.warn('ai_integrations.callback.cleanup_failed', { error: err.message, state });
  }

  logger.info('ai_integrations.callback.success', {
    tenantId,
    clientId,
    providerName,
    scopes,
  });

  // 6. Redirect browser to frontend with success
  const params = new URLSearchParams({ oauth: 'success', client: providerName });
  return res.redirect(`${returnUrl}?${params.toString()}`);
});

export default router;
