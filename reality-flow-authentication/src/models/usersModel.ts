import AWS from 'aws-sdk';
import { getConfig } from '../config/config';

const dynamodb = new AWS.DynamoDB.DocumentClient();

export interface UserItem {
  TenantId: string;
  SK: string;
  entityType: 'USER';
  cognitoSub: string;
  email: string;
  phoneNumber?: string;
  displayName: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  GSI_SubPK: string;
  GSI_SubSK: string;
  GSI_EmailPK: string;
  GSI_EmailSK: string;
}

/**
 * Find a user by their Cognito sub.
 * First checks if user is an admin (TenantId = sub), then checks SubIndex GSI.
 */
export async function findUserBySub(cognitoSub: string): Promise<UserItem | null> {
  const { USERS_TABLE } = getConfig();

  // 1. Check if user is an admin (their own tenant)
  const adminResult = await dynamodb
    .get({
      TableName: USERS_TABLE,
      Key: { TenantId: cognitoSub, SK: `USER#${cognitoSub}` },
    })
    .promise();

  if (adminResult.Item) {
    return adminResult.Item as UserItem;
  }

  // 2. Check SubIndex GSI for member records
  const memberResult = await dynamodb
    .query({
      TableName: USERS_TABLE,
      IndexName: 'SubIndex',
      KeyConditionExpression: 'GSI_SubPK = :subPk',
      ExpressionAttributeValues: {
        ':subPk': `SUB#${cognitoSub}`,
      },
    })
    .promise();

  if (memberResult.Items && memberResult.Items.length > 0) {
    return memberResult.Items[0] as UserItem;
  }

  return null;
}

/**
 * Create admin user record in UsersTable.
 */
export async function createAdminUser(params: {
  cognitoSub: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
}): Promise<UserItem> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();

  const item: UserItem = {
    TenantId: params.cognitoSub,
    SK: `USER#${params.cognitoSub}`,
    entityType: 'USER',
    cognitoSub: params.cognitoSub,
    email: params.email,
    phoneNumber: params.phoneNumber,
    displayName: params.displayName,
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    GSI_SubPK: `SUB#${params.cognitoSub}`,
    GSI_SubSK: `TENANT#${params.cognitoSub}`,
    GSI_EmailPK: `EMAIL#${params.email.toLowerCase()}`,
    GSI_EmailSK: `USER#${params.cognitoSub}`,
  };

  await dynamodb.put({ TableName: USERS_TABLE, Item: item }).promise();
  return item;
}

/**
 * Create member user record in UsersTable.
 */
export async function createMemberUser(params: {
  tenantId: string;
  cognitoSub: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
}): Promise<UserItem> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();

  const item: UserItem = {
    TenantId: params.tenantId,
    SK: `USER#${params.cognitoSub}`,
    entityType: 'USER',
    cognitoSub: params.cognitoSub,
    email: params.email,
    phoneNumber: params.phoneNumber,
    displayName: params.displayName,
    role: 'MEMBER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    GSI_SubPK: `SUB#${params.cognitoSub}`,
    GSI_SubSK: `TENANT#${params.tenantId}`,
    GSI_EmailPK: `EMAIL#${params.email.toLowerCase()}`,
    GSI_EmailSK: `USER#${params.cognitoSub}`,
  };

  await dynamodb.put({ TableName: USERS_TABLE, Item: item }).promise();
  return item;
}

/**
 * Update lastLoginAt for a user.
 */
export async function updateLastLogin(tenantId: string, cognitoSub: string): Promise<void> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();

  await dynamodb
    .update({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `USER#${cognitoSub}` },
      UpdateExpression: 'SET lastLoginAt = :now, updatedAt = :now',
      ExpressionAttributeValues: { ':now': now },
    })
    .promise();
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
 * Update user profile fields (displayName, phoneNumber).
 * Does NOT allow updating role, tenantId, email, or status.
 */
export async function updateUserProfile(
  tenantId: string,
  cognitoSub: string,
  updates: Partial<Pick<UserItem, 'displayName' | 'phoneNumber'>>
): Promise<void> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();

  const expressionParts: string[] = ['updatedAt = :now'];
  const expressionValues: Record<string, unknown> = { ':now': now };

  if (updates.displayName !== undefined) {
    expressionParts.push('displayName = :displayName');
    expressionValues[':displayName'] = updates.displayName;
  }
  if (updates.phoneNumber !== undefined) {
    expressionParts.push('phoneNumber = :phoneNumber');
    expressionValues[':phoneNumber'] = updates.phoneNumber;
  }

  await dynamodb
    .update({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `USER#${cognitoSub}` },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeValues: expressionValues,
    })
    .promise();
}

/**
 * Get a user record by tenantId + Cognito sub.
 */
export async function getUserByTenantAndSub(tenantId: string, cognitoSub: string): Promise<UserItem | null> {
  const { USERS_TABLE } = getConfig();

  const result = await dynamodb
    .get({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `USER#${cognitoSub}` },
    })
    .promise();

  return (result.Item as UserItem) || null;
}

/**
 * Delete a user record by tenantId + Cognito sub.
 */
export async function deleteUserByTenantAndSub(tenantId: string, cognitoSub: string): Promise<void> {
  const { USERS_TABLE } = getConfig();

  await dynamodb
    .delete({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `USER#${cognitoSub}` },
    })
    .promise();
}
