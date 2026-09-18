/**
 * Single source of truth for the Hot/Warm/Cold lead-temperature rubric.
 * Used by:
 *  - scripts/lead-qualifier-handler.js (LLM fallback, text-only qualification)
 *  - routes/aiCallingInternal.js (context served to the AI qualification call)
 * so a lead qualified by phone and one qualified by text land on the same
 * three buckets, meaning the same thing.
 */

// City-level values don't count as "named an area/building" — matches the
// city dropdown in agency-app/web/src/components/BuyerRequirementFields.tsx.
const CITY_LEVEL_VALUES = new Set(['mumbai', 'pune', 'thane', 'navi mumbai']);

export function hasNamedAreaOrBuilding(lead) {
  const area = lead?.buyerRequirement?.preferredArea
    || lead?.tenantRequirement?.preferredArea
    || lead?.preferredArea;
  if (!area || !String(area).trim()) return false;
  return !CITY_LEVEL_VALUES.has(String(area).trim().toLowerCase());
}

export function buildRubricContext(lead) {
  return {
    hasNamedAreaOrBuilding: hasNamedAreaOrBuilding(lead),
    requirementType: lead?.buyerRequirement?.requirement || null,
  };
}

export const LEAD_TEMPERATURE_RUBRIC = `You are qualifying a real-estate lead into HOT, WARM, or COLD.

HOT: the customer wants a property immediately AND has already named
a specific area or building (not just "somewhere nice").
WARM: the customer wants to visit a property and decide in person,
but hasn't fixed on one area/building yet.
COLD: the customer's timeline is roughly a couple of months out —
early research, not ready to commit or visit yet.`;

export function buildQualifierPrompt(lead) {
  const rubricContext = buildRubricContext(lead);
  return `${LEAD_TEMPERATURE_RUBRIC}

Lead data: ${JSON.stringify(lead)}
Known context: ${JSON.stringify(rubricContext)}

Return JSON: {"score":"HOT|WARM|COLD","scoreValue":0-100,"reasons":["..."]}`;
}

/** The three buckets, in one place so the schema and the parser cannot disagree. */
export const LEAD_SCORES = ['HOT', 'WARM', 'COLD'];

/**
 * Response schema for the qualifier (Phase 5b).
 *
 * Written as a plain object rather than importing `SchemaType` so this module
 * stays free of an SDK dependency — the string values are the wire format the
 * Gemini API expects, and `SchemaType.STRING === 'string'`.
 *
 * With this in place the model cannot return prose, which is what made the
 * prose-sniffing in `parseQualifierOutput` necessary. That sniffing is now a
 * last-resort guard for a model or SDK that ignores the schema, not the
 * primary path.
 */
export const QUALIFIER_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'string', enum: LEAD_SCORES, description: 'Lead temperature.' },
    scoreValue: { type: 'number', description: 'Confidence 0-100.' },
    reasons: {
      type: 'array',
      items: { type: 'string' },
      description: 'Short reasons for the score.',
    },
  },
  required: ['score', 'scoreValue'],
};

/** Clamp to the 0-100 the CRM stores, tolerating a string or a stray float. */
function clampScoreValue(value) {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Parse the qualifier's output into `{ score, scoreValue, reasons }`.
 *
 * Replaces the old `extractScoreLabel` / `extractScoreValue` pair, which
 * searched raw text for substrings like `'hot lead'` and `'score: 72'`. That
 * was unavoidable before structured output existed, but it was guessing: a
 * reason line reading *"not a hot lead at all"* scored the lead HOT, because
 * the phrase appears in it. This flow writes a lead's temperature unattended,
 * so a heuristic that can inverte its own meaning is not acceptable.
 *
 * @param {string} text raw model output (JSON when the schema was applied)
 * @returns {{score: string, scoreValue: number, reasons: string, parsed: boolean}}
 *   `parsed: false` means nothing usable came back and the caller is looking at
 *   the neutral default, not a judgement.
 */
export function parseQualifierOutput(text) {
  const fallback = { score: 'WARM', scoreValue: 50, reasons: '', parsed: false };
  if (!text || typeof text !== 'string') return fallback;

  let payload = null;
  try {
    payload = JSON.parse(text.trim());
  } catch {
    // Some models wrap JSON in a ```json fence despite being told not to.
    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
    if (fenced) {
      try { payload = JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
    }
  }

  if (!payload || typeof payload !== 'object') return fallback;

  const rawScore = String(payload.score ?? '').toUpperCase();
  if (!LEAD_SCORES.includes(rawScore)) return fallback;

  const scoreValue = clampScoreValue(payload.scoreValue ?? payload.score_value);
  const reasons = Array.isArray(payload.reasons)
    ? payload.reasons.filter((r) => typeof r === 'string').join('; ').slice(0, 300)
    : '';

  return {
    score: rawScore,
    // A valid label with a missing/garbage number keeps the label and takes the
    // bucket's midpoint, rather than discarding a good judgement over a number.
    scoreValue: scoreValue ?? { HOT: 85, WARM: 50, COLD: 20 }[rawScore],
    reasons,
    parsed: true,
  };
}
