/**
 * Amazon Transcribe implementation of the ASR provider contract.
 *
 * Batch transcription is asynchronous, so this provider is split into
 * start + poll. The worker re-queues a poll message with an SQS delay instead
 * of blocking a Lambda for the length of the call.
 */

import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} from '@aws-sdk/client-transcribe';
import path from 'path';
import { logger } from '../../../logger.js';
import { wrapAwsClient } from '../../../awsClientWrapper.js';
import { getBucketName, getObjectText } from '../../../s3Service.js';
import { MEDIA_FORMAT_BY_EXTENSION } from '../constants.js';
import { TranscriptionProvider, buildTranscriptResult } from './TranscriptionProvider.js';

const REGION = process.env.AWS_REGION || 'ap-south-1';

let cachedClient = null;
function getClient() {
  if (!cachedClient) {
    cachedClient = wrapAwsClient(new TranscribeClient({ region: REGION }), 'Transcribe');
  }
  return cachedClient;
}

/**
 * Languages offered to automatic identification. Indian real-estate calls are
 * routinely Hinglish, so English plus the major regional languages are listed.
 */
function languageOptions() {
  const raw = process.env.TRANSCRIBE_LANGUAGE_OPTIONS
    || 'en-IN,hi-IN,mr-IN,gu-IN,ta-IN,te-IN,kn-IN,ml-IN,pa-IN,bn-IN';
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
}

function mediaFormatFor(filename, s3Key) {
  const extension = path.extname(filename || s3Key || '').toLowerCase();
  return MEDIA_FORMAT_BY_EXTENSION[extension] || 'mp3';
}

/**
 * Where Amazon Transcribe writes its own raw output. Deterministic from
 * (tenantId, recordingId) and NOT stored on the recording item — so deletion
 * has to reconstruct it. Exported for exactly that reason: without it, a
 * deleted recording left the full diarized transcript sitting in S3 forever.
 */
export function rawTranscriptKeyFor(tenantId, recordingId) {
  return `${tenantId}/call-recordings/${recordingId}/transcript/amazon-transcribe-raw.json`;
}

function outputKeyFor(tenantId, recordingId) {
  return rawTranscriptKeyFor(tenantId, recordingId);
}

/**
 * Amazon Transcribe job names allow [0-9a-zA-Z._-] only and must be unique per
 * account. Recording ids are UUIDs, which already satisfy that.
 */
function jobNameFor(tenantId, recordingId, attempt) {
  const safeTenant = String(tenantId).replace(/[^0-9a-zA-Z._-]/g, '-').slice(0, 40);
  return `rfci-${safeTenant}-${recordingId}-${attempt}`.slice(0, 200);
}

export class AmazonTranscribeProvider extends TranscriptionProvider {
  get name() {
    return 'amazon-transcribe';
  }

  async startTranscription({ tenantId, recordingId, s3Key, filename, attempt = 1 }) {
    const bucket = getBucketName();
    const jobName = jobNameFor(tenantId, recordingId, attempt);
    const outputKey = outputKeyFor(tenantId, recordingId);

    const base = {
      TranscriptionJobName: jobName,
      Media: { MediaFileUri: `s3://${bucket}/${s3Key}` },
      MediaFormat: mediaFormatFor(filename, s3Key),
      OutputBucketName: bucket,
      OutputKey: outputKey,
    };

    const fixedLanguage = process.env.TRANSCRIBE_LANGUAGE_CODE;
    const vocabularyName = process.env.TRANSCRIBE_VOCABULARY_NAME;

    // A fixed language code is the only combination that reliably supports a
    // custom vocabulary, so it wins when explicitly configured.
    const params = fixedLanguage
      ? {
        ...base,
        LanguageCode: fixedLanguage,
        Settings: {
          ShowSpeakerLabels: true,
          MaxSpeakerLabels: 2,
          ...(vocabularyName ? { VocabularyName: vocabularyName } : {}),
        },
      }
      : {
        ...base,
        IdentifyMultipleLanguages: true,
        LanguageOptions: languageOptions(),
        Settings: { ShowSpeakerLabels: true, MaxSpeakerLabels: 2 },
      };

    try {
      await getClient().send(new StartTranscriptionJobCommand(params));
    } catch (err) {
      // Some parameter combinations (language identification + settings) are
      // rejected depending on region/account. Retry once without Settings so a
      // recording is transcribed without diarization rather than failing.
      if (err?.name === 'BadRequestException' && params.Settings) {
        logger.warn('callIntelligence.transcribe.retryWithoutSettings', {
          tenantId, recordingId, error: err.message,
        });
        const { Settings, ...withoutSettings } = params;
        await getClient().send(new StartTranscriptionJobCommand(withoutSettings));
      } else if (err?.name === 'ConflictException') {
        // Job name already exists — a previous delivery already started it.
        logger.info('callIntelligence.transcribe.jobExists', { tenantId, recordingId, jobName });
      } else {
        throw err;
      }
    }

    return { jobId: jobName, outputKey };
  }

  async pollTranscription({ jobId, tenantId, recordingId }) {
    const response = await getClient().send(new GetTranscriptionJobCommand({
      TranscriptionJobName: jobId,
    }));
    const job = response?.TranscriptionJob;
    const status = job?.TranscriptionJobStatus;

    if (status === 'IN_PROGRESS' || status === 'QUEUED') {
      return { status: 'IN_PROGRESS' };
    }

    if (status === 'FAILED') {
      return { status: 'FAILED', error: job?.FailureReason || 'Transcription job failed' };
    }

    if (status !== 'COMPLETED') {
      return { status: 'FAILED', error: `Unexpected transcription job status: ${status}` };
    }

    const outputKey = outputKeyFor(tenantId, recordingId);
    let raw;
    try {
      raw = JSON.parse(await getObjectText(outputKey));
    } catch (err) {
      return { status: 'FAILED', error: `Unable to read transcript output: ${err.message}` };
    }

    return {
      status: 'COMPLETED',
      result: normalizeAmazonTranscript(raw, {
        provider: this.name,
        language: job?.LanguageCode || (job?.LanguageCodes?.[0]?.LanguageCode) || 'unknown',
      }),
    };
  }
}

/**
 * Convert the Amazon Transcribe output document into the shared shape.
 * Exported for unit testing against recorded fixtures.
 */
export function normalizeAmazonTranscript(raw, { provider = 'amazon-transcribe', language = 'unknown' } = {}) {
  const results = raw?.results || {};
  const transcript = results.transcripts?.map((entry) => entry.transcript).join(' ').trim() || '';
  const items = Array.isArray(results.items) ? results.items : [];

  const confidences = items
    .map((item) => Number(item?.alternatives?.[0]?.confidence))
    .filter((value) => Number.isFinite(value));
  const confidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : null;

  const segments = [];
  const speakerSegments = results.speaker_labels?.segments
    || results.speaker_labels?.[0]?.segments
    || [];

  if (Array.isArray(speakerSegments) && speakerSegments.length > 0) {
    for (const segment of speakerSegments) {
      const start = Number(segment.start_time);
      const end = Number(segment.end_time);
      const text = items
        .filter((item) => {
          if (item.type !== 'pronunciation') return false;
          const itemStart = Number(item.start_time);
          return Number.isFinite(itemStart) && itemStart >= start && itemStart < end + 0.001;
        })
        .map((item) => item.alternatives?.[0]?.content || '')
        .join(' ')
        .replace(/\s+([.,?!])/g, '$1')
        .trim();

      if (text) {
        segments.push({
          speaker: segment.speaker_label || 'SPEAKER_0',
          start: Number.isFinite(start) ? start : 0,
          end: Number.isFinite(end) ? end : 0,
          text,
        });
      }
    }
  }

  const lastItemEnd = items.length
    ? Number(items[items.length - 1]?.end_time) || 0
    : 0;
  const durationSeconds = segments.length
    ? segments[segments.length - 1].end
    : lastItemEnd;

  return buildTranscriptResult({
    provider,
    language,
    durationSeconds,
    transcript,
    segments,
    confidence,
  });
}
