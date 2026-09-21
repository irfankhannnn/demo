import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getConfig } from '../config/config';
import { getDynamo } from '../utils/aws';

/**
 * Consumer user record — `<env>-realestateflow-marketplace-auth-users`.
 *
 *   PK        UserId          (= the Cognito `sub`; contract §2 says
 *                              marketplace-api keys everything by sub)
 *   GSI       SubIndex        sub   — reserved for future identity linking
 *   GSI       PhoneIndex      phone — E.164, sparse (Google-only users have none)
 *   GSI       EmailIndex      email — lower-cased, sparse
 *
 * No TenantId anywhere: consumers do not belong to an agency.
 */
export type AuthProvider = 'phone' | 'google';

export interface UserItem {
  UserId: string;
  sub: string;
  /** Cognito username used for Admin* calls (E.164 phone for phone users, `google_…` for federated). */
  cognitoUsername: string;
  provider: AuthProvider;
  phone?: string;
  email?: string;
  name?: string;
  status: 'ACTIVE' | 'DELETED';
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  deletedAt?: string;
}

/** Shape returned to clients (contract §3). */
export interface PublicUser {
  userId: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  createdAt: string;
}

export function toPublicUser(user: UserItem): PublicUser {
  return {
    userId: user.UserId,
    phone: user.phone ?? null,
    email: user.email ?? null,
    name: user.name ?? null,
    createdAt: user.createdAt,
  };
}

function isUserItem(item: unknown): item is UserItem {
  if (!item || typeof item !== 'object') return false;
  const c = item as Partial<UserItem>;
  return Boolean(c.UserId && c.sub && c.createdAt);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserById(userId: string): Promise<UserItem | null> {
  const { USERS_TABLE } = getConfig();
  const result = await getDynamo().send(new GetCommand({ TableName: USERS_TABLE, Key: { UserId: userId } }));
  return isUserItem(result.Item) ? result.Item : null;
}

export async function findUserBySub(sub: string): Promise<UserItem | null> {
  // UserId is the sub, so a key lookup is the fast path; the GSI stays for
  // the day a second identity is linked to an existing UserId.
  const direct = await findUserById(sub);
  if (direct) return direct;

  const { USERS_TABLE } = getConfig();
  const result = await getDynamo().send(
    new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: 'SubIndex',
      KeyConditionExpression: '#sub = :sub',
      ExpressionAttributeNames: { '#sub': 'sub' },
      ExpressionAttributeValues: { ':sub': sub },
      Limit: 1,
    })
  );
  const item = result.Items?.find(isUserItem);
  return item ?? null;
}

export async function findUserByPhone(phone: string): Promise<UserItem | null> {
  const { USERS_TABLE } = getConfig();
  const result = await getDynamo().send(
    new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: 'PhoneIndex',
      KeyConditionExpression: 'phone = :phone',
      ExpressionAttributeValues: { ':phone': phone },
      Limit: 1,
    })
  );
  const item = result.Items?.find(isUserItem);
  return item ?? null;
}

export async function findUserByEmail(email: string): Promise<UserItem | null> {
  const { USERS_TABLE } = getConfig();
  const result = await getDynamo().send(
    new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': normalizeEmail(email) },
      Limit: 1,
    })
  );
  const item = result.Items?.find(isUserItem);
  return item ?? null;
}

export async function createUser(params: {
  sub: string;
  cognitoUsername: string;
  provider: AuthProvider;
  phone?: string;
  email?: string;
  name?: string;
}): Promise<UserItem> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();
  const item: UserItem = {
    UserId: params.sub,
    sub: params.sub,
    cognitoUsername: params.cognitoUsername,
    provider: params.provider,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
  if (params.phone) item.phone = params.phone;
  if (params.email) item.email = normalizeEmail(params.email);
  if (params.name?.trim()) item.name = params.name.trim();

  await getDynamo().send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: item,
      ConditionExpression: 'attribute_not_exists(UserId)',
    })
  );
  return item;
}

export async function touchLastLogin(userId: string): Promise<void> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();
  await getDynamo().send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { UserId: userId },
      UpdateExpression: 'SET lastLoginAt = :now, updatedAt = :now',
      ExpressionAttributeValues: { ':now': now },
      ConditionExpression: 'attribute_exists(UserId)',
    })
  );
}

/**
 * Reactivate a soft-deleted row when the same Cognito identity signs in
 * again. Profile fields are wiped so the returning consumer starts clean.
 */
export async function reactivateUser(userId: string): Promise<UserItem | null> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();
  const result = await getDynamo().send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { UserId: userId },
      UpdateExpression: 'SET #status = :active, createdAt = :now, updatedAt = :now, lastLoginAt = :now REMOVE deletedAt, #name, email',
      ExpressionAttributeNames: { '#status': 'status', '#name': 'name' },
      ExpressionAttributeValues: { ':active': 'ACTIVE', ':now': now },
      ConditionExpression: 'attribute_exists(UserId)',
      ReturnValues: 'ALL_NEW',
    })
  );
  return isUserItem(result.Attributes) ? result.Attributes : null;
}

/**
 * Fill in profile fields that are still empty (e.g. email/name from a
 * Google sign-in on a record that only had a phone). Never overwrites.
 */
export async function enrichUserProfile(
  userId: string,
  fields: { email?: string; name?: string; phone?: string }
): Promise<void> {
  const { USERS_TABLE } = getConfig();
  const sets: string[] = [];
  const values: Record<string, unknown> = {};
  const names: Record<string, string> = {};
  if (fields.email) {
    sets.push('email = if_not_exists(email, :email)');
    values[':email'] = normalizeEmail(fields.email);
  }
  if (fields.name?.trim()) {
    sets.push('#name = if_not_exists(#name, :name)');
    names['#name'] = 'name';
    values[':name'] = fields.name.trim();
  }
  if (fields.phone) {
    sets.push('phone = if_not_exists(phone, :phone)');
    values[':phone'] = fields.phone;
  }
  if (sets.length === 0) return;

  await getDynamo().send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { UserId: userId },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
      ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(UserId)',
    })
  );
}

/** PATCH /auth/profile — name/email only; phone is owned by Cognito OTP. */
export async function updateUserProfile(
  userId: string,
  updates: { name?: string; email?: string }
): Promise<UserItem | null> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();
  const sets: string[] = ['updatedAt = :now'];
  const removes: string[] = [];
  const values: Record<string, unknown> = { ':now': now };
  const names: Record<string, string> = {};

  if (updates.name !== undefined) {
    const trimmed = updates.name.trim();
    names['#name'] = 'name';
    if (trimmed) {
      sets.push('#name = :name');
      values[':name'] = trimmed;
    } else {
      removes.push('#name');
    }
  }
  if (updates.email !== undefined) {
    const trimmed = updates.email.trim();
    if (trimmed) {
      sets.push('email = :email');
      values[':email'] = normalizeEmail(trimmed);
    } else {
      removes.push('email');
    }
  }

  const expr = `SET ${sets.join(', ')}${removes.length ? ` REMOVE ${removes.join(', ')}` : ''}`;
  const result = await getDynamo().send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { UserId: userId },
      UpdateExpression: expr,
      ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
      ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(UserId)',
      ReturnValues: 'ALL_NEW',
    })
  );
  return isUserItem(result.Attributes) ? result.Attributes : null;
}

/**
 * Soft delete: keeps the row (and its phone, so a later sign-in with the
 * same number can reactivate it) but marks it DELETED and strips PII that
 * is not needed for that.
 */
export async function markUserDeleted(userId: string): Promise<void> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();
  await getDynamo().send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { UserId: userId },
      UpdateExpression: 'SET #status = :deleted, deletedAt = :now, updatedAt = :now REMOVE #name, email',
      ExpressionAttributeNames: { '#status': 'status', '#name': 'name' },
      ExpressionAttributeValues: { ':deleted': 'DELETED', ':now': now },
      ConditionExpression: 'attribute_exists(UserId)',
    })
  );
}
