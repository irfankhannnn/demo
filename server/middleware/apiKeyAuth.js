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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid API key' });
    }

    const rawKey = authHeader.substring(7);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // Scan for matching keyHash (small table; PK=tenantId so we scan)
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'keyHash = :kh AND isActive = :active',
      ExpressionAttributeValues: {
        ':kh': keyHash,
        ':active': true,
      },
    }));

    if (!result.Items || result.Items.length === 0) {
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
    console.error('API key auth error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
}

export default apiKeyAuth;
