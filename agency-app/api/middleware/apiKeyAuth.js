import crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { wrapAwsClient } from '../awsClientWrapper.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { logger } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const REGION = process.env.AWS_REGION || 'ap-south-1';
const TABLE_NAME = process.env.TENANT_API_KEYS_TABLE || 'TenantApiKeys';
const KEY_HASH_INDEX = process.env.TENANT_API_KEYS_HASH_INDEX || 'keyHash-index';

const apiKeyAttempts = new Map();
const API_KEY_WINDOW_MS = parseInt(process.env.API_KEY_RATE_LIMIT_WINDOW_MS || '60000', 10);
const API_KEY_MAX_ATTEMPTS = parseInt(process.env.API_KEY_RATE_LIMIT_MAX_ATTEMPTS || '30', 10);

const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: TABLE_NAME });
const docClient = DynamoDBDocumentClient.from(client);

function trackFailedAttempt(clientIp) {
  const now = Date.now();
  const rec = apiKeyAttempts.get(clientIp);
  if (rec && now - rec.windowStart < API_KEY_WINDOW_MS) {
    rec.count += 1;
  } else {
    apiKeyAttempts.set(clientIp, { windowStart: now, count: 1 });
  }
}

/**
 * Look up an active API key by hash.
 * Prefers Query on keyHash-index GSI; falls back to paginated Scan without Limit
 * (Limit before FilterExpression incorrectly truncates results).
 */
async function findActiveKeyByHash(keyHash) {
  try {
    const queried = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: KEY_HASH_INDEX,
      KeyConditionExpression: 'keyHash = :kh',
      FilterExpression: 'isActive = :active',
      ExpressionAttributeValues: {
        ':kh': keyHash,
        ':active': true,
      },
      Limit: 1,
    }));
    return queried.Items?.[0] || null;
  } catch (err) {
    if (err.name !== 'ResourceNotFoundException' && err.name !== 'ValidationException') {
      throw err;
    }
    logger.warn('apiKeyAuth.gsi_unavailable', { index: KEY_HASH_INDEX, error: err.message });
  }

  let ExclusiveStartKey;
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'keyHash = :kh AND isActive = :active',
      ExpressionAttributeValues: {
        ':kh': keyHash,
        ':active': true,
      },
      ProjectionExpression: 'tenantId, keyHash, isActive',
      ExclusiveStartKey,
    }));

    if (result.Items?.length) {
      return result.Items[0];
    }
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return null;
}

/**
 * Bearer API-key auth for public / machine clients.
 * Sets req.tenantId from the key row — never from client headers.
 */
async function apiKeyAuth(req, res, next) {
  try {
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';

    const now = Date.now();
    const attemptRecord = apiKeyAttempts.get(clientIp);
    if (attemptRecord && now - attemptRecord.windowStart < API_KEY_WINDOW_MS) {
      if (attemptRecord.count >= API_KEY_MAX_ATTEMPTS) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Too many API key attempts. Try again later.',
        });
      }
    } else if (attemptRecord) {
      apiKeyAttempts.set(clientIp, { windowStart: now, count: 0 });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      trackFailedAttempt(clientIp);
      return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid API key' });
    }

    const rawKey = authHeader.substring(7);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyRow = await findActiveKeyByHash(keyHash);

    if (!keyRow?.tenantId) {
      trackFailedAttempt(clientIp);
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or inactive API key' });
    }

    req.tenantId = keyRow.tenantId;
    req.authMethod = 'api_key';

    docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { tenantId: keyRow.tenantId },
      UpdateExpression: 'SET lastUsed = :now',
      ExpressionAttributeValues: { ':now': new Date().toISOString() },
    })).catch(() => {});

    next();
  } catch (err) {
    logger.error('apiKeyAuth.error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default apiKeyAuth;
