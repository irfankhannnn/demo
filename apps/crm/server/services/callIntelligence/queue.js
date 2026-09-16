/**
 * SQS buffer between the upload API and the processing worker.
 *
 * When `CALL_RECORDING_QUEUE_URL` is not configured (local development, or a
 * deployment that has not created the queue yet) the pipeline falls back to
 * running inline so the feature still works end to end.
 */

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { logger } from '../../logger.js';
import { wrapAwsClient } from '../../awsClientWrapper.js';

const REGION = process.env.AWS_REGION || 'ap-south-1';

let cachedClient = null;
function getClient() {
  if (!cachedClient) {
    cachedClient = wrapAwsClient(new SQSClient({ region: REGION }), 'SQS');
  }
  return cachedClient;
}

export function getQueueUrl() {
  return process.env.CALL_RECORDING_QUEUE_URL || '';
}

export function isQueueEnabled() {
  return Boolean(getQueueUrl());
}

/**
 * Enqueue a pipeline job.
 *
 * @param {{ tenantId: string, recordingId: string, stage: string, userId?: string|null }} payload
 * @param {number} delaySeconds 0-900
 * @returns {Promise<{ ok: boolean, queued: boolean, error?: string }>}
 */
export async function enqueueJob(payload, delaySeconds = 0) {
  const queueUrl = getQueueUrl();
  if (!queueUrl) return { ok: true, queued: false };

  try {
    await getClient().send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(payload),
      DelaySeconds: Math.min(Math.max(Math.round(delaySeconds), 0), 900),
    }));
    logger.info('callIntelligence.queue.enqueued', {
      tenantId: payload.tenantId,
      recordingId: payload.recordingId,
      stage: payload.stage,
      delaySeconds,
    });
    return { ok: true, queued: true };
  } catch (err) {
    logger.error('callIntelligence.queue.enqueue_failed', {
      tenantId: payload.tenantId,
      recordingId: payload.recordingId,
      stage: payload.stage,
      error: err.message,
    });
    return { ok: false, queued: false, error: err.message };
  }
}
