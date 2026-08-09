/**
 * Pipeline orchestration tests.
 *
 * DynamoDB, S3, the ASR provider and Gemini are all mocked; what is under test
 * is the stage sequencing, the idempotency guards and the retry accounting.
 */

import { jest } from '@jest/globals';

const repo = {
  getRecording: jest.fn(),
  updateRecording: jest.fn(),
  transitionStatus: jest.fn(),
  markFailed: jest.fn(),
  incrementStageAttempt: jest.fn(),
  refreshCompletionStatus: jest.fn(),
};

const provider = {
  name: 'amazon-transcribe',
  startTranscription: jest.fn(),
  pollTranscription: jest.fn(),
};

const s3 = {
  putObjectText: jest.fn(),
  getObjectText: jest.fn(),
};

const analysis = { analyzeTranscript: jest.fn() };
const executor = { applyAutomaticActions: jest.fn() };
const queue = { enqueueJob: jest.fn(), isQueueEnabled: jest.fn() };

jest.unstable_mockModule('./callRecordingRepository.js', () => repo);
jest.unstable_mockModule('./transcription/index.js', () => ({
  getTranscriptionProvider: () => provider,
}));
jest.unstable_mockModule('../../s3Service.js', () => s3);
jest.unstable_mockModule('./analysisService.js', () => ({
  analyzeTranscript: analysis.analyzeTranscript,
  emptyAnalysis: (reason = 'No speech detected in this recording.') => ({
    language: 'unknown',
    summary: reason,
    keyPoints: [],
    topics: ['other'],
    requirements: {},
    siteVisit: {},
    maintenance: {},
    payment: {},
    followUp: {},
    customer: {},
  }),
}));
jest.unstable_mockModule('./actionExecutor.js', () => executor);
jest.unstable_mockModule('./queue.js', () => queue);
jest.unstable_mockModule('./entityResolver.js', () => ({
  loadEntitySnapshot: async () => ({ leadId: 'L1', name: 'Rahul' }),
  summarizeEntityForPrompt: () => ({ name: 'Rahul' }),
}));

const { runTranscriptionStage, runAnalysisStage, processJob, startProcessing } = await import('./pipeline.js');
const { RECORDING_STATUS, PIPELINE_STAGE, ENTITY_TYPE, ACTION_STATUS } = await import('./constants.js');

function baseRecording(overrides = {}) {
  return {
    tenantId: 't1',
    recordingId: 'r1',
    status: RECORDING_STATUS.QUEUED,
    s3Key: 't1/call-recordings/r1/original.mp3',
    filename: '9876543210.mp3',
    asrJobName: null,
    asrPollAttempts: 0,
    matchedEntityType: ENTITY_TYPE.UNMATCHED,
    createdAt: '2026-01-05T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  repo.transitionStatus.mockResolvedValue({ ok: true });
  repo.incrementStageAttempt.mockResolvedValue(1);
  repo.updateRecording.mockResolvedValue({});
  repo.markFailed.mockResolvedValue({});
  repo.refreshCompletionStatus.mockResolvedValue({ status: RECORDING_STATUS.COMPLETED });
  executor.applyAutomaticActions.mockResolvedValue([]);
  queue.isQueueEnabled.mockReturnValue(false);
  queue.enqueueJob.mockResolvedValue({ ok: true, queued: true });
  s3.putObjectText.mockResolvedValue('key');
});

describe('runTranscriptionStage', () => {
  it('starts a transcription job and asks to be polled later', async () => {
    repo.getRecording.mockResolvedValue(baseRecording());
    provider.startTranscription.mockResolvedValue({ jobId: 'job-1' });

    const result = await runTranscriptionStage({ tenantId: 't1', recordingId: 'r1' });

    expect(provider.startTranscription).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 't1', recordingId: 'r1', s3Key: 't1/call-recordings/r1/original.mp3',
    }));
    expect(repo.updateRecording).toHaveBeenCalledWith('t1', 'r1', expect.objectContaining({
      asrJobName: 'job-1', asrProvider: 'amazon-transcribe',
    }));
    expect(result).toMatchObject({ ok: true, done: false });
    expect(result.requeueIn).toBeGreaterThan(0);
  });

  it('does nothing when the recording already moved past transcription', async () => {
    repo.getRecording.mockResolvedValue(baseRecording({ status: RECORDING_STATUS.ANALYZED }));

    const result = await runTranscriptionStage({ tenantId: 't1', recordingId: 'r1' });

    expect(result).toEqual({ ok: true, done: true, skipped: true });
    expect(provider.startTranscription).not.toHaveBeenCalled();
  });

  it('skips when another worker already claimed the stage', async () => {
    repo.getRecording.mockResolvedValue(baseRecording());
    repo.transitionStatus.mockResolvedValue(null);

    const result = await runTranscriptionStage({ tenantId: 't1', recordingId: 'r1' });

    expect(result).toEqual({ ok: true, done: false, skipped: true });
    expect(provider.startTranscription).not.toHaveBeenCalled();
  });

  it('fails the recording once the attempt cap is exceeded', async () => {
    repo.getRecording.mockResolvedValue(baseRecording());
    repo.incrementStageAttempt.mockResolvedValue(99);

    const result = await runTranscriptionStage({ tenantId: 't1', recordingId: 'r1' });

    expect(repo.markFailed).toHaveBeenCalledWith('t1', 'r1', PIPELINE_STAGE.TRANSCRIPTION, expect.any(String));
    expect(result.ok).toBe(false);
    expect(provider.startTranscription).not.toHaveBeenCalled();
  });

  it('marks the recording failed when the ASR job cannot be started', async () => {
    repo.getRecording.mockResolvedValue(baseRecording());
    provider.startTranscription.mockRejectedValue(new Error('BadRequestException'));

    const result = await runTranscriptionStage({ tenantId: 't1', recordingId: 'r1' });

    expect(repo.markFailed).toHaveBeenCalledWith('t1', 'r1', PIPELINE_STAGE.TRANSCRIPTION, 'BadRequestException');
    expect(result.ok).toBe(false);
  });

  it('keeps polling while the job is in progress', async () => {
    repo.getRecording.mockResolvedValue(baseRecording({
      status: RECORDING_STATUS.TRANSCRIBING, asrJobName: 'job-1', asrPollAttempts: 3,
    }));
    provider.pollTranscription.mockResolvedValue({ status: 'IN_PROGRESS' });

    const result = await runTranscriptionStage({ tenantId: 't1', recordingId: 'r1' });

    expect(repo.updateRecording).toHaveBeenCalledWith('t1', 'r1', { asrPollAttempts: 4 });
    expect(result).toMatchObject({ ok: true, done: false });
  });

  it('retries rather than failing when a single poll call errors', async () => {
    repo.getRecording.mockResolvedValue(baseRecording({
      status: RECORDING_STATUS.TRANSCRIBING, asrJobName: 'job-1',
    }));
    provider.pollTranscription.mockRejectedValue(new Error('ThrottlingException'));

    const result = await runTranscriptionStage({ tenantId: 't1', recordingId: 'r1' });

    expect(repo.markFailed).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, done: false });
  });

  it('gives up after the poll budget is exhausted', async () => {
    repo.getRecording.mockResolvedValue(baseRecording({
      status: RECORDING_STATUS.TRANSCRIBING, asrJobName: 'job-1', asrPollAttempts: 10_000,
    }));

    const result = await runTranscriptionStage({ tenantId: 't1', recordingId: 'r1' });

    expect(repo.markFailed).toHaveBeenCalledWith(
      't1', 'r1', PIPELINE_STAGE.TRANSCRIPTION, expect.stringContaining('did not finish'),
    );
    expect(result.ok).toBe(false);
  });

  it('stores the transcript and advances to analysis when the job completes', async () => {
    repo.getRecording.mockResolvedValue(baseRecording({
      status: RECORDING_STATUS.TRANSCRIBING, asrJobName: 'job-1',
    }));
    provider.pollTranscription.mockResolvedValue({
      status: 'COMPLETED',
      result: {
        transcript: 'Namaste, 2 BHK chahiye.',
        segments: [],
        language: 'hi-IN',
        confidence: 0.9,
        durationSeconds: 42,
        provider: 'amazon-transcribe',
      },
    });

    const result = await runTranscriptionStage({ tenantId: 't1', recordingId: 'r1' });

    expect(s3.putObjectText).toHaveBeenCalledTimes(2);
    expect(repo.updateRecording).toHaveBeenCalledWith('t1', 'r1', expect.objectContaining({
      status: RECORDING_STATUS.TRANSCRIBED,
      asrLanguage: 'hi-IN',
      audioDurationSeconds: 42,
    }));
    expect(result).toMatchObject({ ok: true, done: true, nextStage: PIPELINE_STAGE.ANALYSIS });
  });

  it('fails the recording when the transcript cannot be persisted', async () => {
    repo.getRecording.mockResolvedValue(baseRecording({
      status: RECORDING_STATUS.TRANSCRIBING, asrJobName: 'job-1',
    }));
    provider.pollTranscription.mockResolvedValue({
      status: 'COMPLETED', result: { transcript: 'hi', segments: [] },
    });
    s3.putObjectText.mockRejectedValue(new Error('AccessDenied'));

    const result = await runTranscriptionStage({ tenantId: 't1', recordingId: 'r1' });

    expect(repo.markFailed).toHaveBeenCalledWith(
      't1', 'r1', PIPELINE_STAGE.TRANSCRIPTION, expect.stringContaining('AccessDenied'),
    );
    expect(result.ok).toBe(false);
  });

  it('reports a missing recording instead of throwing', async () => {
    repo.getRecording.mockResolvedValue(null);
    await expect(runTranscriptionStage({ tenantId: 't1', recordingId: 'nope' }))
      .resolves.toEqual({ ok: false, error: 'recording_not_found' });
  });
});

describe('runAnalysisStage', () => {
  const transcribed = () => baseRecording({
    status: RECORDING_STATUS.TRANSCRIBED,
    transcriptS3Key: 't1/call-recordings/r1/transcript/transcript.json',
    matchedEntityType: ENTITY_TYPE.LEAD,
    matchedEntityId: 'L1',
    matchedEntityName: 'Rahul',
    callDate: '2026-01-05',
  });

  it('analyses the transcript, plans actions and auto-applies the note', async () => {
    repo.getRecording.mockResolvedValue(transcribed());
    s3.getObjectText.mockResolvedValue(JSON.stringify({ transcript: '2 BHK chahiye Whitefield mein.' }));
    analysis.analyzeTranscript.mockResolvedValue({
      ok: true,
      model: 'gemini-test',
      promptVersion: 'v1',
      analysis: {
        language: 'hi-IN',
        summary: 'Buyer wants a 2 BHK.',
        keyPoints: ['Budget 80 lakh'],
        topics: ['budget'],
        requirements: { bhk: '2BHK', budgetMax: 8000000, locations: ['Whitefield'] },
        siteVisit: { requested: false },
        maintenance: { required: false },
        payment: { discussed: false },
        followUp: { required: false },
        customer: { name: 'Rahul' },
        suggestedLeadStatus: 'qualified',
      },
    });

    const result = await runAnalysisStage({ tenantId: 't1', recordingId: 'r1' });

    expect(result.ok).toBe(true);
    const update = repo.updateRecording.mock.calls.at(-1)[2];
    expect(update.status).toBe(RECORDING_STATUS.ANALYZED);
    expect(update.summary).toBe('Buyer wants a 2 BHK.');
    expect(update.proposedActions.map((a) => a.tool))
      .toEqual(['create_lead_note', 'update_lead']);
    // The note is auto-applied, the lead update waits for approval.
    expect(update.proposedActions[0].requiresApproval).toBe(false);
    expect(update.proposedActions[1].requiresApproval).toBe(true);
    expect(executor.applyAutomaticActions).toHaveBeenCalled();
  });

  it('produces an empty analysis rather than calling the LLM on a silent recording', async () => {
    repo.getRecording.mockResolvedValue(transcribed());
    s3.getObjectText.mockResolvedValue(JSON.stringify({ transcript: '   ' }));

    const result = await runAnalysisStage({ tenantId: 't1', recordingId: 'r1' });

    expect(analysis.analyzeTranscript).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(repo.updateRecording.mock.calls.at(-1)[2].status).toBe(RECORDING_STATUS.ANALYZED);
  });

  it('marks the recording failed when the model call fails', async () => {
    repo.getRecording.mockResolvedValue(transcribed());
    s3.getObjectText.mockResolvedValue(JSON.stringify({ transcript: 'hello' }));
    analysis.analyzeTranscript.mockResolvedValue({ ok: false, error: 'analysis_parse_failed' });

    const result = await runAnalysisStage({ tenantId: 't1', recordingId: 'r1' });

    expect(repo.markFailed).toHaveBeenCalledWith('t1', 'r1', PIPELINE_STAGE.ANALYSIS, 'analysis_parse_failed');
    expect(result.ok).toBe(false);
  });

  it('is a no-op once the recording is awaiting approval', async () => {
    repo.getRecording.mockResolvedValue({ ...transcribed(), status: RECORDING_STATUS.AWAITING_APPROVAL });

    const result = await runAnalysisStage({ tenantId: 't1', recordingId: 'r1' });

    expect(result).toEqual({ ok: true, done: true, skipped: true });
    expect(analysis.analyzeTranscript).not.toHaveBeenCalled();
  });

  it('falls back to the stored preview when the transcript object cannot be read', async () => {
    repo.getRecording.mockResolvedValue({ ...transcribed(), transcriptPreview: 'preview text' });
    s3.getObjectText.mockRejectedValue(new Error('NoSuchKey'));
    analysis.analyzeTranscript.mockResolvedValue({
      ok: true,
      analysis: {
        summary: 's', keyPoints: [], topics: ['other'], requirements: {},
        siteVisit: {}, maintenance: {}, payment: {}, followUp: {}, customer: {},
      },
    });

    const result = await runAnalysisStage({ tenantId: 't1', recordingId: 'r1' });

    expect(analysis.analyzeTranscript).toHaveBeenCalledWith(
      expect.objectContaining({ transcript: 'preview text' }),
    );
    expect(result.ok).toBe(true);
  });

  it('marks every proposed action pending so nothing is silently written', async () => {
    repo.getRecording.mockResolvedValue(transcribed());
    s3.getObjectText.mockResolvedValue(JSON.stringify({ transcript: 'painting karwana hai' }));
    analysis.analyzeTranscript.mockResolvedValue({
      ok: true,
      analysis: {
        summary: 'Owner wants painting done.',
        keyPoints: [],
        topics: ['painting_whitewash'],
        requirements: {},
        siteVisit: { requested: false },
        maintenance: { required: true, workType: 'painting' },
        payment: { discussed: false },
        followUp: { required: false },
        customer: {},
      },
    });

    await runAnalysisStage({ tenantId: 't1', recordingId: 'r1' });

    const { proposedActions } = repo.updateRecording.mock.calls.at(-1)[2];
    expect(proposedActions.every((a) => a.status === ACTION_STATUS.PENDING)).toBe(true);
    const maintenance = proposedActions.find((a) => a.tool === 'create_meeting');
    expect(maintenance.requiresApproval).toBe(true);
  });
});

describe('processJob', () => {
  it('runs analysis inline after transcription when no queue is configured', async () => {
    queue.isQueueEnabled.mockReturnValue(false);
    repo.getRecording
      .mockResolvedValueOnce(baseRecording({ status: RECORDING_STATUS.TRANSCRIBING, asrJobName: 'job-1' }))
      .mockResolvedValueOnce(baseRecording({
        status: RECORDING_STATUS.TRANSCRIBED,
        transcriptS3Key: 'k',
        transcriptPreview: '',
      }));
    provider.pollTranscription.mockResolvedValue({
      status: 'COMPLETED', result: { transcript: '', segments: [] },
    });
    s3.getObjectText.mockResolvedValue(JSON.stringify({ transcript: '' }));

    const result = await processJob({ tenantId: 't1', recordingId: 'r1', stage: PIPELINE_STAGE.TRANSCRIPTION });

    expect(result.ok).toBe(true);
    expect(queue.enqueueJob).not.toHaveBeenCalled();
  });

  it('hands analysis to the queue when SQS is configured', async () => {
    queue.isQueueEnabled.mockReturnValue(true);
    repo.getRecording.mockResolvedValue(baseRecording({
      status: RECORDING_STATUS.TRANSCRIBING, asrJobName: 'job-1',
    }));
    provider.pollTranscription.mockResolvedValue({
      status: 'COMPLETED', result: { transcript: 'hi', segments: [] },
    });

    const result = await processJob({ tenantId: 't1', recordingId: 'r1', stage: PIPELINE_STAGE.TRANSCRIPTION });

    expect(queue.enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({ stage: PIPELINE_STAGE.ANALYSIS }), 0,
    );
    expect(result).toMatchObject({ ok: true, handedOff: true });
  });

  it('re-queues itself with a delay while transcription is still running', async () => {
    queue.isQueueEnabled.mockReturnValue(true);
    repo.getRecording.mockResolvedValue(baseRecording({
      status: RECORDING_STATUS.TRANSCRIBING, asrJobName: 'job-1',
    }));
    provider.pollTranscription.mockResolvedValue({ status: 'IN_PROGRESS' });

    const result = await processJob({ tenantId: 't1', recordingId: 'r1', stage: PIPELINE_STAGE.TRANSCRIPTION });

    expect(queue.enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({ stage: PIPELINE_STAGE.TRANSCRIPTION }),
      expect.any(Number),
    );
    expect(result).toMatchObject({ ok: true, requeued: true });
  });
});

describe('startProcessing', () => {
  it('queues the first job when SQS is available', async () => {
    queue.isQueueEnabled.mockReturnValue(true);
    queue.enqueueJob.mockResolvedValue({ ok: true, queued: true });

    await expect(startProcessing({ tenantId: 't1', recordingId: 'r1' }))
      .resolves.toEqual({ ok: true, mode: 'queued' });
  });

  it('falls back to inline processing when the queue send fails', async () => {
    queue.isQueueEnabled.mockReturnValue(true);
    queue.enqueueJob.mockResolvedValue({ ok: false, queued: false, error: 'AccessDenied' });
    repo.getRecording.mockResolvedValue(baseRecording({ status: RECORDING_STATUS.ANALYZED }));

    await expect(startProcessing({ tenantId: 't1', recordingId: 'r1' }))
      .resolves.toEqual({ ok: true, mode: 'inline' });
  });
});
