/**
 * Prompt construction for call analysis.
 *
 * The model is asked for *observations only* — it never names a CRM tool.
 * Mapping observations to tool calls happens deterministically in
 * `actionPlanner.js`, so a transcript cannot talk the system into calling a
 * tool it was not designed to call.
 */

import { DISCUSSION_TOPICS } from './constants.js';

export const ANALYSIS_PROMPT_VERSION = 'call-intel-v1';

export const ANALYSIS_SYSTEM_PROMPT = `You analyse recorded phone calls for an Indian real-estate agency CRM.

Calls are usually a mix of Hindi, Marathi and English (Hinglish code-switching). Read the transcript in its original language; do not translate the transcript, but write your summary and key points in clear English.

Return ONLY a JSON object matching the requested schema. No markdown, no commentary.

Rules:
- Never invent facts. If something was not discussed, use null or false.
- Money: return plain numbers in INR. "1.5 cr" => 15000000, "50 lakh" => 5000000, "25k rent" => 25000.
- Dates: ISO "YYYY-MM-DD". Resolve relative dates ("Saturday", "next week") against the call date given below. If ambiguous, use null.
- Topics must be chosen from the allowed list only.
- Painting, whitewashing, plumbing, carpentry and similar property work count as maintenance.
- "khata" refers to the agency's ledger of money given/received; treat it as a payment topic.
- summary: 3-6 sentences, factual, mentioning who wanted what and what was agreed.
- keyPoints: 3-8 short bullet strings.`;

/** JSON contract the model must return. Kept in the prompt so it works with any provider. */
export const ANALYSIS_SCHEMA_DESCRIPTION = `{
  "language": "primary language observed, e.g. hinglish | hindi | marathi | english",
  "summary": "string",
  "keyPoints": ["string"],
  "topics": ["one or more of: ${DISCUSSION_TOPICS.join(' | ')}"],
  "sentiment": "positive | neutral | negative",
  "intentLevel": "HIGH | MEDIUM | LOW",
  "customer": { "name": "string|null", "phone": "string|null" },
  "counterpartyRole": "lead | buyer | tenant | owner | unknown",
  "requirements": {
    "propertyType": "string|null",
    "bhk": "string|null",
    "budgetMin": "number|null",
    "budgetMax": "number|null",
    "locations": ["string"],
    "purpose": "self_use | investment | rental | null",
    "furnishing": "string|null",
    "timeline": "string|null"
  },
  "objections": ["string"],
  "questions": ["string"],
  "siteVisit": { "requested": true, "preferredDate": "YYYY-MM-DD|null", "preferredTime": "HH:mm|null", "propertyOrProject": "string|null" },
  "maintenance": { "required": true, "workType": "painting | whitewash | repair | cleaning | other | null", "description": "string|null", "preferredDate": "YYYY-MM-DD|null", "estimatedCost": "number|null" },
  "payment": { "discussed": true, "direction": "received | given | pending | null", "amount": "number|null", "dueDate": "YYYY-MM-DD|null", "description": "string|null" },
  "followUp": { "required": true, "date": "YYYY-MM-DD|null", "time": "HH:mm|null", "reason": "string|null" },
  "suggestedLeadStatus": "new | contacted | qualified | negotiating | lost | null",
  "isNewLead": false,
  "confidence": "number between 0 and 1"
}`;

/**
 * Build the user prompt for one recording.
 *
 * @param {object} params
 * @param {string} params.transcript
 * @param {object|null} params.entityContext compact CRM record snapshot
 * @param {string} params.callDate ISO date used to resolve relative dates
 * @param {string|null} params.phone
 * @param {number} params.maxTranscriptChars
 */
export function buildAnalysisPrompt({
  transcript,
  entityContext = null,
  callDate,
  phone = null,
  maxTranscriptChars = 60000,
}) {
  const text = String(transcript || '');
  const truncated = text.length > maxTranscriptChars;
  const body = truncated
    ? `${text.slice(0, maxTranscriptChars)}\n\n[transcript truncated for length]`
    : text;

  const contextBlock = entityContext
    ? JSON.stringify(entityContext, null, 2)
    : 'No matching CRM record was found for this phone number. This may be a new lead.';

  return [
    `Call date: ${callDate}`,
    phone ? `Customer phone (from the recording file name): ${phone}` : 'Customer phone: unknown',
    '',
    'Existing CRM record for this phone number:',
    contextBlock,
    '',
    'Return JSON exactly matching this schema:',
    ANALYSIS_SCHEMA_DESCRIPTION,
    '',
    'Call transcript:',
    '"""',
    body,
    '"""',
  ].join('\n');
}
