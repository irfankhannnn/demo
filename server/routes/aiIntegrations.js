/**
 * AI Integrations API Routes  (auth-protected)
 *
 * Manages connected AI apps (Claude, ChatGPT, etc.) for a tenant.
 * All routes here require a valid Cognito JWT (enforced by the validateToken
 * middleware mounted in server.js before this router).
 *
 * Endpoints:
 * - GET  /api/ai-integrations           — List connected apps
 * - POST /api/ai-integrations/connect   — Initiate OAuth flow (Claude Web)
 * - POST /api/ai-integrations/desktop-session — Create session for Claude Desktop
 * - DELETE /api/ai-integrations/:clientId — Disconnect an app
 *
 * OAuth callback (public, no auth):
 * - GET  /api/ai-integrations/callback  — see aiIntegrationsPublic.js
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../logger.js';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { wrapAwsClient } from '../awsClientWrapper.js';
import {
  OAUTH_PROVIDERS,
  OAUTH_SCOPES,
  isValidOAuthClient,
  getOAuthCallbackUrl,
} from '../oauth/oauthProviders.js';

const router = Router();

const REGION = process.env.AWS_REGION || 'ap-south-1';
const OAUTH_CONNECTIONS_TABLE = process.env.OAUTH_CONNECTIONS_TABLE || 'realtyflow-oauth-connections';
const OAUTH_CODES_TABLE = process.env.OAUTH_CODES_TABLE_NAME || 'realtyflow-oauth-codes';

// Session codes expire in 5 minutes (user has 5 min to go through the OAuth page)
const OAUTH_SESSION_TTL_SEC = parseInt(process.env.OAUTH_SESSION_TTL_SEC || '300', 10);
// Pending OAuth state expires in 15 minutes (covers the full user interaction time)
const OAUTH_PENDING_TTL_SEC = parseInt(process.env.OAUTH_PENDING_TTL_SEC || '900', 10);
// DCR client lookup records are reused for 24 hours to avoid flooding the MCP server
// with unused registrations every time the user clicks Connect.
const DCR_LOOKUP_TTL_SEC = parseInt(process.env.DCR_LOOKUP_TTL_SEC || '86400', 10);

const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', {
  tableName: OAUTH_CONNECTIONS_TABLE,
});
const docClient = DynamoDBDocumentClient.from(client);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a PKCE code_verifier (RFC 7636 §4.1) and compute the
 * S256 code_challenge from it.
 *
 * Returns { codeVerifier, codeChallenge } where:
 *   codeVerifier  — 32 random bytes encoded as base64url (43 chars)
 *   codeChallenge — BASE64URL(SHA256(ASCII(codeVerifier)))
 */
function generatePkce() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

/**
 * Build a deterministic lookup key for a tenant/provider DCR mapping.
 */
function dcrLookupKey(tenantId, clientId) {
  return `dcr_lookup_${tenantId}_${clientId}`;
}

/**
 * Try to reuse an existing DCR client registered for this tenant/provider.
 * Returns the dcr_xxx client_id or null if not found / expired.
 */
async function findExistingDcrClient(tenantId, clientId, callbackUrl) {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: OAUTH_CODES_TABLE,
        Key: { code: dcrLookupKey(tenantId, clientId) },
      })
    );
    const item = result.Item;
    if (!item || item.type !== 'dcr_lookup') return null;

    const now = Math.floor(Date.now() / 1000);
    if (item.expiresAt < now) return null;
    if (item.callbackUrl !== callbackUrl) return null;

    return item.dcrClientId;
  } catch (err) {
    logger.warn('ai_integrations.find_dcr_client.error', {
      error: err.message,
      tenantId,
      clientId,
    });
    return null;
  }
}

/**
 * Store a tenant/provider → DCR client mapping so future "Connect" clicks
 * can reuse the same client instead of registering a new one.
 */
async function storeDcrClientMapping(tenantId, clientId, dcrClientId, callbackUrl) {
  const expiresAt = Math.floor(Date.now() / 1000) + DCR_LOOKUP_TTL_SEC;
  try {
    await docClient.send(
      new PutCommand({
        TableName: OAUTH_CODES_TABLE,
        Item: {
          code: dcrLookupKey(tenantId, clientId),
          type: 'dcr_lookup',
          tenantId,
          clientId,
          dcrClientId,
          callbackUrl,
          expiresAt,
          createdAt: new Date().toISOString(),
        },
      })
    );
  } catch (err) {
    logger.warn('ai_integrations.store_dcr_client.error', {
      error: err.message,
      tenantId,
      clientId,
      dcrClientId,
    });
  }
}

/**
 * Register a new DCR client with the MCP server via POST /oauth/register.
 * Returns the generated client_id (dcr_xxx).
 *
 * DCR clients are reused for 24 hours per tenant/provider to avoid flooding
 * the MCP server with unused registrations every time the user clicks Connect.
 */
async function registerDcrClient(clientId, callbackUrl, tenantId) {
  const mcpBaseUrl = (process.env.MCP_BASE_URL || '').replace(/\/$/, '');
  if (!mcpBaseUrl) {
    throw new Error('MCP_BASE_URL environment variable is not configured');
  }

  // Reuse an existing DCR client when possible
  const existing = await findExistingDcrClient(tenantId, clientId, callbackUrl);
  if (existing) {
    logger.info('ai_integrations.dcr_reused', { tenantId, clientId, dcrClientId: existing });
    return existing;
  }

  const providerName = OAUTH_PROVIDERS[clientId]?.name || clientId;
  const payload = {
    client_name: `RealtyFlow-${providerName}`,
    redirect_uris: [callbackUrl],
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };

  const response = await axios.post(`${mcpBaseUrl}/oauth/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
  });

  const dcrClientId = response.data.client_id;
  if (!dcrClientId || !dcrClientId.startsWith('dcr_')) {
    throw new Error(`MCP DCR registration returned unexpected client_id: ${dcrClientId}`);
  }

  await storeDcrClientMapping(tenantId, clientId, dcrClientId, callbackUrl);

  logger.info('ai_integrations.dcr_registered', {
    tenantId,
    clientId,
    dcrClientId,
    callbackUrl,
  });

  return dcrClientId;
}

// ---------------------------------------------------------------------------
// GET /api/ai-integrations — List connected apps
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID not found in token' });
    }

    const command = new QueryCommand({
      TableName: OAUTH_CONNECTIONS_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}#OAUTH_CLIENTS`,
      },
    });

    const result = await docClient.send(command);

    const connections = (result.Items || []).map((item) => ({
      clientId: item.clientId,
      clientName: item.clientName,
      status: item.status,
      connectedAt: item.connectedAt,
      lastUsedAt: item.lastUsedAt,
      scopes: item.scopes || [],
    }));

    logger.info('ai_integrations.list', { tenantId, count: connections.length });
    res.json({ connections });
  } catch (err) {
    logger.error('ai_integrations.list.error', {
      error: err.message,
      tenantId: req.user?.tenantId,
    });
    res.status(500).json({ error: 'Failed to list integrations' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai-integrations/connect — Initiate OAuth flow (Claude Web / web browser)
//
// Flow:
//   1. Register a DCR client with the MCP server (POST /oauth/register)
//   2. Generate PKCE code_verifier + code_challenge (RFC 7636 S256)
//   3. Generate a state UUID and a short-lived session code
//   4. Persist pending OAuth state (state → code_verifier + meta) in DynamoDB
//   5. Persist session code (authenticates the user at MCP /oauth/authorize)
//   6. Return the MCP /oauth/authorize URL to the frontend
//
// After the user approves on the MCP consent page:
//   → MCP redirects to OAUTH_CALLBACK_URL with ?code=xxx&state=xxx
//   → GET /api/ai-integrations/callback exchanges the code for a token
// ---------------------------------------------------------------------------
router.post('/connect', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID not found in token' });
    }

    const { clientId } = req.body;
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }
    if (!isValidOAuthClient(clientId)) {
      return res.status(400).json({ error: `Invalid clientId: ${clientId}` });
    }

    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const mcpBaseUrl = (process.env.MCP_BASE_URL || '').replace(/\/$/, '');
    if (!mcpBaseUrl) {
      return res.status(500).json({ error: 'MCP_BASE_URL environment variable is not configured' });
    }

    // Determine the callback URL for this environment
    const callbackUrl = getOAuthCallbackUrl();

    // 1. Register or reuse a DCR client (MCP validates the redirect_uri during this call)
    let dcrClientId;
    try {
      dcrClientId = await registerDcrClient(clientId, callbackUrl, tenantId);
    } catch (err) {
      logger.error('ai_integrations.connect.dcr_error', {
        error: err.message,
        clientId,
        callbackUrl,
      });
      return res.status(502).json({
        error: 'Failed to register OAuth client with MCP server',
        details: err.message,
      });
    }

    // 2. Generate PKCE (RFC 7636 S256)
    const { codeVerifier, codeChallenge } = generatePkce();

    // 3. Generate state + session code
    const state = uuidv4();
    const sessionCode = `session_${uuidv4()}`;
    const nowSec = Math.floor(Date.now() / 1000);
    const sessionExpiresAt = nowSec + OAUTH_SESSION_TTL_SEC;
    const pendingExpiresAt = nowSec + OAUTH_PENDING_TTL_SEC;

    // 4. Persist pending OAuth state and session code in parallel
    await Promise.all([
      docClient.send(
        new PutCommand({
          TableName: OAUTH_CODES_TABLE,
          Item: {
            code: `pending_${state}`,
            type: 'oauth_pending',
            state,
            tenantId,
            userId,
            clientId,
            dcrClientId,
            codeVerifier,
            callbackUrl,
            expiresAt: pendingExpiresAt,
            createdAt: new Date().toISOString(),
          },
        })
      ),
      docClient.send(
        new PutCommand({
          TableName: OAUTH_CODES_TABLE,
          Item: {
            code: sessionCode,
            type: 'oauth_session',
            tenantId,
            userId,
            userName: req.user?.name || req.user?.displayName || '',
            userEmail: req.user?.email || '',
            expiresAt: sessionExpiresAt,
            createdAt: new Date().toISOString(),
          },
        })
      ),
    ]);

    // 5. Build MCP /oauth/authorize URL
    const authorizationUrl = new URL(`${mcpBaseUrl}/oauth/authorize`);
    authorizationUrl.searchParams.append('client_id', dcrClientId);
    authorizationUrl.searchParams.append('redirect_uri', callbackUrl);
    authorizationUrl.searchParams.append('state', state);
    authorizationUrl.searchParams.append('response_type', 'code');
    authorizationUrl.searchParams.append('scope', OAUTH_SCOPES.join(' '));
    authorizationUrl.searchParams.append('session', sessionCode);
    authorizationUrl.searchParams.append('code_challenge', codeChallenge);
    authorizationUrl.searchParams.append('code_challenge_method', 'S256');

    logger.info('ai_integrations.connect.initiated', {
      tenantId,
      clientId,
      dcrClientId,
      state,
      sessionCode: sessionCode.slice(0, 14) + '...',
    });

    res.json({ redirectUrl: authorizationUrl.toString() });
  } catch (err) {
    logger.error('ai_integrations.connect.error', {
      error: err.message,
      tenantId: req.user?.tenantId,
    });
    res.status(500).json({ error: 'Failed to initiate connection' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai-integrations/desktop-session
//
// Claude Desktop (mcp-remote) flow:
//   1. mcp-remote opens browser to MCP /oauth/authorize (no session code)
//   2. validateToken.ts detects no auth → redirects to frontend with mcp_oauth_callback param
//   3. Frontend (user is logged in) detects mcp_oauth_callback param
//   4. User sees "Claude Desktop wants to connect" banner and clicks Approve
//   5. Frontend POSTs here with { oauthCallbackUrl: "<mcp_oauth_url_without_session>" }
//   6. This endpoint creates a session code and adds it to the OAuth URL
//   7. Returns { authorizeUrl: "<mcp_oauth_url_with_session>" }
//   8. Frontend redirects browser to authorizeUrl
//   9. MCP validates session code → shows consent page → user approves
//  10. mcp-remote receives auth code at localhost callback → exchanges for token
// ---------------------------------------------------------------------------
router.post('/desktop-session', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID not found in token' });
    }

    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const { oauthCallbackUrl } = req.body;
    if (!oauthCallbackUrl || typeof oauthCallbackUrl !== 'string') {
      return res.status(400).json({ error: 'oauthCallbackUrl is required' });
    }

    // Validate that the URL points to our MCP server (not an arbitrary host)
    let parsedUrl;
    try {
      parsedUrl = new URL(oauthCallbackUrl);
    } catch {
      return res.status(400).json({ error: 'oauthCallbackUrl is not a valid URL' });
    }

    const mcpBaseUrl = (process.env.MCP_BASE_URL || '').replace(/\/$/, '');
    if (!mcpBaseUrl) {
      return res.status(500).json({ error: 'MCP_BASE_URL environment variable is not configured' });
    }
    const mcpHost = new URL(mcpBaseUrl).hostname;
    const requestedHost = parsedUrl.hostname;
    if (requestedHost !== mcpHost && requestedHost !== 'localhost' && requestedHost !== '127.0.0.1') {
      logger.warn('ai_integrations.desktop_session.untrusted_host', {
        requestedHost,
        mcpHost,
      });
      return res.status(400).json({ error: 'oauthCallbackUrl must point to the MCP server' });
    }

    // The URL must be exactly the /oauth/authorize endpoint (no subpaths or fragments)
    if (parsedUrl.pathname !== '/oauth/authorize') {
      return res.status(400).json({ error: 'oauthCallbackUrl must be /oauth/authorize' });
    }
    if (parsedUrl.hash) {
      return res.status(400).json({ error: 'oauthCallbackUrl must not contain a fragment' });
    }

    // Generate a short-lived session code for this user
    const sessionCode = `session_${uuidv4()}`;
    const sessionExpiresAt = Math.floor(Date.now() / 1000) + OAUTH_SESSION_TTL_SEC;

    await docClient.send(
      new PutCommand({
        TableName: OAUTH_CODES_TABLE,
        Item: {
          code: sessionCode,
          type: 'oauth_session',
          tenantId,
          userId,
          userName: req.user?.name || req.user?.displayName || '',
          userEmail: req.user?.email || '',
          expiresAt: sessionExpiresAt,
          createdAt: new Date().toISOString(),
        },
      })
    );

    // Inject session into the OAuth URL (overwrite any existing session param)
    parsedUrl.searchParams.set('session', sessionCode);
    const authorizeUrl = parsedUrl.toString();

    logger.info('ai_integrations.desktop_session.created', {
      tenantId,
      userId,
      sessionCode: sessionCode.slice(0, 14) + '...',
    });

    res.json({ authorizeUrl });
  } catch (err) {
    logger.error('ai_integrations.desktop_session.error', {
      error: err.message,
      tenantId: req.user?.tenantId,
    });
    res.status(500).json({ error: 'Failed to create desktop session' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/ai-integrations/:clientId — Disconnect an app
// ---------------------------------------------------------------------------
router.delete('/:clientId', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID not found in token' });
    }

    const { clientId } = req.params;
    if (!isValidOAuthClient(clientId)) {
      return res.status(400).json({ error: `Invalid clientId: ${clientId}` });
    }

    // Find the matching connection so we can delete it with the correct PK/SK.
    const queryResult = await docClient.send(
      new QueryCommand({
        TableName: OAUTH_CONNECTIONS_TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}#OAUTH_CLIENTS`,
        },
      })
    );

    const item = (queryResult.Items || []).find((i) => i.clientId === clientId);
    if (!item) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    await docClient.send(
      new DeleteCommand({
        TableName: OAUTH_CONNECTIONS_TABLE,
        Key: { PK: item.PK, SK: item.SK },
      })
    );

    logger.info('ai_integrations.disconnect', { tenantId, clientId });
    res.json({ success: true, message: `Disconnected ${clientId}` });
  } catch (err) {
    logger.error('ai_integrations.disconnect.error', {
      error: err.message,
      tenantId: req.user?.tenantId,
      clientId: req.params.clientId,
    });
    res.status(500).json({ error: 'Failed to disconnect integration' });
  }
});

export default router;
