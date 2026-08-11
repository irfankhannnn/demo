/**
 * SQS-triggered Lambda worker for the Call Intelligence pipeline.
 *
 * Handler: workers/callRecordingWorker.handler
 *
 * Uses partial batch responses (`ReportBatchItemFailures`) so one poisoned
 * message cannot force successfully processed messages to be redelivered.
 * Messages that keep failing land in the DLQ via the queue's redrive policy.
 */

import { logger } from '../logger.js';
import { PIPELINE_STAGE } from '../services/callIntelligence/constants.js';
import { processJob } from '../services/callIntelligence/pipeline.js';

/**
 * @param {{ Records: Array<{ messageId: string, body: string }> }} event
 * @returns {Promise<{ batchItemFailures: Array<{ itemIdentifier: string }> }>}
 */
export async function handler(event) {
  const records = event?.Records || [];
  const batchItemFailures = [];

  logger.info('callRecordingWorker.batch.received', { count: records.length });

  for (const record of records) {
    let payload;
    try {
      payload = JSON.parse(record.body);
    } catch (err) {
      // Unparseable message: dropping it is correct — retrying cannot help.
      logger.error('callRecordingWorker.message.unparseable', {
        messageId: record.messageId,
        error: err.message,
      });
      continue;
    }

    const { tenantId, recordingId, stage = PIPELINE_STAGE.TRANSCRIPTION, userId = null } = payload || {};

    if (!tenantId || !recordingId) {
      logger.error('callRecordingWorker.message.invalid', { messageId: record.messageId, payload });
      continue;
    }

    try {
      const result = await processJob({ tenantId, recordingId, stage, userId });
      logger.info('callRecordingWorker.message.processed', {
        messageId: record.messageId,
        tenantId,
        recordingId,
        stage,
        ok: result?.ok !== false,
        done: Boolean(result?.done),
        requeued: Boolean(result?.requeued),
      });

      // A stage that fails for a business reason (bad audio, LLM refusal) has
      // already been recorded as FAILED on the item and must not be retried by
      // SQS — the owner retries explicitly from the UI.
    } catch (err) {
      logger.error('callRecordingWorker.message.failed', {
        messageId: record.messageId,
        tenantId,
        recordingId,
        stage,
        error: err.message,
        stack: err.stack,
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}

export default { handler };
