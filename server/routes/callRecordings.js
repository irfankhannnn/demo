/**
 * Call Intelligence API — upload call recordings, review the AI analysis and
 * approve the CRM actions it proposes.
 *
 * Mounted at /api/crm/call-recordings. Every route is tenant-scoped and
 * restricted to agency owners/admins because recordings contain customer PII
 * and the approved actions write to the CRM.
 */

import express from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger.js';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireAdmin } from '../middleware/requireRole.js';
import validateBody from '../middleware/validateBody.js';
import {
  getPresignedUploadUrl,
  getPresignedUrl,
  headObject,
  getObjectText,
  deleteFromS3,
} from '../s3Service.js';
import {
  createUploadUrlSchema,
  confirmUploadSchema,
  linkEntitySchema,
  approveActionSchema,
  rejectActionSchema,
} from '../validation/callRecordingSchemas.js';
import {
  ACTION_STATUS,
  ENTITY_TYPE,
  PIPELINE_STAGE,
  RECORDING_STATUS,
} from '../services/callIntelligence/constants.js';
import {
  createRecording,
  getRecording,
  listRecordings,
  updateRecording,
  transitionStatus,
  findPossibleDuplicate,
  updateActionStatus,
  refreshCompletionStatus,
  deleteRecording,
} from '../services/callIntelligence/callRecordingRepository.js';
import { extractPhoneFromFilename, normalizePhoneForMatch, toE164 } from '../services/callIntelligence/phoneExtractor.js';
import { resolveEntityByPhone, loadEntitySnapshot } from '../services/callIntelligence/entityResolver.js';
import { startProcessing, processJob, runAnalysisStage } from '../services/callIntelligence/pipeline.js';
import { isQueueEnabled } from '../services/callIntelligence/queue.js';
import { executeAction } from '../services/callIntelligence/actionExecutor.js';

const router = express.Router();

router.use(validateToken);
router.use(extractTenantId);
router.use(requireAdmin);

const UPLOAD_URL_TTL_SECONDS = parseInt(process.env.CALL_INTEL_UPLOAD_URL_TTL_SECONDS || '900', 10);
const PLAYBACK_URL_TTL_SECONDS = parseInt(process.env.CALL_INTEL_PLAYBACK_URL_TTL_SECONDS || '3600', 10);

function actingUserId(req) {
  return req.user?.userId || req.user?.id || req.user?.sub || null;
}

/** Only pass through fields the UI needs for the list view. */
function toListItem(item) {
  return {
    recordingId: item.recordingId,
    filename: item.filename,
    status: item.status,
    phone: item.phone,
    phoneConfidence: item.phoneConfidence,
    matchedEntityType: item.matchedEntityType,
    matchedEntityId: item.matchedEntityId,
    matchedEntityName: item.matchedEntityName,
    summary: item.summary || '',
    topics: item.topics || [],
    audioDurationSeconds: item.audioDurationSeconds,
    asrLanguage: item.asrLanguage,
    pendingActions: (item.proposedActions || []).filter((a) => a.status === ACTION_STATUS.PENDING).length,
    appliedActions: (item.proposedActions || []).filter((a) => a.status === ACTION_STATUS.APPLIED).length,
    failureStage: item.failureStage || null,
    failureReason: item.failureReason || null,
    possibleDuplicateOf: item.possibleDuplicateOf || null,
    callDate: item.callDate || (item.createdAt || '').slice(0, 10),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function toDetail(item) {
  return {
    ...toListItem(item),
    keyPoints: item.keyPoints || [],
    extracted: item.extracted || null,
    financialHints: item.financialHints || [],
    transcriptPreview: item.transcriptPreview || '',
    hasTranscript: Boolean(item.transcriptS3Key),
    matchCandidates: item.matchCandidates || [],
    matchSource: item.matchSource || 'filename',
    proposedActions: (item.proposedActions || []).map((action) => ({
      actionId: action.actionId,
      tool: action.tool,
      title: action.title,
      description: action.description,
      reason: action.reason,
      arguments: action.arguments,
      requiresApproval: action.requiresApproval,
      status: action.status,
      reviewedBy: action.reviewedBy,
      reviewedAt: action.reviewedAt,
      executedAt: action.executedAt,
      executionError: action.executionError,
      rejectionReason: action.rejectionReason || null,
    })),
    asrProvider: item.asrProvider,
    analysisModel: item.analysisModel,
    analysisPromptVersion: item.analysisPromptVersion,
    sizeBytes: item.sizeBytes,
    uploadedBy: item.uploadedBy,
  };
}

/**
 * In local/dev deployments without SQS the pipeline has no scheduler, so a
 * detail/list read nudges in-flight recordings forward. Fire-and-forget.
 */
function nudgeInlinePipeline(tenantId, recording, userId) {
  if (isQueueEnabled()) return;
  const inFlight = [
    RECORDING_STATUS.UPLOADED,
    RECORDING_STATUS.QUEUED,
    RECORDING_STATUS.TRANSCRIBING,
    RECORDING_STATUS.TRANSCRIBED,
  ];
  if (!inFlight.includes(recording.status)) return;

  const stage = recording.status === RECORDING_STATUS.TRANSCRIBED
    ? PIPELINE_STAGE.ANALYSIS
    : PIPELINE_STAGE.TRANSCRIPTION;

  processJob({ tenantId, recordingId: recording.recordingId, stage, userId })
    .catch((err) => logger.warn('callIntelligence.nudge.failed', {
      tenantId, recordingId: recording.recordingId, error: err.message,
    }));
}

// ── Upload ───────────────────────────────────────────────────────────────────

/**
 * POST /api/crm/call-recordings/upload-url
 * Creates the recording row and returns a pre-signed S3 PUT URL.
 */
router.post('/upload-url', validateBody(createUploadUrlSchema), async (req, res) => {
  const tenantId = req.tenantId;
  const { filename, contentType, sizeBytes, phone: phoneOverride, callDate } = req.body;

  try {
    const extracted = phoneOverride
      ? {
        phone: normalizePhoneForMatch(phoneOverride),
        e164: toE164(normalizePhoneForMatch(phoneOverride)),
        confidence: 'high',
        candidates: [normalizePhoneForMatch(phoneOverride)],
      }
      : extractPhoneFromFilename(filename);

    let match = null;
    let candidates = [];
    if (extracted.phone) {
      const resolution = await resolveEntityByPhone(tenantId, extracted.phone);
      match = resolution.matched;
      candidates = resolution.candidates;
    }

    const possibleDuplicateOf = await findPossibleDuplicate(tenantId, { filename, sizeBytes });

    // Pre-generate the id so the S3 key and the DynamoDB row agree.
    const recordingId = uuidv4();
    const extension = (path.extname(filename) || '').toLowerCase() || '.mp3';
    const s3Key = `${tenantId}/call-recordings/${recordingId}/original${extension}`;

    const recording = await createRecording(tenantId, {
      recordingId,
      filename,
      contentType,
      sizeBytes: sizeBytes ?? null,
      s3Key,
      phone: extracted.phone,
      phoneE164: extracted.e164,
      phoneConfidence: extracted.confidence,
      phoneCandidates: extracted.candidates,
      matchedEntityType: match?.entityType || ENTITY_TYPE.UNMATCHED,
      matchedEntityId: match?.entityId || null,
      matchedEntityName: match?.name || '',
      matchCandidates: candidates,
      matchSource: phoneOverride ? 'manual-phone' : 'filename',
      possibleDuplicateOf,
      uploadedBy: actingUserId(req) || req.user?.email || '',
    });

    if (callDate) {
      await updateRecording(tenantId, recordingId, { callDate });
    }

    const uploadUrl = await getPresignedUploadUrl(s3Key, contentType, UPLOAD_URL_TTL_SECONDS);

    logger.info('callIntelligence.upload.url_issued', {
      tenantId, recordingId, phoneFound: Boolean(extracted.phone), matched: Boolean(match),
    });

    return res.status(201).json({
      recordingId,
      uploadUrl,
      s3Key,
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      phone: extracted.phone,
      phoneConfidence: extracted.confidence,
      match: match || null,
      matchCandidates: candidates,
      possibleDuplicateOf,
      recording: toListItem({ ...recording, callDate: callDate || recording.createdAt.slice(0, 10) }),
    });
  } catch (error) {
    logger.error('callIntelligence.upload.url_failed', { tenantId, error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Failed to create upload URL', details: error.message });
  }
});

/**
 * POST /api/crm/call-recordings/:recordingId/confirm
 * Verifies the object landed in S3 and starts the pipeline.
 */
router.post('/:recordingId/confirm', validateBody(confirmUploadSchema), async (req, res) => {
  const tenantId = req.tenantId;
  const { recordingId } = req.params;

  try {
    const recording = await getRecording(tenantId, recordingId);
    if (!recording) return res.status(404).json({ error: 'Recording not found' });

    if (recording.status !== RECORDING_STATUS.PENDING_UPLOAD) {
      // Idempotent: a repeated confirm returns the current state.
      return res.json({ recording: toDetail(recording), alreadyConfirmed: true });
    }

    const head = await headObject(recording.s3Key);
    if (!head) {
      return res.status(409).json({
        error: 'Upload not found in storage',
        details: 'The file was not uploaded, or the pre-signed URL expired. Please retry the upload.',
      });
    }

    const updates = {
      sizeBytes: head.contentLength ?? recording.sizeBytes,
      status: RECORDING_STATUS.UPLOADED,
    };
    if (req.body?.callDate) updates.callDate = req.body.callDate;
    if (!recording.callDate && !req.body?.callDate) {
      updates.callDate = new Date().toISOString().slice(0, 10);
    }

    await updateRecording(tenantId, recordingId, updates);
    await transitionStatus(tenantId, recordingId, RECORDING_STATUS.QUEUED, [RECORDING_STATUS.UPLOADED]);

    const started = await startProcessing({ tenantId, recordingId, userId: actingUserId(req) });
    const updated = await getRecording(tenantId, recordingId);

    logger.info('callIntelligence.upload.confirmed', {
      tenantId, recordingId, mode: started.mode, sizeBytes: updates.sizeBytes,
    });

    return res.json({ recording: toDetail(updated), processing: started.mode });
  } catch (error) {
    logger.error('callIntelligence.confirm.failed', { tenantId, recordingId, error: error.message });
    return res.status(500).json({ error: 'Failed to confirm upload', details: error.message });
  }
});

// ── Read ─────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { items, nextCursor } = await listRecordings(tenantId, {
      limit: req.query.limit,
      cursor: req.query.cursor,
      status: req.query.status,
    });

    items.forEach((item) => nudgeInlinePipeline(tenantId, item, actingUserId(req)));

    return res.json({ recordings: items.map(toListItem), nextCursor });
  } catch (error) {
    logger.error('callIntelligence.list.failed', { tenantId, error: error.message });
    return res.status(500).json({ error: 'Failed to list call recordings', details: error.message });
  }
});

router.get('/:recordingId', async (req, res) => {
  const tenantId = req.tenantId;
  const { recordingId } = req.params;
  try {
    const recording = await getRecording(tenantId, recordingId);
    if (!recording) return res.status(404).json({ error: 'Recording not found' });

    nudgeInlinePipeline(tenantId, recording, actingUserId(req));
    return res.json({ recording: toDetail(recording) });
  } catch (error) {
    logger.error('callIntelligence.get.failed', { tenantId, recordingId, error: error.message });
    return res.status(500).json({ error: 'Failed to load call recording', details: error.message });
  }
});

/** Full transcript (segments + plain text) read from S3. */
router.get('/:recordingId/transcript', async (req, res) => {
  const tenantId = req.tenantId;
  const { recordingId } = req.params;
  try {
    const recording = await getRecording(tenantId, recordingId);
    if (!recording) return res.status(404).json({ error: 'Recording not found' });
    if (!recording.transcriptS3Key) {
      return res.status(409).json({ error: 'Transcript is not ready yet', status: recording.status });
    }

    const raw = await getObjectText(recording.transcriptS3Key);
    return res.json({ transcript: JSON.parse(raw) });
  } catch (error) {
    logger.error('callIntelligence.transcript.failed', { tenantId, recordingId, error: error.message });
    return res.status(500).json({ error: 'Failed to load transcript', details: error.message });
  }
});

/** Short-lived playback URL for the original audio. */
router.get('/:recordingId/audio-url', async (req, res) => {
  const tenantId = req.tenantId;
  const { recordingId } = req.params;
  try {
    const recording = await getRecording(tenantId, recordingId);
    if (!recording) return res.status(404).json({ error: 'Recording not found' });

    const url = await getPresignedUrl(recording.s3Key, PLAYBACK_URL_TTL_SECONDS);
    return res.json({ url, expiresIn: PLAYBACK_URL_TTL_SECONDS });
  } catch (error) {
    logger.error('callIntelligence.audioUrl.failed', { tenantId, recordingId, error: error.message });
    return res.status(500).json({ error: 'Failed to create playback URL', details: error.message });
  }
});

// ── Corrections & reprocessing ───────────────────────────────────────────────

/** Manually attach a recording to a CRM record when the phone match missed. */
router.post('/:recordingId/link', validateBody(linkEntitySchema), async (req, res) => {
  const tenantId = req.tenantId;
  const { recordingId } = req.params;
  const { entityType, entityId, reanalyze = true } = req.body;

  try {
    const recording = await getRecording(tenantId, recordingId);
    if (!recording) return res.status(404).json({ error: 'Recording not found' });

    const snapshot = await loadEntitySnapshot(tenantId, entityType, entityId);
    if (!snapshot) {
      return res.status(404).json({ error: `No ${entityType} found with id ${entityId}` });
    }

    await updateRecording(tenantId, recordingId, {
      matchedEntityType: entityType,
      matchedEntityId: entityId,
      matchedEntityName: snapshot.name || snapshot.fullName || '',
      matchSource: 'manual',
    });

    if (reanalyze && recording.transcriptS3Key) {
      // Re-plan actions against the newly linked record.
      await updateRecording(tenantId, recordingId, {
        status: RECORDING_STATUS.TRANSCRIBED,
        proposedActions: [],
      });
      const result = await runAnalysisStage({ tenantId, recordingId, userId: actingUserId(req) });
      if (!result.ok) {
        logger.warn('callIntelligence.link.reanalyze_failed', { tenantId, recordingId, error: result.error });
      }
    }

    const updated = await getRecording(tenantId, recordingId);
    return res.json({ recording: toDetail(updated) });
  } catch (error) {
    logger.error('callIntelligence.link.failed', { tenantId, recordingId, error: error.message });
    return res.status(500).json({ error: 'Failed to link recording', details: error.message });
  }
});

/** Re-run analysis (or the whole pipeline after a transcription failure). */
router.post('/:recordingId/reanalyze', async (req, res) => {
  const tenantId = req.tenantId;
  const { recordingId } = req.params;

  try {
    const recording = await getRecording(tenantId, recordingId);
    if (!recording) return res.status(404).json({ error: 'Recording not found' });

    const appliedActions = (recording.proposedActions || []).filter((a) => a.status === ACTION_STATUS.APPLIED);

    if (recording.transcriptS3Key) {
      await updateRecording(tenantId, recordingId, {
        status: RECORDING_STATUS.TRANSCRIBED,
        // Keep already-applied actions so history is not lost, drop the rest.
        proposedActions: appliedActions,
        stageAttempts: { ...(recording.stageAttempts || {}), [PIPELINE_STAGE.ANALYSIS]: 0 },
      });
      const result = await runAnalysisStage({ tenantId, recordingId, userId: actingUserId(req) });
      if (!result.ok) {
        return res.status(502).json({ error: 'Re-analysis failed', details: result.error });
      }
    } else {
      await updateRecording(tenantId, recordingId, {
        status: RECORDING_STATUS.UPLOADED,
        asrJobName: null,
        asrPollAttempts: 0,
        failureStage: null,
        failureReason: null,
        stageAttempts: {},
      });
      await startProcessing({ tenantId, recordingId, userId: actingUserId(req) });
    }

    const updated = await getRecording(tenantId, recordingId);
    return res.json({ recording: toDetail(updated) });
  } catch (error) {
    logger.error('callIntelligence.reanalyze.failed', { tenantId, recordingId, error: error.message });
    return res.status(500).json({ error: 'Failed to re-analyze recording', details: error.message });
  }
});

// ── Approvals ────────────────────────────────────────────────────────────────

router.post('/:recordingId/actions/:actionId/approve', validateBody(approveActionSchema), async (req, res) => {
  const tenantId = req.tenantId;
  const { recordingId, actionId } = req.params;
  const userId = actingUserId(req);

  try {
    const recording = await getRecording(tenantId, recordingId);
    if (!recording) return res.status(404).json({ error: 'Recording not found' });

    const action = (recording.proposedActions || []).find((entry) => entry.actionId === actionId);
    if (!action) return res.status(404).json({ error: 'Action not found' });

    if (action.status === ACTION_STATUS.APPLIED) {
      return res.status(409).json({ error: 'Action has already been applied' });
    }
    if (action.status === ACTION_STATUS.REJECTED) {
      return res.status(409).json({ error: 'Action was rejected and cannot be approved' });
    }

    // Owner edits are merged, but the entity the action points at is fixed to
    // avoid re-targeting an approved write at a different record.
    const editedArguments = req.body?.arguments
      ? { ...action.arguments, ...req.body.arguments, ...pickIdentityArgs(action.arguments) }
      : action.arguments;

    const claimed = await updateActionStatus(
      tenantId,
      recordingId,
      actionId,
      {
        status: ACTION_STATUS.APPROVED,
        arguments: editedArguments,
        reviewedBy: userId || req.user?.email || 'unknown',
        reviewedAt: new Date().toISOString(),
      },
      [ACTION_STATUS.PENDING, ACTION_STATUS.FAILED],
    );

    if (!claimed.ok) {
      return res.status(409).json({ error: 'Action is no longer pending', details: claimed.error });
    }

    const outcome = await executeAction({
      tenantId,
      recordingId,
      action: { ...action, arguments: editedArguments },
      userId,
      automatic: false,
    });

    await refreshCompletionStatus(tenantId, recordingId);
    const updated = await getRecording(tenantId, recordingId);

    if (!outcome.ok) {
      return res.status(502).json({
        error: 'Action could not be applied',
        details: outcome.error,
        recording: toDetail(updated),
      });
    }

    return res.json({ ok: true, recording: toDetail(updated) });
  } catch (error) {
    logger.error('callIntelligence.approve.failed', { tenantId, recordingId, actionId, error: error.message });
    return res.status(500).json({ error: 'Failed to approve action', details: error.message });
  }
});

router.post('/:recordingId/actions/:actionId/reject', validateBody(rejectActionSchema), async (req, res) => {
  const tenantId = req.tenantId;
  const { recordingId, actionId } = req.params;

  try {
    const result = await updateActionStatus(
      tenantId,
      recordingId,
      actionId,
      {
        status: ACTION_STATUS.REJECTED,
        reviewedBy: actingUserId(req) || req.user?.email || 'unknown',
        reviewedAt: new Date().toISOString(),
        rejectionReason: req.body?.reason || null,
      },
      [ACTION_STATUS.PENDING, ACTION_STATUS.FAILED],
    );

    if (!result.ok) {
      const statusCode = result.error === 'recording_not_found' || result.error === 'action_not_found' ? 404 : 409;
      return res.status(statusCode).json({ error: 'Unable to reject action', details: result.error });
    }

    await refreshCompletionStatus(tenantId, recordingId);
    const updated = await getRecording(tenantId, recordingId);
    return res.json({ ok: true, recording: toDetail(updated) });
  } catch (error) {
    logger.error('callIntelligence.reject.failed', { tenantId, recordingId, actionId, error: error.message });
    return res.status(500).json({ error: 'Failed to reject action', details: error.message });
  }
});

// ── Retention ────────────────────────────────────────────────────────────────

/** Delete a recording and its derived artefacts (audio, transcript, analysis). */
router.delete('/:recordingId', async (req, res) => {
  const tenantId = req.tenantId;
  const { recordingId } = req.params;

  try {
    const recording = await getRecording(tenantId, recordingId);
    if (!recording) return res.status(404).json({ error: 'Recording not found' });

    const keys = [
      recording.s3Key,
      recording.transcriptS3Key,
      recording.transcriptTextS3Key,
      recording.analysisS3Key,
    ].filter(Boolean);

    for (const key of keys) {
      try {
        await deleteFromS3(key);
      } catch (err) {
        logger.warn('callIntelligence.delete.s3_failed', { tenantId, recordingId, key, error: err.message });
      }
    }

    await deleteRecording(tenantId, recordingId);

    logger.info('callIntelligence.deleted', { tenantId, recordingId, objects: keys.length });
    return res.json({ ok: true });
  } catch (error) {
    logger.error('callIntelligence.delete.failed', { tenantId, recordingId, error: error.message });
    return res.status(500).json({ error: 'Failed to delete recording', details: error.message });
  }
});

/** Identity arguments an owner may not change when approving an action. */
function pickIdentityArgs(args = {}) {
  const protectedKeys = [
    'leadId', 'tenantRecordId', 'ownerId', 'buyerId', 'contactId',
    'relatedEntityId', 'relatedEntityType',
  ];
  const result = {};
  for (const key of protectedKeys) {
    if (args[key] !== undefined) result[key] = args[key];
  }
  return result;
}

export default router;
