import AWS from 'aws-sdk';
import crypto from 'crypto';
import { getConfig } from '../config/config';

const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS({ region: 'ap-south-1' });

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 300; // 5 minutes
const MAX_ATTEMPTS = 3;

function generateOtp(): string {
  const digits = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return digits.toString().padStart(OTP_LENGTH, '0');
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function buildSK(userId: string): string {
  return `OTP#PHONE_LINK#${userId}`;
}

export interface PhoneLinkOtpRecord {
  PhoneNumber: string;
  SK: string;
  otpHash: string;
  attempts: number;
  createdAt: string;
  ttl: number;
  tenantId: string;
  requestedByUserId: string;
  targetUserId: string;
}

/**
 * Create a phone-link OTP, store it in OtpTable, and send SMS.
 * Returns the OTP only in test mode; otherwise returns null.
 */
export async function createPhoneLinkOtp(params: {
  phoneNumber: string;
  tenantId: string;
  requestedByUserId: string;
  targetUserId: string;
}): Promise<{ sent: boolean; testOtp?: string }> {
  const { OTP_TABLE } = getConfig();
  const isTest = process.env.TEST_OTP_ENABLED === 'true';
  const testOtpValue = process.env.TEST_OTP_VALUE || '123456';

  // Use fixed test OTP when enabled; otherwise random
  const otp = isTest ? testOtpValue : generateOtp();
  const otpH = hashOtp(otp);
  const now = new Date();
  const ttl = Math.floor(now.getTime() / 1000) + OTP_TTL_SECONDS;

  const item: PhoneLinkOtpRecord = {
    PhoneNumber: params.phoneNumber,
    SK: buildSK(params.targetUserId),
    otpHash: otpH,
    attempts: 0,
    createdAt: now.toISOString(),
    ttl,
    tenantId: params.tenantId,
    requestedByUserId: params.requestedByUserId,
    targetUserId: params.targetUserId,
  };

  await dynamodb
    .put({
      TableName: OTP_TABLE,
      Item: item,
    })
    .promise();

  // Send SMS via SNS ONLY when NOT in test mode
  if (!isTest) {
    await sns
      .publish({
        PhoneNumber: params.phoneNumber,
        Message: `Your phone verification code is ${otp}. Valid for 5 minutes.`,
      })
      .promise();
  }

  return { sent: true, testOtp: isTest ? otp : undefined };
}

/**
 * Verify a phone-link OTP.
 * Returns true if OTP is correct, false otherwise.
 * Handles expiry, attempt limits, and cleanup.
 */
export async function verifyPhoneLinkOtp(params: {
  phoneNumber: string;
  targetUserId: string;
  otp: string;
}): Promise<{ valid: boolean; reason?: string }> {
  const { OTP_TABLE } = getConfig();
  const sk = buildSK(params.targetUserId);

  const result = await dynamodb
    .get({
      TableName: OTP_TABLE,
      Key: { PhoneNumber: params.phoneNumber, SK: sk },
    })
    .promise();

  const record = result.Item as PhoneLinkOtpRecord | undefined;

  if (!record) {
    return { valid: false, reason: 'No pending OTP found' };
  }

  const now = Date.now();

  // Check expiry
  if (now > record.ttl * 1000) {
    await deletePhoneLinkOtp(params.phoneNumber, params.targetUserId);
    return { valid: false, reason: 'OTP expired' };
  }

  // Check attempts
  if (record.attempts >= MAX_ATTEMPTS) {
    await deletePhoneLinkOtp(params.phoneNumber, params.targetUserId);
    return { valid: false, reason: 'Too many attempts' };
  }

  // Verify hash
  const inputHash = hashOtp(params.otp);
  if (inputHash === record.otpHash) {
    await deletePhoneLinkOtp(params.phoneNumber, params.targetUserId);
    return { valid: true };
  }

  // Increment attempts
  await dynamodb
    .update({
      TableName: OTP_TABLE,
      Key: { PhoneNumber: params.phoneNumber, SK: sk },
      UpdateExpression: 'SET attempts = attempts + :inc',
      ExpressionAttributeValues: { ':inc': 1 },
    })
    .promise();

  return { valid: false, reason: 'Invalid OTP' };
}

/**
 * Delete a phone-link OTP record.
 */
export async function deletePhoneLinkOtp(phoneNumber: string, targetUserId: string): Promise<void> {
  const { OTP_TABLE } = getConfig();

  await dynamodb
    .delete({
      TableName: OTP_TABLE,
      Key: { PhoneNumber: phoneNumber, SK: buildSK(targetUserId) },
    })
    .promise();
}
