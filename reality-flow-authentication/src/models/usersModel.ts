import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../config/config';

const dynamodb = new AWS.DynamoDB.DocumentClient();

function isValidUserItem(item: unknown): item is UserItem {
  if (!item || typeof item !== 'object') return false;

  const candidate = item as Partial<UserItem>;

  return Boolean(
    candidate.TenantId &&
      candidate.SK &&
      candidate.userId &&
      candidate.entityType === 'USER'
  );
}

export interface UserItem {
  TenantId: string;
  SK: string;
  entityType: 'USER';
  userId: string;
  cognitoSub: string;
  email?: string;
  phoneNumber?: string;
  pendingEmail?: string;
  pendingPhoneNumber?: string;
  displayName: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  pendingEmailRequestedAt?: string;
  pendingPhoneRequestedAt?: string;
  GSI_UserIdPK: string;
  GSI_EmailPK?: string;
  GSI_EmailSK?: string;
  GSI_PhonePK?: string;
  GSI_PhoneSK?: string;
  authMethod: 'google' | 'phone';
}

/**
 * Find a user by their stable userId via UserIdIndex GSI.
 */
export async function findUserByUserId(userId: string): Promise<UserItem | null> {
  const { USERS_TABLE } = getConfig();

  const result = await dynamodb
    .query({
      TableName: USERS_TABLE,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'GSI_UserIdPK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
      },
      Limit: 1,
    })
    .promise();

  if (result.Items && result.Items.length > 0) {
    const validItem = result.Items.find(isValidUserItem);
    return validItem || null;
  }

  return null;
}

/**
 * Find any user by email globally (across all tenants).
 * Used for global uniqueness enforcement.
 */
export async function findUserByEmail(email: string): Promise<UserItem | null> {
  const { USERS_TABLE } = getConfig();
  const normalizedEmail = email.toLowerCase().trim();

  const result = await dynamodb
    .query({
      TableName: USERS_TABLE,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'GSI_EmailPK = :pk',
      ExpressionAttributeValues: {
        ':pk': `EMAIL#${normalizedEmail}`,
      },
      Limit: 1,
    })
    .promise();

  if (result.Items && result.Items.length > 0) {
    const validItem = result.Items.find(isValidUserItem);
    return validItem || null;
  }

  return null;
}

/**
 * Find any user by phone number globally (across all tenants).
 * Used for global uniqueness enforcement.
 */
export async function findUserByPhone(phone: string): Promise<UserItem | null> {
  const { USERS_TABLE } = getConfig();

  const result = await dynamodb
    .query({
      TableName: USERS_TABLE,
      IndexName: 'PhoneIndex',
      KeyConditionExpression: 'GSI_PhonePK = :pk',
      ExpressionAttributeValues: {
        ':pk': `PHONE#${phone}`,
      },
      Limit: 1,
    })
    .promise();

  if (result.Items && result.Items.length > 0) {
    const validItem = result.Items.find(isValidUserItem);
    return validItem || null;
  }

  return null;
}

/**
 * Find the ADMIN user for a given tenant.
 * Enforces the single-admin-per-tenant invariant.
 */
export async function findAdminByTenantId(tenantId: string): Promise<UserItem | null> {
  const { USERS_TABLE } = getConfig();

  const result = await dynamodb
    .query({
      TableName: USERS_TABLE,
      KeyConditionExpression: 'TenantId = :tid AND begins_with(SK, :prefix)',
      FilterExpression: '#role = :admin AND entityType = :et',
      ExpressionAttributeNames: { '#role': 'role' },
      ExpressionAttributeValues: {
        ':tid': tenantId,
        ':prefix': 'USER#',
        ':admin': 'ADMIN',
        ':et': 'USER',
      },
    })
    .promise();

  if (result.Items && result.Items.length > 0) {
    return result.Items[0] as UserItem;
  }

  return null;
}

/**
 * Create admin user record in UsersTable.
 * Accepts an optional userId; generates a new UUID if not provided.
 * cognitoSub is stored for audit/display but NOT used as the record key.
 */
export async function createAdminUser(params: {
  tenantId: string;
  cognitoSub: string;
  userId?: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  authMethod?: 'google' | 'phone';
}): Promise<UserItem> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();
  const userId = params.userId || uuidv4();

  const item: UserItem = {
    TenantId: params.tenantId,
    SK: `USER#${userId}`,
    entityType: 'USER',
    userId,
    cognitoSub: params.cognitoSub,
    email: params.email.toLowerCase().trim(),
    phoneNumber: params.phoneNumber,
    displayName: params.displayName,
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    GSI_UserIdPK: `USER#${userId}`,
    GSI_EmailPK: `EMAIL#${params.email.toLowerCase().trim()}`,
    GSI_EmailSK: `USER#${userId}`,
    authMethod: params.authMethod || 'google',
  };

  if (params.phoneNumber) {
    item.GSI_PhonePK = `PHONE#${params.phoneNumber}`;
    item.GSI_PhoneSK = `USER#${userId}`;
  }

  await dynamodb.put({ TableName: USERS_TABLE, Item: item }).promise();
  return item;
}

/**
 * Create member user record in UsersTable.
 * Accepts an optional userId; generates a new UUID if not provided.
 */
export async function createMemberUser(params: {
  tenantId: string;
  cognitoSub: string;
  userId?: string;
  email?: string;
  displayName: string;
  phoneNumber?: string;
  authMethod?: 'google' | 'phone';
}): Promise<UserItem> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();
  const userId = params.userId || uuidv4();

  const item: UserItem = {
    TenantId: params.tenantId,
    SK: `USER#${userId}`,
    entityType: 'USER',
    userId,
    cognitoSub: params.cognitoSub,
    phoneNumber: params.phoneNumber,
    authMethod: params.authMethod || 'google',
    displayName: params.displayName,
    role: 'MEMBER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    GSI_UserIdPK: `USER#${userId}`,
  };

  if (params.email) {
    item.email = params.email.toLowerCase().trim();
    item.GSI_EmailPK = `EMAIL#${params.email.toLowerCase().trim()}`;
    item.GSI_EmailSK = `USER#${userId}`;
  }

  if (params.phoneNumber) {
    item.GSI_PhonePK = `PHONE#${params.phoneNumber}`;
    item.GSI_PhoneSK = `USER#${userId}`;
  }

  await dynamodb.put({ TableName: USERS_TABLE, Item: item }).promise();
  return item;
}

/**
 * Update lastLoginAt for a user by (tenantId, userId).
 */
export async function updateLastLogin(tenantId: string, userId: string): Promise<void> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();

  if (!tenantId || !userId) {
    throw new Error('updateLastLogin requires tenantId and userId');
  }

  await dynamodb
    .update({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `USER#${userId}` },
      UpdateExpression: 'SET lastLoginAt = :now, updatedAt = :now',
      ExpressionAttributeValues: { ':now': now },
      ConditionExpression: 'attribute_exists(TenantId) AND attribute_exists(SK)',
    })
    .promise();
}

/**
 * Enrich missing profile fields from a new login provider.
 * Only updates a field if it is currently empty.
 */
export async function enrichUserProfile(
  tenantId: string,
  userId: string,
  updates: Partial<Pick<UserItem, 'email' | 'phoneNumber'>>
): Promise<void> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();

  if (!tenantId || !userId) {
    throw new Error('enrichUserProfile requires tenantId and userId');
  }

  const expressionParts: string[] = ['updatedAt = :now'];
  const expressionValues: Record<string, unknown> = { ':now': now };
  const conditionParts: string[] = [];

  if (updates.email) {
    expressionParts.push('email = :email, GSI_EmailPK = :emailPk, GSI_EmailSK = :emailSk');
    expressionValues[':email'] = updates.email.toLowerCase().trim();
    expressionValues[':emailPk'] = `EMAIL#${updates.email.toLowerCase().trim()}`;
    expressionValues[':emailSk'] = `USER#${userId}`;
    conditionParts.push('(attribute_not_exists(email) OR email = :emptyStr)');
    expressionValues[':emptyStr'] = '';
  }

  if (updates.phoneNumber) {
    expressionParts.push('phoneNumber = :phone, GSI_PhonePK = :phonePk, GSI_PhoneSK = :phoneSk');
    expressionValues[':phone'] = updates.phoneNumber;
    expressionValues[':phonePk'] = `PHONE#${updates.phoneNumber}`;
    expressionValues[':phoneSk'] = `USER#${userId}`;
    conditionParts.push('attribute_not_exists(phoneNumber)');
  }

  if (expressionParts.length === 1) return;

  const updateParams: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
    TableName: USERS_TABLE,
    Key: { TenantId: tenantId, SK: `USER#${userId}` },
    UpdateExpression: `SET ${expressionParts.join(', ')}`,
    ExpressionAttributeValues: expressionValues,
    ConditionExpression: 'attribute_exists(TenantId) AND attribute_exists(SK)',
  };

  if (conditionParts.length > 0) {
    updateParams.ConditionExpression = `${updateParams.ConditionExpression} AND ${conditionParts.join(' AND ')}`;
  }

  try {
    await dynamodb.update(updateParams).promise();
  } catch (err: any) {
    if (err?.code === 'ConditionalCheckFailedException') return;
    throw err;
  }
}

/**
 * List all users for a tenant.
 */
export async function listUsersByTenant(tenantId: string): Promise<UserItem[]> {
  const { USERS_TABLE } = getConfig();

  const result = await dynamodb
    .query({
      TableName: USERS_TABLE,
      KeyConditionExpression: 'TenantId = :tid AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':tid': tenantId,
        ':prefix': 'USER#',
      },
    })
    .promise();

  return (result.Items || []) as UserItem[];
}

/**
 * Update user profile fields (displayName only).
 * Does NOT allow updating role, tenantId, email, phoneNumber, or status.
 */
export async function updateUserProfile(
  tenantId: string,
  userId: string,
  updates: Partial<Pick<UserItem, 'displayName'>>
): Promise<void> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();

  const expressionParts: string[] = ['updatedAt = :now'];
  const expressionValues: Record<string, unknown> = { ':now': now };

  if (updates.displayName !== undefined) {
    expressionParts.push('displayName = :displayName');
    expressionValues[':displayName'] = updates.displayName;
  }

  await dynamodb
    .update({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `USER#${userId}` },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeValues: expressionValues,
    })
    .promise();
}

/**
 * Get a user record by (tenantId, userId).
 */
export async function getUserByTenantAndUserId(tenantId: string, userId: string): Promise<UserItem | null> {
  const { USERS_TABLE } = getConfig();

  const result = await dynamodb
    .get({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `USER#${userId}` },
    })
    .promise();

  return (result.Item as UserItem) || null;
}

/**
 * Delete a user record by (tenantId, userId).
 */
export async function deleteUserByTenantAndUserId(tenantId: string, userId: string): Promise<void> {
  const { USERS_TABLE } = getConfig();

  await dynamodb
    .delete({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `USER#${userId}` },
    })
    .promise();
}

/**
 * Find a user by their pendingEmail field (scan-based, used only during Google login linking).
 * This is NOT a GSI lookup — used sparingly when email is not yet canonical.
 */
export async function findUserByPendingEmail(email: string): Promise<UserItem | null> {
  const { USERS_TABLE } = getConfig();
  const normalized = email.toLowerCase().trim();

  const result = await dynamodb
    .scan({
      TableName: USERS_TABLE,
      FilterExpression: 'pendingEmail = :pe AND entityType = :et',
      ExpressionAttributeValues: {
        ':pe': normalized,
        ':et': 'USER',
      },
    })
    .promise();

  if (result.Items && result.Items.length > 0) {
    const validItem = result.Items.find(isValidUserItem);
    return validItem || null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Pending contact helpers (Phase 1)
// ---------------------------------------------------------------------------

/**
 * Assert that a canonical email is not already owned by another user.
 * Returns true if available, false if taken.
 */
export async function assertEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
  const existing = await findUserByEmail(email);
  if (!existing) return true;
  if (excludeUserId && existing.userId === excludeUserId) return true;
  return false;
}

/**
 * Assert that a canonical phone is not already owned by another user.
 * Returns true if available, false if taken.
 */
export async function assertPhoneAvailable(phone: string, excludeUserId?: string): Promise<boolean> {
  const existing = await findUserByPhone(phone);
  if (!existing) return true;
  if (excludeUserId && existing.userId === excludeUserId) return true;
  return false;
}

/**
 * Set a pending email on a user record.
 * Does NOT promote to canonical — that happens on Google login linking or explicit verify.
 */
export async function setPendingEmail(
  tenantId: string,
  userId: string,
  pendingEmail: string
): Promise<void> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();

  await dynamodb
    .update({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `USER#${userId}` },
      UpdateExpression: 'SET pendingEmail = :pe, pendingEmailRequestedAt = :now, updatedAt = :now',
      ExpressionAttributeValues: {
        ':pe': pendingEmail.toLowerCase().trim(),
        ':now': now,
      },
      ConditionExpression: 'attribute_exists(TenantId) AND attribute_exists(SK)',
    })
    .promise();
}

/**
 * Clear pending email fields on a user record.
 */
export async function clearPendingEmail(tenantId: string, userId: string): Promise<void> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();

  await dynamodb
    .update({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `USER#${userId}` },
      UpdateExpression: 'REMOVE pendingEmail, pendingEmailRequestedAt SET updatedAt = :now',
      ExpressionAttributeValues: { ':now': now },
      ConditionExpression: 'attribute_exists(TenantId) AND attribute_exists(SK)',
    })
    .promise();
}

/**
 * Set a pending phone number on a user record.
 */
export async function setPendingPhone(
  tenantId: string,
  userId: string,
  pendingPhone: string
): Promise<void> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();

  await dynamodb
    .update({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `USER#${userId}` },
      UpdateExpression: 'SET pendingPhoneNumber = :pp, pendingPhoneRequestedAt = :now, updatedAt = :now',
      ExpressionAttributeValues: {
        ':pp': pendingPhone,
        ':now': now,
      },
      ConditionExpression: 'attribute_exists(TenantId) AND attribute_exists(SK)',
    })
    .promise();
}

/**
 * Clear pending phone fields on a user record.
 */
export async function clearPendingPhone(tenantId: string, userId: string): Promise<void> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();

  await dynamodb
    .update({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `USER#${userId}` },
      UpdateExpression: 'REMOVE pendingPhoneNumber, pendingPhoneRequestedAt SET updatedAt = :now',
      ExpressionAttributeValues: { ':now': now },
      ConditionExpression: 'attribute_exists(TenantId) AND attribute_exists(SK)',
    })
    .promise();
}

/**
 * Promote pending email to canonical email.
 * Sets email + GSI fields, marks emailVerified = true, clears pending fields.
 * Guarded: only succeeds if pendingEmail matches the expected value.
 */
export async function promotePendingEmail(
  tenantId: string,
  userId: string,
  expectedEmail: string
): Promise<boolean> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();
  const normalized = expectedEmail.toLowerCase().trim();

  try {
    await dynamodb
      .update({
        TableName: USERS_TABLE,
        Key: { TenantId: tenantId, SK: `USER#${userId}` },
        UpdateExpression: [
          'SET email = :email, GSI_EmailPK = :emailPk, GSI_EmailSK = :emailSk,',
          'emailVerified = :t, updatedAt = :now',
          'REMOVE pendingEmail, pendingEmailRequestedAt',
        ].join(' '),
        ExpressionAttributeValues: {
          ':email': normalized,
          ':emailPk': `EMAIL#${normalized}`,
          ':emailSk': `USER#${userId}`,
          ':t': true,
          ':now': now,
          ':expectedPe': normalized,
        },
        ConditionExpression:
          'attribute_exists(TenantId) AND attribute_exists(SK) AND pendingEmail = :expectedPe',
      })
      .promise();
    return true;
  } catch (err: any) {
    if (err?.code === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}

/**
 * Promote pending phone to canonical phone.
 * Sets phoneNumber + GSI fields, marks phoneVerified = true, clears pending fields.
 * Guarded: only succeeds if pendingPhoneNumber matches the expected value.
 */
export async function promotePendingPhone(
  tenantId: string,
  userId: string,
  expectedPhone: string
): Promise<boolean> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();

  try {
    await dynamodb
      .update({
        TableName: USERS_TABLE,
        Key: { TenantId: tenantId, SK: `USER#${userId}` },
        UpdateExpression: [
          'SET phoneNumber = :phone, GSI_PhonePK = :phonePk, GSI_PhoneSK = :phoneSk,',
          'phoneVerified = :t, updatedAt = :now',
          'REMOVE pendingPhoneNumber, pendingPhoneRequestedAt',
        ].join(' '),
        ExpressionAttributeValues: {
          ':phone': expectedPhone,
          ':phonePk': `PHONE#${expectedPhone}`,
          ':phoneSk': `USER#${userId}`,
          ':t': true,
          ':now': now,
          ':expectedPp': expectedPhone,
        },
        ConditionExpression:
          'attribute_exists(TenantId) AND attribute_exists(SK) AND pendingPhoneNumber = :expectedPp',
      })
      .promise();
    return true;
  } catch (err: any) {
    if (err?.code === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}
