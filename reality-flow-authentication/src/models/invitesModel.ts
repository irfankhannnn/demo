import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../config/config';

const dynamodb = new AWS.DynamoDB.DocumentClient();

export interface InviteItem {
  TenantId: string;
  SK: string;
  entityType: 'INVITE';
  inviteCode: string;
  invitedBySub: string;
  inviteeEmail?: string;  // Optional - can have both email and phone
  inviteePhone?: string;  // Optional - can have both email and phone
  intendedRole: 'MEMBER';
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  GSI_SubPK: string;
  GSI_SubSK: string;
  GSI_EmailPK?: string;  // Optional - populated if inviteeEmail provided
  GSI_EmailSK?: string;  // Optional - populated if inviteeEmail provided
  GSI_PhonePK?: string;  // Optional - populated if inviteePhone provided
  GSI_PhoneSK?: string;  // Optional - populated if inviteePhone provided
}

/**
 * Create a new invite for a member.
 * Supports dual-contact invites: both email and phone can be provided.
 */
export async function createInvite(params: {
  tenantId: string;
  invitedBySub: string;
  inviteeEmail?: string;
  inviteePhone?: string;
  expiresInDays?: number;
}): Promise<InviteItem> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();
  const inviteCode = uuidv4();
  const expiresInDays = params.expiresInDays ?? 7;

  if (!params.inviteeEmail && !params.inviteePhone) {
    throw new Error('Either inviteeEmail or inviteePhone must be provided');
  }

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiresInDays);

  const item: InviteItem = {
    TenantId: params.tenantId,
    SK: `INVITE#${inviteCode}`,
    entityType: 'INVITE',
    inviteCode,
    invitedBySub: params.invitedBySub,
    intendedRole: 'MEMBER',
    status: 'PENDING',
    expiresAt: expiryDate.toISOString(),
    createdAt: now,
    updatedAt: now,
    GSI_SubPK: `INVITE#${inviteCode}`,
    GSI_SubSK: `TENANT#${params.tenantId}`,
  };

  // Add email fields if provided
  if (params.inviteeEmail) {
    item.inviteeEmail = params.inviteeEmail.toLowerCase().trim();
    item.GSI_EmailPK = `EMAIL#${params.inviteeEmail.toLowerCase().trim()}`;
    item.GSI_EmailSK = `INVITE#${inviteCode}`;
  }

  // Add phone fields if provided
  if (params.inviteePhone) {
    item.inviteePhone = params.inviteePhone;
    item.GSI_PhonePK = `PHONE#${params.inviteePhone}`;
    item.GSI_PhoneSK = `INVITE#${inviteCode}`;
  }

  await dynamodb.put({ TableName: USERS_TABLE, Item: item }).promise();
  return item;
}

/**
 * Find pending invites by email address using EmailIndex GSI.
 */
export async function findInvitesByEmail(email: string): Promise<InviteItem[]> {
  const { USERS_TABLE } = getConfig();

  const result = await dynamodb
    .query({
      TableName: USERS_TABLE,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'GSI_EmailPK = :emailPk',
      FilterExpression: 'entityType = :et AND #status = :pending',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':emailPk': `EMAIL#${email.toLowerCase()}`,
        ':et': 'INVITE',
        ':pending': 'PENDING',
      },
    })
    .promise();

  return (result.Items || []) as InviteItem[];
}

/**
 * Find pending invites by phone number using PhoneIndex GSI.
 */
export async function findInvitesByPhone(phone: string): Promise<InviteItem[]> {
  const { USERS_TABLE } = getConfig();

  const result = await dynamodb
    .query({
      TableName: USERS_TABLE,
      IndexName: 'PhoneIndex',
      KeyConditionExpression: 'GSI_PhonePK = :phonePk',
      FilterExpression: 'entityType = :et AND #status = :pending',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':phonePk': `PHONE#${phone}`,
        ':et': 'INVITE',
        ':pending': 'PENDING',
      },
    })
    .promise();

  return (result.Items || []) as InviteItem[];
}

/**
 * Get a specific invite by tenantId and inviteCode.
 */
export async function getInvite(tenantId: string, inviteCode: string): Promise<InviteItem | null> {
  const { USERS_TABLE } = getConfig();

  const result = await dynamodb
    .get({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `INVITE#${inviteCode}` },
    })
    .promise();

  return (result.Item as InviteItem) || null;
}

/**
 * Mark an invite as accepted.
 */
export async function markInviteAccepted(tenantId: string, inviteCode: string): Promise<void> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();

  await dynamodb
    .update({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `INVITE#${inviteCode}` },
      UpdateExpression: 'SET #status = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'ACCEPTED', ':now': now },
    })
    .promise();
}

/**
 * Delete an invite after it has been successfully consumed.
 */
export async function deleteInvite(tenantId: string, inviteCode: string): Promise<void> {
  const { USERS_TABLE } = getConfig();

  await dynamodb
    .delete({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `INVITE#${inviteCode}` },
    })
    .promise();
}

/**
 * Mark an invite as revoked.
 */
export async function revokeInvite(tenantId: string, inviteCode: string): Promise<void> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();

  await dynamodb
    .update({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `INVITE#${inviteCode}` },
      UpdateExpression: 'SET #status = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'REVOKED', ':now': now },
    })
    .promise();
}

/**
 * List all invites for a tenant.
 */
export async function listInvitesByTenant(
  tenantId: string,
  statusFilter?: InviteItem['status']
): Promise<InviteItem[]> {
  const { USERS_TABLE } = getConfig();

  const params: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: USERS_TABLE,
    KeyConditionExpression: 'TenantId = :tid AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':tid': tenantId,
      ':prefix': 'INVITE#',
    },
  };

  if (statusFilter) {
    params.FilterExpression = '#status = :statusVal';
    params.ExpressionAttributeNames = { '#status': 'status' };
    params.ExpressionAttributeValues![':statusVal'] = statusFilter;
  }

  const result = await dynamodb.query(params).promise();
  return (result.Items || []) as InviteItem[];
}

/**
 * Update a pending invite's email address.
 * This also updates the EmailIndex partition key (GSI_EmailPK).
 */
export async function updateInviteEmail(
  tenantId: string,
  inviteCode: string,
  newEmail: string
): Promise<void> {
  const { USERS_TABLE } = getConfig();
  const now = new Date().toISOString();

  await dynamodb
    .update({
      TableName: USERS_TABLE,
      Key: { TenantId: tenantId, SK: `INVITE#${inviteCode}` },
      UpdateExpression: 'SET inviteeEmail = :email, GSI_EmailPK = :emailPk, updatedAt = :now',
      ConditionExpression: '#status = :pending',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':email': newEmail,
        ':emailPk': `EMAIL#${newEmail.toLowerCase()}`,
        ':now': now,
        ':pending': 'PENDING',
      },
    })
    .promise();
}
