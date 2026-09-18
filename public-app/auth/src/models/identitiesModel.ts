import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getConfig } from '../config/config';
import { getDynamo } from '../utils/aws';
import type { AuthProvider } from './usersModel';

/**
 * `<env>-realestateflow-marketplace-auth-identities` — Cognito sub → UserId.
 *
 * Create-only: a sub is never re-pointed at a different UserId (conditional
 * put), so a token's `sub` always resolves to the same account. Today every
 * identity maps to UserId === sub (no cross-provider linking); the table
 * exists so linking can be added later without changing the token model.
 */
export interface IdentityItem {
  sub: string;
  userId: string;
  provider: AuthProvider;
  phone?: string;
  email?: string;
  createdAt: string;
}

function isIdentityItem(item: unknown): item is IdentityItem {
  if (!item || typeof item !== 'object') return false;
  const c = item as Partial<IdentityItem>;
  return Boolean(c.sub && c.userId && c.provider);
}

export async function findIdentityBySub(sub: string): Promise<IdentityItem | null> {
  const { IDENTITIES_TABLE } = getConfig();
  const result = await getDynamo().send(new GetCommand({ TableName: IDENTITIES_TABLE, Key: { sub } }));
  return isIdentityItem(result.Item) ? result.Item : null;
}

/**
 * Insert the mapping if absent. Returns the stored item; when a mapping
 * already exists (concurrent first sign-in) the existing one is returned
 * instead of throwing.
 */
export async function ensureIdentity(params: {
  sub: string;
  userId: string;
  provider: AuthProvider;
  phone?: string;
  email?: string;
}): Promise<IdentityItem> {
  const { IDENTITIES_TABLE } = getConfig();
  const item: IdentityItem = {
    sub: params.sub,
    userId: params.userId,
    provider: params.provider,
    createdAt: new Date().toISOString(),
  };
  if (params.phone) item.phone = params.phone;
  if (params.email) item.email = params.email.trim().toLowerCase();

  try {
    await getDynamo().send(
      new PutCommand({
        TableName: IDENTITIES_TABLE,
        Item: item,
        ConditionExpression: 'attribute_not_exists(#sub)',
        ExpressionAttributeNames: { '#sub': 'sub' },
      })
    );
    return item;
  } catch (err) {
    if ((err as { name?: string })?.name === 'ConditionalCheckFailedException') {
      const existing = await findIdentityBySub(params.sub);
      if (existing) return existing;
    }
    throw err;
  }
}
