import { describe, it, expect } from '@jest/globals';
import { normalizeAmazonTranscript } from './amazonTranscribeProvider.js';

const SAMPLE = {
  jobName: 'rfci-demo',
  results: {
    transcripts: [{ transcript: 'Namaste sir. Do BHK chahiye Thane mein.' }],
    speaker_labels: {
      segments: [
        { start_time: '0.0', end_time: '2.5', speaker_label: 'spk_0' },
        { start_time: '2.5', end_time: '6.0', speaker_label: 'spk_1' },
      ],
    },
    items: [
      { type: 'pronunciation', start_time: '0.1', end_time: '0.8', alternatives: [{ content: 'Namaste', confidence: '0.98' }] },
      { type: 'pronunciation', start_time: '0.9', end_time: '1.4', alternatives: [{ content: 'sir', confidence: '0.94' }] },
      { type: 'punctuation', alternatives: [{ content: '.', confidence: '0.0' }] },
      { type: 'pronunciation', start_time: '2.6', end_time: '3.0', alternatives: [{ content: 'Do', confidence: '0.9' }] },
      { type: 'pronunciation', start_time: '3.1', end_time: '3.6', alternatives: [{ content: 'BHK', confidence: '0.88' }] },
      { type: 'pronunciation', start_time: '3.7', end_time: '4.4', alternatives: [{ content: 'chahiye', confidence: '0.8' }] },
      { type: 'pronunciation', start_time: '4.5', end_time: '5.2', alternatives: [{ content: 'Thane', confidence: '0.86' }] },
      { type: 'pronunciation', start_time: '5.3', end_time: '5.9', alternatives: [{ content: 'mein', confidence: '0.9' }] },
    ],
  },
};

describe('normalizeAmazonTranscript', () => {
  it('produces the shared transcript shape', () => {
    const result = normalizeAmazonTranscript(SAMPLE, { language: 'hi-IN' });
    expect(result.provider).toBe('amazon-transcribe');
    expect(result.language).toBe('hi-IN');
    expect(result.transcript).toBe('Namaste sir. Do BHK chahiye Thane mein.');
    expect(result.durationSeconds).toBe(6);
  });

  it('splits words into speaker segments', () => {
    const { segments } = normalizeAmazonTranscript(SAMPLE);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ speaker: 'spk_0', text: 'Namaste sir' });
    expect(segments[1].speaker).toBe('spk_1');
    expect(segments[1].text).toBe('Do BHK chahiye Thane mein');
  });

  it('averages word confidence', () => {
    const { confidence } = normalizeAmazonTranscript(SAMPLE);
    expect(confidence).toBeGreaterThan(0.7);
    expect(confidence).toBeLessThanOrEqual(1);
  });

  it('handles output without speaker labels', () => {
    const withoutSpeakers = { results: { transcripts: [{ transcript: 'Hello' }], items: [] } };
    const result = normalizeAmazonTranscript(withoutSpeakers);
    expect(result.segments).toEqual([]);
    expect(result.transcript).toBe('Hello');
    expect(result.durationSeconds).toBe(0);
  });

  it('handles a silent recording', () => {
    const silent = { results: { transcripts: [{ transcript: '' }], items: [] } };
    const result = normalizeAmazonTranscript(silent);
    expect(result.transcript).toBe('');
    expect(result.confidence).toBeNull();
  });

  it('does not throw on a malformed payload', () => {
    expect(() => normalizeAmazonTranscript(null)).not.toThrow();
    expect(normalizeAmazonTranscript({}).transcript).toBe('');
  });
});
