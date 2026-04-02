import AWS from 'aws-sdk';
import { getConfig } from '../config/config';

const dynamodb = new AWS.DynamoDB.DocumentClient();

export interface AgencyConfigItem {
  TenantId: string;
  agencyName: string;
  adminEmail?: string;
  adminPhone?: string;
  address?: string;
  city?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  notificationSettings?: {
    rentedExpiryThresholdDays: number;
    meetingReminderMinutes: number;
    enableRentExpiryNotifications: boolean;
    enableMeetingReminders: boolean;
    enableKhataReminders: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Get agency config by TenantId.
 */
export async function getAgencyConfig(tenantId: string): Promise<AgencyConfigItem | null> {
  const { AGENCY_CONFIG_TABLE } = getConfig();

  const result = await dynamodb
    .get({
      TableName: AGENCY_CONFIG_TABLE,
      Key: { TenantId: tenantId },
    })
    .promise();

  return (result.Item as AgencyConfigItem) || null;
}

/**
 * Find agency by admin email (uses AdminEmailIndex GSI).
 * Used to check if an admin is pre-onboarded during login.
 */
export async function findAgencyByAdminEmail(email: string): Promise<AgencyConfigItem | null> {
  const { AGENCY_CONFIG_TABLE } = getConfig();

  const result = await dynamodb
    .query({
      TableName: AGENCY_CONFIG_TABLE,
      IndexName: 'AdminEmailIndex',
      KeyConditionExpression: 'adminEmail = :email',
      ExpressionAttributeValues: {
        ':email': email.toLowerCase().trim(),
      },
      Limit: 1,
    })
    .promise();

  return (result.Items?.[0] as AgencyConfigItem) || null;
}

/**
 * Find agency by admin phone (uses AdminPhoneIndex GSI).
 * Used to check if an admin is pre-onboarded during phone login.
 */
export async function findAgencyByAdminPhone(phone: string): Promise<AgencyConfigItem | null> {
  const { AGENCY_CONFIG_TABLE } = getConfig();

  const result = await dynamodb
    .query({
      TableName: AGENCY_CONFIG_TABLE,
      IndexName: 'AdminPhoneIndex',
      KeyConditionExpression: 'adminPhone = :phone',
      ExpressionAttributeValues: {
        ':phone': phone.trim(),
      },
      Limit: 1,
    })
    .promise();

  return (result.Items?.[0] as AgencyConfigItem) || null;
}

/**
 * Create a new agency config record.
 */
export async function createAgencyConfig(params: {
  tenantId: string;
  agencyName: string;
  adminEmail: string;
}): Promise<AgencyConfigItem> {
  const { AGENCY_CONFIG_TABLE } = getConfig();
  const now = new Date().toISOString();

  const item: AgencyConfigItem = {
    TenantId: params.tenantId,
    agencyName: params.agencyName,
    adminEmail: params.adminEmail,
    status: 'ACTIVE',
    notificationSettings: {
      rentedExpiryThresholdDays: 30,
      meetingReminderMinutes: 15,
      enableRentExpiryNotifications: true,
      enableMeetingReminders: true,
      enableKhataReminders: true,
    },
    createdAt: now,
    updatedAt: now,
  };

  await dynamodb.put({ TableName: AGENCY_CONFIG_TABLE, Item: item }).promise();
  return item;
}

/**
 * Update agency config fields.
 */
export async function updateAgencyConfig(
  tenantId: string,
  updates: Partial<Pick<AgencyConfigItem, 'agencyName' | 'address' | 'city' | 'notificationSettings' | 'status'>>
): Promise<void> {
  const { AGENCY_CONFIG_TABLE } = getConfig();
  const now = new Date().toISOString();

  const expressionParts: string[] = ['updatedAt = :now'];
  const expressionValues: Record<string, unknown> = { ':now': now };

  if (updates.agencyName !== undefined) {
    expressionParts.push('agencyName = :name');
    expressionValues[':name'] = updates.agencyName;
  }
  if (updates.address !== undefined) {
    expressionParts.push('address = :address');
    expressionValues[':address'] = updates.address;
  }
  if (updates.city !== undefined) {
    expressionParts.push('city = :city');
    expressionValues[':city'] = updates.city;
  }
  if (updates.notificationSettings !== undefined) {
    expressionParts.push('notificationSettings = :ns');
    expressionValues[':ns'] = updates.notificationSettings;
  }
  if (updates.status !== undefined) {
    expressionParts.push('#status = :status');
    expressionValues[':status'] = updates.status;
  }

  await dynamodb
    .update({
      TableName: AGENCY_CONFIG_TABLE,
      Key: { TenantId: tenantId },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeValues: expressionValues,
      ...(updates.status !== undefined
        ? { ExpressionAttributeNames: { '#status': 'status' } }
        : {}),
    })
    .promise();
}
