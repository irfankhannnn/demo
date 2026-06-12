import crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { wrapAwsClient } from '../awsClientWrapper.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const REGION = process.env.AWS_REGION || 'ap-south-1';
const TABLE_NAME = process.env.TENANT_API_KEYS_TABLE || 'TenantApiKeys';

// In-memory rate limiter for API key auth (prevent brute-force key guessing)
const apiKeyAttempts = new Map();
const API_KEY_WINDOW_MS = 60 * 1000; // 1 minute
const API_KEY_MAX_ATTEMPTS = 30; // 30 failed attempts per IP per minute

const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: TABLE_NAME });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Bearer token auth for OpenClaw HTTP requests.
 * Hashes the provided key with SHA-256 and looks up in TenantApiKeys table.
 * If found + isActive → sets req.tenantId, calls next().
 * Else → 401 unauthorized.
 */
async function apiKeyAuth(req, res, next) {
  try {
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';

    // Rate limit: check failed attempts per IP
    const now = Date.now();
    const attemptRecord = apiKeyAttempts.get(clientIp);
    if (attemptRecord && now - attemptRecord.windowStart < API_KEY_WINDOW_MS) {
      if (attemptRecord.count >= API_KEY_MAX_ATTEMPTS) {
        return res.status(429).json({ error: 'rate_limited', message: 'Too many API key attempts. Try again later.' });
      }
    } else if (attemptRecord) {
      // Reset window
      apiKeyAttempts.set(clientIp, { windowStart: now, count: 0 });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Track failed attempt
      const rec = apiKeyAttempts.get(clientIp);
      if (rec && now - rec.windowStart < API_KEY_WINDOW_MS) {
        rec.count++;
      } else {
        apiKeyAttempts.set(clientIp, { windowStart: now, count: 1 });
      }
      return res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid API key' });
    }

    const rawKey = authHeader.substring(7);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // TODO(HIGH-2): Replace Scan with Query on a KeyHashIndex GSI (PK=keyHash, SK=tenantId).
    // Until the GSI is added via CFN, we scan with ProjectionExpression + Limit to minimize read cost.
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'keyHash = :kh AND isActive = :active',
      ExpressionAttributeValues: {
        ':kh': keyHash,
        ':active': true,
      },
      ProjectionExpression: 'tenantId, keyHash, isActive',
      Limit: 1,
    }));

    if (!result.Items || result.Items.length === 0) {
      // Track failed attempt
      const rec = apiKeyAttempts.get(clientIp);
      if (rec && now - rec.windowStart < API_KEY_WINDOW_MS) {
        rec.count++;
      } else {
        apiKeyAttempts.set(clientIp, { windowStart: now, count: 1 });
      }
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid or inactive API key' });
    }

    const keyRow = result.Items[0];
    req.tenantId = keyRow.tenantId;

    // Update lastUsed (fire-and-forget)
    import('@aws-sdk/lib-dynamodb').then(({ UpdateCommand }) => {
      docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { tenantId: keyRow.tenantId },
        UpdateExpression: 'SET lastUsed = :now',
        ExpressionAttributeValues: { ':now': new Date().toISOString() },
      })).catch(() => {});
    });

    next();
  } catch (err) {
    res.status(500).json({ error: 'internal_error' });
  }
}

export default apiKeyAuth;
