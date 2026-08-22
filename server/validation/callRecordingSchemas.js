import { z } from 'zod';
import { ALLOWED_AUDIO_MIME_TYPES, DEFAULT_MAX_UPLOAD_BYTES, ENTITY_TYPE } from '../services/callIntelligence/constants.js';

const MAX_UPLOAD_BYTES = parseInt(process.env.CALL_INTEL_MAX_UPLOAD_BYTES || String(DEFAULT_MAX_UPLOAD_BYTES), 10);

export const createUploadUrlSchema = z.object({
  filename: z.string().min(1).max(400),
  contentType: z.string().min(1).max(200).refine(
    (value) => ALLOWED_AUDIO_MIME_TYPES.includes(value.toLowerCase()),
    { message: `Unsupported audio type. Allowed: ${ALLOWED_AUDIO_MIME_TYPES.join(', ')}` },
  ),
  sizeBytes: z.number().int().positive().max(
    MAX_UPLOAD_BYTES,
    { message: `File exceeds the ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB limit` },
  ).optional(),
  phone: z.string().min(6).max(20).optional(),
  callDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'callDate must be YYYY-MM-DD').optional(),
}).strict();

export const confirmUploadSchema = z.object({
  callDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'callDate must be YYYY-MM-DD').optional(),
}).strict();

export const linkEntitySchema = z.object({
  entityType: z.enum([
    ENTITY_TYPE.LEAD,
    ENTITY_TYPE.TENANT,
    ENTITY_TYPE.OWNER,
    ENTITY_TYPE.BUYER,
    ENTITY_TYPE.CONTACT,
  ]),
  entityId: z.string().min(1).max(200),
  reanalyze: z.boolean().optional(),
}).strict();

/**
 * Approved arguments are merged back into the recording item, so their size is
 * charged against DynamoDB's 400 KB per-item limit. An unbounded `z.record`
 * let a few hundred KB of JSON through, which would brick the row: every
 * subsequent write to that recording — including the one marking the action
 * failed — would be rejected, leaving it permanently unrecoverable through
 * the API. 32 KB is far above any legitimate edit (a corrected date, title or
 * note body) and far below the limit even with the rest of the item.
 */
const MAX_APPROVE_ARGUMENTS_BYTES = 32 * 1024;

export const approveActionSchema = z.object({
  // Allows the owner to correct a date/title before approving.
  arguments: z.record(z.string(), z.unknown())
    .refine(
      (value) => Buffer.byteLength(JSON.stringify(value), 'utf8') <= MAX_APPROVE_ARGUMENTS_BYTES,
      { message: `Edited arguments exceed the ${MAX_APPROVE_ARGUMENTS_BYTES / 1024} KB limit` },
    )
    .optional(),
}).strict();

export const rejectActionSchema = z.object({
  reason: z.string().max(500).optional(),
}).strict();

export const MAX_UPLOAD_BYTES_VALUE = MAX_UPLOAD_BYTES;
