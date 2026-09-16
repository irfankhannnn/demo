import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
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

// Separate client used only for presigning browser uploads.
//
// Since v3.729 the SDK defaults to requestChecksumCalculation: 'WHEN_SUPPORTED',
// so presigning a PutObjectCommand (which has no Body) computes a CRC32 of an
// empty payload and hoists it into the *signed* query string as
// x-amz-checksum-crc32=AAAAAA==. The browser then PUTs the real file and S3
// rejects it with BadDigest because the body no longer matches that checksum.
// 'WHEN_REQUIRED' keeps checksums off presigned URLs while still emitting them
// for the operations that mandate them. The main `s3` client above keeps the
// default so server-side uploads retain their integrity checks.
const s3Presign = new S3Client({ region: REGION, requestChecksumCalculation: 'WHEN_REQUIRED' });

function ensureBucketConfigured() {
  if (!BUCKET_NAME || BUCKET_NAME.trim().length === 0) {
    throw new Error('S3 bucket is not configured. Set S3_BUCKET_NAME in apps/crm/server/.env');
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

/**
 * Generate a pre-signed PUT URL so a browser can upload directly to S3
 * without streaming the file through the API Lambda.
 * @param {string} key
 * @param {string} contentType must match the Content-Type the client sends
 * @param {number} expiresIn seconds (default 900)
 * @returns {Promise<string>}
 */
export async function getPresignedUploadUrl(key, contentType, expiresIn = 900) {
  ensureBucketConfigured();
  try {
    const cmd = new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: contentType });
    return await logger.span('s3.presignUpload', { bucket: BUCKET_NAME, key, contentType, expiresIn }, async () => {
      return await getSignedUrl(s3Presign, cmd, { expiresIn });
    });
  } catch (error) {
    logger.error('s3.presignUpload.error', {
      bucket: BUCKET_NAME,
      key,
      contentType,
      errorMessage: error?.message,
      errorName: error?.name,
    });
    throw new Error('Failed to generate pre-signed upload URL');
  }
}

/**
 * Fetch object metadata. Returns null when the object does not exist.
 * @param {string} key
 * @returns {Promise<{contentLength: number, contentType: string, lastModified: Date}|null>}
 */
export async function headObject(key) {
  ensureBucketConfigured();
  try {
    const result = await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    return {
      contentLength: result.ContentLength,
      contentType: result.ContentType,
      lastModified: result.LastModified,
    };
  } catch (error) {
    if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    logger.error('s3.head.error', { bucket: BUCKET_NAME, key, errorMessage: error?.message, errorName: error?.name });
    throw new Error('Failed to read object metadata from S3');
  }
}

/**
 * Read an object as UTF-8 text (used for transcript/analysis JSON).
 * @param {string} key
 * @returns {Promise<string>}
 */
export async function getObjectText(key) {
  ensureBucketConfigured();
  const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
  return await result.Body.transformToString('utf-8');
}

/**
 * Write a UTF-8 text/JSON object.
 * @param {string} key
 * @param {string} body
 * @param {string} contentType
 */
export async function putObjectText(key, body, contentType = 'application/json') {
  ensureBucketConfigured();
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return key;
}

/** Bucket name currently configured (needed by Amazon Transcribe job input/output). */
export function getBucketName() {
  ensureBucketConfigured();
  return BUCKET_NAME;
}

// Alias for CRM compatibility
export { getPresignedUrl as getSignedUrl };
