import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { logger } from './logger.js';
import { wrapAwsClient } from './awsClientWrapper.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Ensure .env is loaded before reading environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// AWS_REGION is automatically provided by Lambda runtime, fallback to ap-south-1 for local dev
const REGION = process.env.AWS_REGION || 'ap-south-1';
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// Initialize S3 client (uses env credentials by default)
const s3 = wrapAwsClient(new S3Client({ region: REGION }), 'S3', { bucketName: BUCKET_NAME });

function ensureBucketConfigured() {
  if (!BUCKET_NAME || BUCKET_NAME.trim().length === 0) {
    throw new Error('S3 bucket is not configured. Set S3_BUCKET_NAME in server/.env');
  }
}

/**
 * Upload file to S3 (SDK v3) with structured folder path (Multi-Tenant)
 * @param {Buffer} fileBuffer
 * @param {string} originalFilename
 * @param {string} mimeType
 * @param {Object|string} folderStructure - { tenantId, area, building, flatNo } or 'crm/properties/images' or 'crm/properties/videos'
 * @param {string} tenantId - Tenant ID for multi-tenancy (required)
 * @returns {Promise<string>} - Returns S3 key
 */
export async function uploadToS3(fileBuffer, originalFilename, mimeType, folderStructure = null, tenantId = null) {
  ensureBucketConfigured();

  if (!tenantId) {
    throw new Error('Tenant ID is required for file uploads');
  }

  const fileExtension = path.extname(originalFilename);
  const uniqueFilename = `${uuidv4()}${fileExtension}`;
  
  // Create structured path with tenant_id prefix
  let key;
  
  // If folderStructure is a string (like 'crm/properties/images'), use it with tenant prefix
  if (typeof folderStructure === 'string') {
    key = `${tenantId}/${folderStructure}/${uniqueFilename}`;
  }
  // Legacy format: { area, building, flatNo }
  else if (folderStructure && folderStructure.area && folderStructure.building) {
    const area = folderStructure.area.replace(/[^a-zA-Z0-9]/g, '_');
    const building = folderStructure.building.replace(/[^a-zA-Z0-9]/g, '_');
    const flatNo = folderStructure.flatNo ? folderStructure.flatNo.replace(/[^a-zA-Z0-9]/g, '_') : '';
    
    if (flatNo) {
      key = `${tenantId}/properties/${area}/${building}/${flatNo}/${uniqueFilename}`;
    } else {
      key = `${tenantId}/properties/${area}/${building}/${uniqueFilename}`;
    }
  } else {
    key = `${tenantId}/documents/${uniqueFilename}`;
  }

  try {
    const cmd = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    });
    await logger.span('s3.upload', { bucket: BUCKET_NAME, key, mimeType, tenantId }, async () => {
      await s3.send(cmd);
    });
    return key; // Return just the key
  } catch (error) {
    logger.error('s3.upload.error', {
      bucket: BUCKET_NAME,
      key,
      mimeType,
      tenantId,
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack,
    });
    throw new Error('Failed to upload file to S3');
  }
}

/**
 * Generate pre-signed URL (SDK v3)
 * @param {string} key
 * @param {number} expiresIn seconds (default 3600)
 * @returns {Promise<string>}
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
  ensureBucketConfigured();
  try {
    const cmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    const url = await logger.span('s3.presign', { bucket: BUCKET_NAME, key, expiresIn }, async () => {
      return await getSignedUrl(s3, cmd, { expiresIn });
    });
    return url;
  } catch (error) {
    logger.error('s3.presign.error', {
      bucket: BUCKET_NAME,
      key,
      expiresIn,
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack,
    });
    throw new Error('Failed to generate pre-signed URL');
  }
}

/**
 * Delete file from S3 (SDK v3)
 * @param {string} key
 */
export async function deleteFromS3(key) {
  ensureBucketConfigured();
  try {
    const cmd = new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    await logger.span('s3.delete', { bucket: BUCKET_NAME, key }, async () => {
      await s3.send(cmd);
    });
  } catch (error) {
    logger.error('s3.delete.error', {
      bucket: BUCKET_NAME,
      key,
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack,
    });
    throw new Error('Failed to delete file from S3');
  }
}

// Alias for CRM compatibility
export { getPresignedUrl as getSignedUrl };
