/**
 * Call Intelligence pipeline orchestration.
 *
 * Stages run independently and are individually retryable:
 *   TRANSCRIPTION → start Amazon Transcribe, then poll until it finishes
 *   ANALYSIS      → Gemini analysis, deterministic action plan, auto-apply notes
 *
 * Every stage is guarded by a conditional status transition, so a duplicate SQS
 * delivery or a Lambda retry cannot process the same recording twice.
 */

import { logger } from '../../logger.js';
import { putObjectText } from '../../s3Service.js';
import {
  PIPELINE_STAGE,
  RECORDING_STATUS,
  STAGE_ENTRY_STATUSES,
  ENTITY_TYPE,
} from './constants.js';
import {
  getRecording,
  updateRecording,
  transitionStatus,
  markFailed,
  incrementStageAttempt,
  refreshCompletionStatus,
} from './callRecordingRepository.js';
import { getTranscriptionProvider } from './transcription/index.js';
import { analyzeTranscript, emptyAnalysis } from './analysisService.js';
import { planActions, buildFinancialHints } from './actionPlanner.js';
import { applyAutomaticActions } from './actionExecutor.js';
import { loadEntitySnapshot, summarizeEntityForPrompt } from './entityResolver.js';
import { enqueueJob, isQueueEnabled } from './queue.js';

const MAX_POLL_ATTEMPTS = parseInt(process.env.CALL_INTEL_MAX_POLL_ATTEMPTS || '60', 10);
const POLL_DELAY_SECONDS = parseInt(process.env.CALL_INTEL_POLL_DELAY_SECONDS || '45', 10);
const MAX_STAGE_ATTEMPTS = parseInt(process.env.CALL_INTEL_MAX_STAGE_ATTEMPTS || '4', 10);
const TRANSCRIPT_PREVIEW_CHARS = 1200;
const AUTO_APPLY_NOTES = process.env.CALL_INTEL_AUTO_APPLY_NOTES !== 'false';

function transcriptKey(tenantId, recordingId, extension) {
  return `${tenantId}/call-recordings/${recordingId}/transcript/transcript.${extension}`;
}

function analysisKey(tenantId, recordingId) {
  return `${tenantId}/call-recordings/${recordingId}/analysis/analysis.json`;
}

/**
 * Stage 1 — start or continue transcription.
 * Returns `{ done, requeueIn }`; the caller decides whether to re-enqueue.
 */
export async function runTranscriptionStage({ tenantId, recordingId }) {
  const recording = await getRecording(tenantId, recordingId);
  if (!recording) return { ok: false, error: 'recording_not_found' };

  // Already past this stage — nothing to do (duplicate delivery).
  if ([
    RECORDING_STATUS.TRANSCRIBED,
    RECORDING_STATUS.ANALYZING,
    RECORDING_STATUS.ANALYZED,
    RECORDING_STATUS.AWAITING_APPROVAL,
    RECORDING_STATUS.COMPLETED,
  ].includes(recording.status)) {
    return { ok: true, done: true, skipped: true };
  }

  const provider = getTranscriptionProvider();

  // ── Start a job when none is running ──────────────────────────────────────
  if (!recording.asrJobName) {
    const claimed = await transitionStatus(
      tenantId,
      recordingId,
      RECORDING_STATUS.TRANSCRIBING,
      STAGE_ENTRY_STATUSES[PIPELINE_STAGE.TRANSCRIPTION],
      { failureStage: null, failureReason: null },
    );
    if (!claimed) return { ok: true, done: false, skipped: true };

    const attempt = await incrementStageAttempt(tenantId, recordingId, PIPELINE_STAGE.TRANSCRIPTION);
    if (attempt > MAX_STAGE_ATTEMPTS) {
      await markFailed(tenantId, recordingId, PIPELINE_STAGE.TRANSCRIPTION, 'Maximum transcription attempts exceeded');
      return { ok: false, error: 'max_attempts_exceeded' };
    }

    try {
      const { jobId } = await provider.startTranscription({
        tenantId,
        recordingId,
        s3Key: recording.s3Key,
        filename: recording.filename,
        attempt,
      });
      await updateRecording(tenantId, recordingId, {
        asrJobName: jobId,
        asrProvider: provider.name,
        asrPollAttempts: 0,
      });
      return { ok: true, done: false, requeueIn: POLL_DELAY_SECONDS };
    } catch (err) {
      logger.error('callIntelligence.transcription.start_failed', {
        tenantId, recordingId, error: err.message,
      });
      await markFailed(tenantId, recordingId, PIPELINE_STAGE.TRANSCRIPTION, err.message);
      return { ok: false, error: err.message };
    }
  }

  // ── Poll an existing job ──────────────────────────────────────────────────
  const pollAttempts = (recording.asrPollAttempts || 0) + 1;
  if (pollAttempts > MAX_POLL_ATTEMPTS) {
    await markFailed(
      tenantId,
      recordingId,
      PIPELINE_STAGE.TRANSCRIPTION,
      `Transcription did not finish after ${MAX_POLL_ATTEMPTS} polls`,
    );
    return { ok: false, error: 'transcription_timeout' };
  }

  let poll;
  try {
    poll = await provider.pollTranscription({ jobId: recording.asrJobName, tenantId, recordingId });
  } catch (err) {
    logger.error('callIntelligence.transcription.poll_failed', { tenantId, recordingId, error: err.message });
    await updateRecording(tenantId, recordingId, { asrPollAttempts: pollAttempts });
    return { ok: true, done: false, requeueIn: POLL_DELAY_SECONDS };
  }

  if (poll.status === 'IN_PROGRESS') {
    await updateRecording(tenantId, recordingId, { asrPollAttempts: pollAttempts });
    return { ok: true, done: false, requeueIn: POLL_DELAY_SECONDS };
  }

  if (poll.status === 'FAILED') {
    await markFailed(tenantId, recordingId, PIPELINE_STAGE.TRANSCRIPTION, poll.error || 'Transcription failed');
    return { ok: false, error: poll.error };
  }

  // COMPLETED — persist the normalized transcript to S3 and advance.
  const result = poll.result;
  const jsonKey = transcriptKey(tenantId, recordingId, 'json');
  const textKey = transcriptKey(tenantId, recordingId, 'txt');

  try {
    await putObjectText(jsonKey, JSON.stringify({ recordingId, ...result }, null, 2), 'application/json');
    await putObjectText(textKey, result.transcript || '', 'text/plain; charset=utf-8');
  } catch (err) {
    logger.error('callIntelligence.transcription.persist_failed', { tenantId, recordingId, error: err.message });
    await markFailed(tenantId, recordingId, PIPELINE_STAGE.TRANSCRIPTION, `Failed to store transcript: ${err.message}`);
    return { ok: false, error: err.message };
  }

  await updateRecording(tenantId, recordingId, {
    status: RECORDING_STATUS.TRANSCRIBED,
    transcriptS3Key: jsonKey,
    transcriptTextS3Key: textKey,
    transcriptPreview: (result.transcript || '').slice(0, TRANSCRIPT_PREVIEW_CHARS),
    asrLanguage: result.language,
    asrConfidence: result.confidence,
    audioDurationSeconds: result.durationSeconds,
    asrPollAttempts: pollAttempts,
  });

  logger.info('callIntelligence.transcription.completed', {
    tenantId,
    recordingId,
    durationSeconds: result.durationSeconds,
    language: result.language,
    provider: result.provider,
  });

  return { ok: true, done: true, nextStage: PIPELINE_STAGE.ANALYSIS };
}

/** Stage 2 — analyse the transcript and build the proposed action list. */
export async function runAnalysisStage({ tenantId, recordingId, userId = null }) {
  const recording = await getRecording(tenantId, recordingId);
  if (!recording) return { ok: false, error: 'recording_not_found' };

  if ([
    RECORDING_STATUS.ANALYZED,
    RECORDING_STATUS.AWAITING_APPROVAL,
    RECORDING_STATUS.COMPLETED,
  ].includes(recording.status)) {
    return { ok: true, done: true, skipped: true };
  }

  const claimed = await transitionStatus(
    tenantId,
    recordingId,
    RECORDING_STATUS.ANALYZING,
    STAGE_ENTRY_STATUSES[PIPELINE_STAGE.ANALYSIS],
    { failureStage: null, failureReason: null },
  );
  if (!claimed) return { ok: true, done: false, skipped: true };

  const attempt = await incrementStageAttempt(tenantId, recordingId, PIPELINE_STAGE.ANALYSIS);
  if (attempt > MAX_STAGE_ATTEMPTS) {
    await markFailed(tenantId, recordingId, PIPELINE_STAGE.ANALYSIS, 'Maximum analysis attempts exceeded');
    return { ok: false, error: 'max_attempts_exceeded' };
  }

  // Read the full transcript from S3 (the item only holds a preview).
  let transcript = recording.transcriptPreview || '';
  if (recording.transcriptS3Key) {
    try {
      const { getObjectText } = await import('../../s3Service.js');
      const stored = JSON.parse(await getObjectText(recording.transcriptS3Key));
      transcript = stored.transcript || transcript;
    } catch (err) {
      logger.warn('callIntelligence.analysis.transcript_read_failed', {
        tenantId, recordingId, error: err.message,
      });
    }
  }

  const callDate = (recording.callDate || recording.createdAt || new Date().toISOString()).slice(0, 10);

  // Give the model the current CRM state so it can spot what changed.
  let entityContext = null;
  if (recording.matchedEntityType && recording.matchedEntityType !== ENTITY_TYPE.UNMATCHED) {
    const snapshot = await loadEntitySnapshot(tenantId, recording.matchedEntityType, recording.matchedEntityId);
    entityContext = summarizeEntityForPrompt(recording.matchedEntityType, snapshot);
  }

  let analysis;
  let model = null;
  let promptVersion = null;

  if (!String(transcript || '').trim()) {
    analysis = emptyAnalysis();
  } else {
    const analysed = await analyzeTranscript({
      tenantId,
      recordingId,
      transcript,
      entityContext,
      phone: recording.phone,
      callDate,
    });
    if (!analysed.ok) {
      await markFailed(tenantId, recordingId, PIPELINE_STAGE.ANALYSIS, analysed.error);
      return { ok: false, error: analysed.error };
    }
    analysis = analysed.analysis;
    model = analysed.model;
    promptVersion = analysed.promptVersion;
  }

  const actions = planActions({
    analysis,
    match: recording.matchedEntityType && recording.matchedEntityType !== ENTITY_TYPE.UNMATCHED
      ? {
        entityType: recording.matchedEntityType,
        entityId: recording.matchedEntityId,
        name: recording.matchedEntityName,
      }
      : null,
    callDate,
    recordingId,
    durationSeconds: recording.audioDurationSeconds,
    phone: recording.phone,
    autoApplyNotes: AUTO_APPLY_NOTES,
  });

  // Full analysis payload goes to S3; the item keeps the summary-sized view.
  let storedAnalysisKey = null;
  try {
    storedAnalysisKey = analysisKey(tenantId, recordingId);
    await putObjectText(
      storedAnalysisKey,
      JSON.stringify({ recordingId, model, promptVersion, analysis }, null, 2),
      'application/json',
    );
  } catch (err) {
    logger.warn('callIntelligence.analysis.persist_failed', { tenantId, recordingId, error: err.message });
    storedAnalysisKey = null;
  }

  await updateRecording(tenantId, recordingId, {
    status: RECORDING_STATUS.ANALYZED,
    analysisS3Key: storedAnalysisKey,
    summary: analysis.summary,
    keyPoints: analysis.keyPoints,
    topics: analysis.topics,
    extracted: {
      language: analysis.language,
      sentiment: analysis.sentiment,
      intentLevel: analysis.intentLevel,
      customer: analysis.customer,
      counterpartyRole: analysis.counterpartyRole,
      requirements: analysis.requirements,
      objections: analysis.objections,
      questions: analysis.questions,
      siteVisit: analysis.siteVisit,
      maintenance: analysis.maintenance,
      payment: analysis.payment,
      followUp: analysis.followUp,
      suggestedLeadStatus: analysis.suggestedLeadStatus,
      isNewLead: analysis.isNewLead,
      confidence: analysis.confidence,
    },
    financialHints: buildFinancialHints(analysis),
    proposedActions: actions,
    analysisModel: model,
    analysisPromptVersion: promptVersion,
  });

  const autoApplied = await applyAutomaticActions({ tenantId, recordingId, actions, userId });
  const finalRecording = await refreshCompletionStatus(tenantId, recordingId);

  logger.info('callIntelligence.analysis.completed', {
    tenantId,
    recordingId,
    actions: actions.length,
    autoApplied: autoApplied.length,
    status: finalRecording?.status,
  });

  return { ok: true, done: true, actions: actions.length, autoApplied: autoApplied.length };
}

/**
 * Run one job. Used by the SQS worker and by the inline fallback.
 * Re-queues itself while Amazon Transcribe is still running.
 */
export async function processJob({ tenantId, recordingId, stage, userId = null }) {
  if (stage === PIPELINE_STAGE.ANALYSIS) {
    return runAnalysisStage({ tenantId, recordingId, userId });
  }

  const transcription = await runTranscriptionStage({ tenantId, recordingId });
  if (!transcription.ok) return transcription;

  if (transcription.done && transcription.nextStage === PIPELINE_STAGE.ANALYSIS) {
    if (isQueueEnabled()) {
      await enqueueJob({ tenantId, recordingId, stage: PIPELINE_STAGE.ANALYSIS, userId }, 0);
      return { ok: true, done: false, handedOff: true };
    }
    return runAnalysisStage({ tenantId, recordingId, userId });
  }

  if (!transcription.done && transcription.requeueIn) {
    if (isQueueEnabled()) {
      await enqueueJob(
        { tenantId, recordingId, stage: PIPELINE_STAGE.TRANSCRIPTION, userId },
        transcription.requeueIn,
      );
      return { ok: true, done: false, requeued: true };
    }
    // No queue configured: leave the recording in TRANSCRIBING. The next
    // /status poll from the UI drives the pipeline forward.
    return { ok: true, done: false, requeued: false };
  }

  return transcription;
}

/**
 * Kick the pipeline for a recording.
 * Uses SQS when configured, otherwise runs inline (local development).
 */
export async function startProcessing({ tenantId, recordingId, userId = null }) {
  if (isQueueEnabled()) {
    const queued = await enqueueJob({
      tenantId, recordingId, stage: PIPELINE_STAGE.TRANSCRIPTION, userId,
    });
    if (queued.queued) return { ok: true, mode: 'queued' };
    // Queue configured but unreachable — fall through to inline so the upload
    // is not silently dropped.
    logger.warn('callIntelligence.startProcessing.queue_unavailable', { tenantId, recordingId });
  }

  const inlineRun = processJob({ tenantId, recordingId, stage: PIPELINE_STAGE.TRANSCRIPTION, userId })
    .catch((err) => logger.error('callIntelligence.inline.failed', {
      tenantId, recordingId, error: err.message,
    }));

  // In a Lambda execution environment the container can freeze as soon as the
  // HTTP response is sent, which would silently kill an unawaited promise.
  // Outside Lambda (local dev) this stays fire-and-forget for a snappy response.
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    await inlineRun;
  }

  return { ok: true, mode: 'inline' };
}
