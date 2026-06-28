/**
 * Auth-state adapter.
 *
 * LOCAL_STORAGE=true  → useMultiFileAuthState (filesystem, baileys-service style)
 * LOCAL_STORAGE=false → useS3AuthState (S3 + KMS, whatsapp-platform style)
 *
 * Both adapters return { state, saveCreds } in the same shape expected by
 * makeWASocket, so baileysClient.js is storage-agnostic.
 */
import path from 'path';
import fs from 'fs/promises';
import { useMultiFileAuthState, initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import {
  LOCAL_STORAGE,
  AUTH_STATE_DIR,
  AWS_REGION,
  SESSION_BUCKET_NAME,
  SESSION_KMS_KEY_ID,
} from '../config.js';
import { logger } from '../logger.js';

// ─── S3 helpers ───────────────────────────────────────────────────────────────
let s3Client = null;
function getS3() {
  if (!s3Client) s3Client = new S3Client({ region: AWS_REGION });
  return s3Client;
}

function prefixFor(phone) {
  return `sessions/${phone}/`;
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function s3ListKeys(phone, bucket) {
  const prefix = prefixFor(phone);
  const keys = [];
  let token;
  do {
    const res = await getS3().send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: token,
    }));
    for (const item of res.Contents || []) {
      if (item.Key && item.Key !== prefix) keys.push(item.Key.replace(prefix, ''));
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function s3Read(phone, file, bucket) {
  const key = `${prefixFor(phone)}${file}`;
  try {
    const res = await getS3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await streamToString(res.Body);
    return JSON.parse(body, BufferJSON.reviver);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

async function s3Write(phone, file, data, bucket) {
  const key = `${prefixFor(phone)}${file}`;
  const params = {
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(data, BufferJSON.replacer),
    ContentType: 'application/json',
    ServerSideEncryption: 'aws:kms',
    ...(SESSION_KMS_KEY_ID && { SSEKMSKeyId: SESSION_KMS_KEY_ID }),
  };
  await getS3().send(new PutObjectCommand(params));
}

async function s3DeletePrefix(phone, bucket) {
  const files = await s3ListKeys(phone, bucket);
  await Promise.all(files.map(file =>
    getS3().send(new DeleteObjectCommand({ Bucket: bucket, Key: `${prefixFor(phone)}${file}` }))
  ));
  logger.info({ phone, fileCount: files.length }, 'authState.s3.deleted');
}

// ─── S3 auth state (matches useMultiFileAuthState contract) ───────────────────
async function useS3AuthState(phone) {
  const bucket = SESSION_BUCKET_NAME;
  const fileNames = await s3ListKeys(phone, bucket);
  let creds;
  const keys = {};

  if (fileNames.includes('creds.json')) {
    creds = await s3Read(phone, 'creds.json', bucket);
  } else {
    creds = initAuthCreds();
  }

  for (const file of fileNames) {
    if (file === 'creds.json') continue;
    keys[file] = await s3Read(phone, file, bucket);
  }

  const state = { creds, keys };

  const saveCreds = async () => {
    await s3Write(phone, 'creds.json', state.creds, bucket);
    await Promise.all(
      Object.entries(state.keys).map(([file, data]) => s3Write(phone, file, data, bucket))
    );
  };

  return { state, saveCreds };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get auth state for a phone number.
 * Uses filesystem when LOCAL_STORAGE=true, S3 otherwise.
 * Returns { state, saveCreds } — same contract as useMultiFileAuthState.
 */
export async function getAuthState(phone) {
  if (LOCAL_STORAGE) {
    const dir = path.join(AUTH_STATE_DIR, phone);
    await fs.mkdir(dir, { recursive: true });
    return useMultiFileAuthState(dir);
  }
  return useS3AuthState(phone);
}

/**
 * Delete persisted auth state for a phone number.
 */
export async function deleteAuthState(phone) {
  if (LOCAL_STORAGE) {
    const dir = path.join(AUTH_STATE_DIR, phone);
    await fs.rm(dir, { recursive: true, force: true });
    logger.info({ phone, dir }, 'authState.local.deleted');
  } else {
    await s3DeletePrefix(phone, SESSION_BUCKET_NAME);
  }
}

/**
 * List phones that have persisted auth state.
 * Used by restoreSessions() on startup.
 */
export async function listPersistedPhones() {
  if (LOCAL_STORAGE) {
    try {
      const entries = await fs.readdir(AUTH_STATE_DIR, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory() && /^\d+$/.test(e.name))
        .map(e => e.name);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }
  // S3: list top-level "sessions/" prefixes
  try {
    const res = await getS3().send(new ListObjectsV2Command({
      Bucket: SESSION_BUCKET_NAME,
      Prefix: 'sessions/',
      Delimiter: '/',
    }));
    return (res.CommonPrefixes || [])
      .map(p => p.Prefix?.replace('sessions/', '').replace('/', ''))
      .filter(Boolean);
  } catch (err) {
    logger.warn({ error: err.message }, 'authState.listPersistedPhones.failed');
    return [];
  }
}
