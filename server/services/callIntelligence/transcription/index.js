/**
 * ASR provider factory.
 *
 * Selection is configuration-only (`ASR_PROVIDER`), so introducing a Whisper
 * GPU worker later means adding a provider class here — nothing downstream of
 * the transcript changes.
 */

import { logger } from '../../../logger.js';
import { AmazonTranscribeProvider } from './amazonTranscribeProvider.js';

export const ASR_PROVIDERS = {
  AMAZON_TRANSCRIBE: 'amazon-transcribe',
  WHISPER: 'whisper',
};

const instances = new Map();

export function getTranscriptionProvider(name = process.env.ASR_PROVIDER || ASR_PROVIDERS.AMAZON_TRANSCRIBE) {
  const key = String(name).toLowerCase();

  if (instances.has(key)) return instances.get(key);

  let provider;
  switch (key) {
    case ASR_PROVIDERS.AMAZON_TRANSCRIBE:
      provider = new AmazonTranscribeProvider();
      break;
    case ASR_PROVIDERS.WHISPER:
      // Placeholder: a WhisperProvider implementing the same contract can be
      // dropped in once the ASR benchmark justifies self-hosted GPUs.
      throw new Error('ASR_PROVIDER=whisper is not implemented yet. Use amazon-transcribe.');
    default:
      logger.warn('callIntelligence.asr.unknownProvider', { requested: name });
      provider = new AmazonTranscribeProvider();
  }

  instances.set(key, provider);
  return provider;
}

export { TranscriptionProvider, buildTranscriptResult } from './TranscriptionProvider.js';
export { AmazonTranscribeProvider, normalizeAmazonTranscript } from './amazonTranscribeProvider.js';
