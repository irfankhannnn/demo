import AWS from 'aws-sdk';
import { getConfig } from '../config/config';

const dynamodb = new AWS.DynamoDB.DocumentClient();

function isValidIdentityItem(item: unknown): item is AuthIdentityItem {
  if (!item || typeof item !== 'object') return false;

  const candidate = item as Partial<AuthIdentityItem>;

  return Boolean(candidate.sub && candidate.userId && candidate.tenantId && candidate.provider);
}

export interface AuthIdentityItem {
  sub: string;
  userId: string;
  tenantId: string;
  provider: 'google' | 'phone';
  email?: string;
  phone?: string;
  createdAt: string;
}

/**
 * Find an identity mapping by Cognito sub.
 * O(1) GetItem by PK.
 */
export async function findIdentityBySub(sub: string): Promise<AuthIdentityItem | null> {
  const { AUTH_IDENTITIES_TABLE } = getConfig();

  const result = await dynamodb
    .get({
      TableName: AUTH_IDENTITIES_TABLE,
      Key: { sub },
    })
    .promise();

  return isValidIdentityItem(result.Item) ? result.Item : null;
}

/**
 * Create a new identity mapping (sub → userId).
 * Uses ConditionExpression to ensure a sub is never reassigned to a different userId.
 * Throws ConditionalCheckFailedException if the sub already has a mapping.
 */
export async function createIdentity(params: {
  sub: string;
  userId: string;
  tenantId: string;
  provider: 'google' | 'phone';
  email?: string;
  phone?: string;
}): Promise<AuthIdentityItem> {
  const { AUTH_IDENTITIES_TABLE } = getConfig();
  const now = new Date().toISOString();

  if (!params.sub || !params.userId || !params.tenantId) {
    throw new Error('createIdentity requires sub, userId, and tenantId');
  }

  const item: AuthIdentityItem = {
    sub: params.sub,
    userId: params.userId,
    tenantId: params.tenantId,
    provider: params.provider,
    createdAt: now,
  };

  if (params.email) item.email = params.email.toLowerCase().trim();
  if (params.phone) item.phone = params.phone.trim();

  await dynamodb
    .put({
      TableName: AUTH_IDENTITIES_TABLE,
      Item: item,
      ConditionExpression: 'attribute_not_exists(#sub)',
      ExpressionAttributeNames: {
        '#sub': 'sub',
      },
    })
    .promise();

  return item;
}

/**
 * Delete all identity rows for a given userId.
 * Used when a user is deleted.
 * Requires a scan of all identities for the userId — call sparingly.
 * In production, consider maintaining a userId → [subs] index if deletion is frequent.
 */
export async function deleteIdentitiesByUserId(userId: string): Promise<void> {
  const { AUTH_IDENTITIES_TABLE } = getConfig();

  const result = await dynamodb
    .scan({
      TableName: AUTH_IDENTITIES_TABLE,
      FilterExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
    })
    .promise();

  if (!result.Items || result.Items.length === 0) return;

  for (const item of result.Items) {
    await dynamodb
      .delete({
        TableName: AUTH_IDENTITIES_TABLE,
        Key: { sub: item.sub },
      })
      .promise();
  }
}
