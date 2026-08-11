/**
 * Worker tests: what matters is which SQS messages come back as batch item
 * failures, because that decides what gets redelivered and what reaches the DLQ.
 */

import { jest } from '@jest/globals';

const processJob = jest.fn();

jest.unstable_mockModule('../services/callIntelligence/pipeline.js', () => ({ processJob }));

const { handler } = await import('./callRecordingWorker.js');

function record(messageId, payload) {
  return { messageId, body: typeof payload === 'string' ? payload : JSON.stringify(payload) };
}

beforeEach(() => {
  jest.clearAllMocks();
  processJob.mockResolvedValue({ ok: true, done: true });
});

describe('callRecordingWorker.handler', () => {
  it('processes every message in the batch', async () => {
    const result = await handler({
      Records: [
        record('m1', { tenantId: 't1', recordingId: 'r1', stage: 'TRANSCRIPTION' }),
        record('m2', { tenantId: 't1', recordingId: 'r2', stage: 'ANALYSIS' }),
      ],
    });

    expect(processJob).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ batchItemFailures: [] });
  });

  it('defaults the stage to transcription', async () => {
    await handler({ Records: [record('m1', { tenantId: 't1', recordingId: 'r1' })] });
    expect(processJob).toHaveBeenCalledWith(expect.objectContaining({ stage: 'TRANSCRIPTION' }));
  });

  it('drops an unparseable message instead of retrying it forever', async () => {
    const result = await handler({ Records: [record('m1', 'not json')] });

    expect(processJob).not.toHaveBeenCalled();
    expect(result).toEqual({ batchItemFailures: [] });
  });

  it('drops a message that is missing the tenant or recording id', async () => {
    const result = await handler({ Records: [record('m1', { recordingId: 'r1' })] });

    expect(processJob).not.toHaveBeenCalled();
    expect(result).toEqual({ batchItemFailures: [] });
  });

  it('reports only the failing message so the rest are not redelivered', async () => {
    processJob
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('DynamoDB unavailable'))
      .mockResolvedValueOnce({ ok: true });

    const result = await handler({
      Records: [
        record('m1', { tenantId: 't1', recordingId: 'r1' }),
        record('m2', { tenantId: 't1', recordingId: 'r2' }),
        record('m3', { tenantId: 't1', recordingId: 'r3' }),
      ],
    });

    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'm2' }] });
  });

  it('does not retry a stage that failed for a business reason', async () => {
    processJob.mockResolvedValue({ ok: false, error: 'analysis_parse_failed' });

    const result = await handler({ Records: [record('m1', { tenantId: 't1', recordingId: 'r1' })] });

    expect(result).toEqual({ batchItemFailures: [] });
  });

  it('tolerates an empty event', async () => {
    await expect(handler({})).resolves.toEqual({ batchItemFailures: [] });
  });
});
