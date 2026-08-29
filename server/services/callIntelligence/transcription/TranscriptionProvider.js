/**
 * ASR provider contract.
 *
 * The rest of the pipeline only ever sees the normalized transcript shape
 * below, so swapping Amazon Transcribe for Whisper (or routing per tenant)
 * requires no downstream changes.
 *
 * @typedef {Object} TranscriptSegment
 * @property {string} speaker  e.g. "SPEAKER_0"
 * @property {number} start    seconds
 * @property {number} end      seconds
 * @property {string} text
 *
 * @typedef {Object} TranscriptResult
 * @property {string} provider
 * @property {string} language        BCP-47, e.g. "hi-IN"
 * @property {number} durationSeconds
 * @property {string} transcript      full plain text
 * @property {TranscriptSegment[]} segments
 * @property {number|null} confidence 0..1
 */

export class TranscriptionProvider {
  /** @returns {string} stable provider id persisted on the recording */
  get name() {
    throw new Error('TranscriptionProvider.name must be implemented');
  }

  /**
   * Kick off transcription.
   * @param {{ s3Key: string, recordingId: string, tenantId: string, contentType?: string, filename?: string }} _input
   * @returns {Promise<{ jobId: string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async startTranscription(_input) {
    throw new Error('TranscriptionProvider.startTranscription must be implemented');
  }

  /**
   * Poll a running job.
   * @param {{ jobId: string, tenantId: string, recordingId: string }} _input
   * @returns {Promise<{ status: 'IN_PROGRESS'|'COMPLETED'|'FAILED', result?: TranscriptResult, error?: string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async pollTranscription(_input) {
    throw new Error('TranscriptionProvider.pollTranscription must be implemented');
  }
}

/** Normalize/round a provider payload into the shared transcript shape. */
export function buildTranscriptResult({
  provider,
  language = 'unknown',
  durationSeconds = 0,
  transcript = '',
  segments = [],
  confidence = null,
}) {
  return {
    provider,
    language,
    durationSeconds: Math.round(Number(durationSeconds) || 0),
    transcript: String(transcript || '').trim(),
    segments: Array.isArray(segments) ? segments : [],
    confidence: confidence == null ? null : Number(confidence),
  };
}
