/**
 * Phase 4 — channel-aware compose.
 *
 * What matters here is that the channel changes only the length budget and the
 * formatting vocabulary. The grounding rules — use only facts in the JSON, no
 * internal IDs, no chain-of-thought — are what stop the composer inventing
 * data, and they must be identical on every channel. A "richer" channel that
 * quietly relaxed them would let the model embellish.
 */

import { buildComposerSystemPrompt, COMPOSER_CHANNELS } from './composerPrompt.js';

const GROUNDING_RULES = [
  'Use ONLY facts present in the JSON',
  'Never invent names, numbers, IDs, or statuses',
  'Do NOT show internal IDs',
  'Do NOT include chain-of-thought',
];

describe('buildComposerSystemPrompt', () => {
  it('defaults to whatsapp, so every pre-Phase-4 caller is unchanged', () => {
    expect(buildComposerSystemPrompt('friendly')).toBe(
      buildComposerSystemPrompt('friendly', 'whatsapp'),
    );
  });

  it.each(COMPOSER_CHANNELS)('keeps every grounding rule on the %s channel', (channel) => {
    const prompt = buildComposerSystemPrompt('friendly', channel);
    for (const rule of GROUNDING_RULES) {
      expect(prompt).toContain(rule);
    }
  });

  it('gives whatsapp a tight budget and forbids markdown it cannot render', () => {
    const prompt = buildComposerSystemPrompt('friendly', 'whatsapp');
    expect(prompt).toContain('400-700 characters');
    expect(prompt).toMatch(/No markdown headings, tables, or code fences/);
  });

  it('gives web a larger budget and allows markdown', () => {
    const prompt = buildComposerSystemPrompt('friendly', 'web');
    expect(prompt).toContain('800-2000 characters');
    expect(prompt).toContain('Markdown IS rendered here');
  });

  it('an unknown channel degrades to whatsapp, never to an unbounded budget', () => {
    // Fail toward the stricter format: a typo in a channel name must not
    // produce a composer with no length limit at all.
    expect(buildComposerSystemPrompt('friendly', 'telegram'))
      .toBe(buildComposerSystemPrompt('friendly', 'whatsapp'));
  });

  it('carries the Hinglish/English personality switch on both channels', () => {
    for (const channel of COMPOSER_CHANNELS) {
      expect(buildComposerSystemPrompt('friendly', channel)).toContain('Hinglish');
      expect(buildComposerSystemPrompt('professional', channel)).toContain('concise English');
    }
  });
});
