/**
 * Turns a transcript into structured call intelligence using Gemini.
 *
 * Deliberately calls the model directly instead of going through
 * `agents/agentRuntime.js`: the AI Employee runtime is gated on provisioning,
 * credits and a rollout percentage, and an agency owner uploading their own
 * recordings should not be blocked by those switches. Tool *execution* still
 * goes through `skillInvoker`, which keeps permission checks and audit intact.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../logger.js';
import { DISCUSSION_TOPICS } from './constants.js';
import {
  ANALYSIS_SYSTEM_PROMPT,
  ANALYSIS_PROMPT_VERSION,
  buildAnalysisPrompt,
} from './analysisPrompt.js';

const MAX_TRANSCRIPT_CHARS = parseInt(process.env.CALL_INTEL_MAX_TRANSCRIPT_CHARS || '60000', 10);

/** Strip markdown fences and any prose the model may wrap around the JSON. */
export function extractJsonObject(text) {
  if (!text) return null;
  let cleaned = String(text).trim();

  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) cleaned = fenced[1].trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  const candidate = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (_) {
    return null;
  }
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function toStringOrNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function toBool(value) {
  return value === true || value === 'true';
}

function toStringArray(value, limit = 20) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function toIsoDateOrNull(value) {
  const text = toStringOrNull(value);
  if (!text) return null;
  if (ISO_DATE.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toTimeOrNull(value) {
  const text = toStringOrNull(value);
  if (!text) return null;
  return ISO_TIME.test(text) ? text : null;
}

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'negotiating', 'lost'];

/**
 * Coerce raw model output into a predictable shape.
 * Every downstream consumer relies on this — never trust the model directly.
 */
export function normalizeAnalysis(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};

  const topics = toStringArray(source.topics, 12)
    .map((topic) => topic.toLowerCase().replace(/[\s-]+/g, '_'))
    .filter((topic) => DISCUSSION_TOPICS.includes(topic));

  const requirements = source.requirements && typeof source.requirements === 'object' ? source.requirements : {};
  const siteVisit = source.siteVisit && typeof source.siteVisit === 'object' ? source.siteVisit : {};
  const maintenance = source.maintenance && typeof source.maintenance === 'object' ? source.maintenance : {};
  const payment = source.payment && typeof source.payment === 'object' ? source.payment : {};
  const followUp = source.followUp && typeof source.followUp === 'object' ? source.followUp : {};
  const customer = source.customer && typeof source.customer === 'object' ? source.customer : {};

  const suggestedLeadStatus = toStringOrNull(source.suggestedLeadStatus)?.toLowerCase() || null;

  return {
    language: toStringOrNull(source.language) || 'unknown',
    summary: String(source.summary || '').trim(),
    keyPoints: toStringArray(source.keyPoints, 10),
    topics: topics.length ? topics : ['other'],
    sentiment: ['positive', 'neutral', 'negative'].includes(source.sentiment) ? source.sentiment : 'neutral',
    intentLevel: ['HIGH', 'MEDIUM', 'LOW'].includes(source.intentLevel) ? source.intentLevel : 'LOW',
    customer: {
      name: toStringOrNull(customer.name),
      phone: toStringOrNull(customer.phone),
    },
    counterpartyRole: ['lead', 'buyer', 'tenant', 'owner'].includes(source.counterpartyRole)
      ? source.counterpartyRole
      : 'unknown',
    requirements: {
      propertyType: toStringOrNull(requirements.propertyType),
      bhk: toStringOrNull(requirements.bhk),
      budgetMin: toNumberOrNull(requirements.budgetMin),
      budgetMax: toNumberOrNull(requirements.budgetMax),
      locations: toStringArray(requirements.locations, 8),
      purpose: toStringOrNull(requirements.purpose),
      furnishing: toStringOrNull(requirements.furnishing),
      timeline: toStringOrNull(requirements.timeline),
    },
    objections: toStringArray(source.objections, 8),
    questions: toStringArray(source.questions, 8),
    siteVisit: {
      requested: toBool(siteVisit.requested),
      preferredDate: toIsoDateOrNull(siteVisit.preferredDate),
      preferredTime: toTimeOrNull(siteVisit.preferredTime),
      propertyOrProject: toStringOrNull(siteVisit.propertyOrProject),
    },
    maintenance: {
      required: toBool(maintenance.required),
      workType: toStringOrNull(maintenance.workType),
      description: toStringOrNull(maintenance.description),
      preferredDate: toIsoDateOrNull(maintenance.preferredDate),
      estimatedCost: toNumberOrNull(maintenance.estimatedCost),
    },
    payment: {
      discussed: toBool(payment.discussed),
      direction: toStringOrNull(payment.direction),
      amount: toNumberOrNull(payment.amount),
      dueDate: toIsoDateOrNull(payment.dueDate),
      description: toStringOrNull(payment.description),
    },
    followUp: {
      required: toBool(followUp.required),
      date: toIsoDateOrNull(followUp.date),
      time: toTimeOrNull(followUp.time),
      reason: toStringOrNull(followUp.reason),
    },
    suggestedLeadStatus: LEAD_STATUSES.includes(suggestedLeadStatus) ? suggestedLeadStatus : null,
    isNewLead: toBool(source.isNewLead),
    confidence: toNumberOrNull(source.confidence),
  };
}

/** Result used when the transcript contains no usable speech. */
export function emptyAnalysis(reason = 'No speech detected in this recording.') {
  return {
    ...normalizeAnalysis({}),
    summary: reason,
    keyPoints: [],
    topics: ['other'],
  };
}

/**
 * Run the LLM analysis.
 *
 * @returns {Promise<{ ok: boolean, analysis?: object, model?: string, promptVersion?: string, error?: string }>}
 */
export async function analyzeTranscript({
  tenantId,
  recordingId,
  transcript,
  entityContext = null,
  phone = null,
  callDate = new Date().toISOString().slice(0, 10),
  deps = {},
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL;

  if (!String(transcript || '').trim()) {
    return { ok: true, analysis: emptyAnalysis(), model: null, promptVersion: ANALYSIS_PROMPT_VERSION };
  }

  if (!apiKey || !modelName) {
    return { ok: false, error: 'llm_not_configured: GEMINI_API_KEY and GEMINI_MODEL are required' };
  }

  const prompt = buildAnalysisPrompt({
    transcript,
    entityContext,
    callDate,
    phone,
    maxTranscriptChars: MAX_TRANSCRIPT_CHARS,
  });

  const generate = deps.generate || (async (userPrompt) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: ANALYSIS_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text();
  });

  try {
    const text = await logger.span(
      'callIntelligence.analysis.generate',
      { tenantId, recordingId, model: modelName, transcriptChars: String(transcript).length },
      async () => generate(prompt),
    );

    let parsed = extractJsonObject(text);

    if (!parsed) {
      // One repair attempt: ask for the JSON again, nothing else.
      logger.warn('callIntelligence.analysis.repairAttempt', { tenantId, recordingId });
      const repaired = await generate(
        `${prompt}\n\nYour previous reply was not valid JSON. Reply with the JSON object only.`,
      );
      parsed = extractJsonObject(repaired);
    }

    if (!parsed) {
      return { ok: false, error: 'analysis_parse_failed: model did not return valid JSON' };
    }

    return {
      ok: true,
      analysis: normalizeAnalysis(parsed),
      model: modelName,
      promptVersion: ANALYSIS_PROMPT_VERSION,
    };
  } catch (err) {
    logger.error('callIntelligence.analysis.failed', {
      tenantId,
      recordingId,
      error: err.message,
      name: err.name,
    });
    return { ok: false, error: `analysis_failed: ${err.message}` };
  }
}
