/**
 * AI Integrations API Routes
 * 
 * Manages connected AI apps (Claude, ChatGPT, etc.) for a tenant
 * 
 * Endpoints:
 * - GET /api/ai-integrations — List connected apps
 * - POST /api/ai-integrations/connect — Initiate OAuth flow
 * - DELETE /api/ai-integrations/:clientId — Disconnect an app
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import validateToken from '../middleware/validateToken.js';
import { logger } from '../logger.js';
import {
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBDocumentClient, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { wrapAwsClient } from '../awsClientWrapper.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const router = Router();

const REGION = process.env.AWS_REGION || 'ap-south-1';
const OAUTH_CONNECTIONS_TABLE = process.env.OAUTH_CONNECTIONS_TABLE || 'realtyflow-oauth-connections';

const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', {
  tableName: OAUTH_CONNECTIONS_TABLE,
});
const docClient = DynamoDBDocumentClient.from(client);

/**
 * GET /api/ai-integrations
 * List all connected AI apps for the current tenant
 */
router.get('/', validateToken, async (req, res) => {
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

    logger.info('ai_integrations.list', {
      tenantId,
      count: connections.length,
    });

    res.json({ connections });
  } catch (err) {
    logger.error('ai_integrations.list.error', {
      error: err.message,
      tenantId: req.user?.tenantId,
    });
    res.status(500).json({ error: 'Failed to list integrations' });
  }
});

/**
 * POST /api/ai-integrations/connect
 * Initiate OAuth flow for a new AI app
 */
router.post('/connect', validateToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID not found in token' });
    }

    const { clientId } = req.body;
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }

    // Validate clientId
    const validClients = ['anthropic', 'openai'];
    if (!validClients.includes(clientId)) {
      return res.status(400).json({ error: `Invalid clientId: ${clientId}` });
    }

    // Generate OAuth state
    const state = uuidv4();

    // Build OAuth authorization URL
    const baseUrl = process.env.OAUTH_BASE_URL || 'https://app.realtyflow.com';
    const redirectUri = `${baseUrl}/oauth/callback`;

    const authorizationUrl = new URL(`${baseUrl}/oauth/authorize`);
    authorizationUrl.searchParams.append('client_id', clientId);
    authorizationUrl.searchParams.append('redirect_uri', redirectUri);
    authorizationUrl.searchParams.append('state', state);
    authorizationUrl.searchParams.append('response_type', 'code');
    authorizationUrl.searchParams.append('scope', 'read_leads write_leads read_properties write_properties');

    logger.info('ai_integrations.connect.initiated', {
      tenantId,
      clientId,
      state,
    });

    res.json({
      redirectUrl: authorizationUrl.toString(),
      state,
    });
  } catch (err) {
    logger.error('ai_integrations.connect.error', {
      error: err.message,
      tenantId: req.user?.tenantId,
    });
    res.status(500).json({ error: 'Failed to initiate connection' });
  }
});

/**
 * DELETE /api/ai-integrations/:clientId
 * Disconnect an AI app (revoke token)
 */
router.delete('/:clientId', validateToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID not found in token' });
    }

    const { clientId } = req.params;

    // Delete connection from DynamoDB
    const command = new DeleteCommand({
      TableName: OAUTH_CONNECTIONS_TABLE,
      Key: {
        PK: `TENANT#${tenantId}#OAUTH_CLIENT#${clientId}`,
        SK: 'PROFILE',
      },
    });

    await docClient.send(command);

    logger.info('ai_integrations.disconnect', {
      tenantId,
      clientId,
    });

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
