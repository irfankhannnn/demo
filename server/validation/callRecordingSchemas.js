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

export const approveActionSchema = z.object({
  // Allows the owner to correct a date/title before approving.
  arguments: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const rejectActionSchema = z.object({
  reason: z.string().max(500).optional(),
}).strict();

export const MAX_UPLOAD_BYTES_VALUE = MAX_UPLOAD_BYTES;
