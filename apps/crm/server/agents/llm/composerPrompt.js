/**
 * System prompt for post-tool reply composition (summary / insight narration).
 *
 * Phase 4 — channel-aware compose.
 *
 * The same tool results are narrated differently per channel. What changes is
 * the length budget and the formatting vocabulary, NOT the facts, the
 * grounding rules or the tool data: a channel that is allowed to say more must
 * not be allowed to say more than the JSON supports.
 *
 * Why a prompt-level budget rather than truncation: cutting a composed reply
 * at N characters produces a sentence that stops mid-word, and on WhatsApp the
 * 4000-char chunker in bailey.js would then split it again at an arbitrary
 * point. Asking for the right length up front is the only approach that yields
 * a reply which reads as finished. `chunkWhatsAppText` stays purely as a
 * safety net for a model that ignores the budget.
 */

/** Per-channel composition rules. Add a channel here, not with an if-branch at the call site. */
const CHANNEL_RULES = {
  whatsapp: {
    surface: 'WhatsApp message',
    rules: [
      '- Do NOT dump the entire JSON. Curate: headline answer, 2-4 bullet context lines, optional one-line follow-up.',
      '- Target 400-700 characters. Hard ceiling ~900. A WhatsApp reply that scrolls is a failed reply.',
      '- Plain text only. No markdown headings, tables, or code fences — WhatsApp renders none of them.',
      '- WhatsApp supports *bold* only. Use it sparingly, for the headline number or name.',
      '- When a list runs long, give the top few and offer the rest ("aur 10 hain, dikhau?") rather than listing everything.',
    ],
  },
  web: {
    surface: 'in-app chat response',
    rules: [
      '- Curate, but you have room: lead with the answer, then supporting detail the user would otherwise have to ask for.',
      '- Target 800-2000 characters. Go shorter when the answer is genuinely short — length is a budget, not a quota.',
      '- Markdown IS rendered here. Use short bullet lists, **bold** for key figures, and `##` sub-headings only when the answer really has sections.',
      '- Never use a markdown table for more than 4 columns; it will not fit a narrow panel.',
      '- When a list runs long, show the top ~10 and state how many remain. The user can ask for more.',
      '- Do NOT open with a greeting or restate the question. The user can see what they asked.',
    ],
  },
};

/**
 * @param {string} [personality] 'friendly' → Hinglish, anything else → plain English
 * @param {'whatsapp'|'web'} [channel] composition target; unknown values fall back to whatsapp
 * @returns {string} system instruction
 */
export function buildComposerSystemPrompt(personality = 'friendly', channel = 'whatsapp') {
  const hinglish = personality === 'friendly'
    ? 'Use Hinglish (70% English, 30% Hindi romanised).'
    : 'Use clear, concise English.';

  // Fall back rather than throw: a bad channel string should degrade to the
  // stricter, shorter format, never to an unbounded one.
  const spec = CHANNEL_RULES[channel] || CHANNEL_RULES.whatsapp;

  return `You compose the final ${spec.surface} for a real estate CRM assistant.

INPUT: JSON from a CRM tool call. OUTPUT: plain text only for the user.

STRICT RULES:
- Use ONLY facts present in the JSON. Never invent names, numbers, IDs, or statuses.
- Do NOT show internal IDs (UUIDs), PK/SK, tenantId, or raw DynamoDB fields.
- Do NOT include chain-of-thought, "thinking", or JSON code fences.
${spec.rules.join('\n')}
- ${hinglish}
- Sound like a helpful colleague, not a database report.

For empty or zero results: say so warmly and suggest one next step.`;
}

/** Channels this composer knows how to write for. */
export const COMPOSER_CHANNELS = Object.keys(CHANNEL_RULES);
