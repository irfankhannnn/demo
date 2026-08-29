/**
 * Domain Router (Stage A of the agent pipeline).
 *
 * Given the user's latest message (+ light conversation context), decide which
 * CRM DOMAIN(s) the request belongs to — leads, buyers, owners, tenants,
 * properties, contacts, meetings, analytics — or that it is small talk.
 *
 * Only the routed domain's tools are then handed to the planner LLM, so the
 * planner never sees all 60+ tools at once. This is the single place intent
 * routing happens (no more scattered regex/LLM intent parsers).
 *
 * Two stages:
 *   1. Rules fast-path — cheap keyword match on the domain aliases. Handles the
 *      overwhelming majority of real messages with zero LLM cost/latency.
 *   2. LLM fallback — a compact classification call (GEMINI_CLASSIFIER_MODEL)
 *      only when the fast-path is not confident.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { DOMAIN_CATALOG, DOMAINS } from '../shared/toolDefinitions.js';
import { createGeminiLogSession } from './geminiFileLogger.js';
import { logger } from '../logger.js';

const DOMAIN_SET = new Set(DOMAINS);

// Sensible superset when intent is genuinely unclear and no LLM is available.
// Keeps the planner focused on the CRM "hub" domains rather than all tools.
const DEFAULT_DOMAINS = ['leads', 'analytics', 'contacts'];

const SMALLTALK_RE = /^(hi|hii+|hey|hello|helo|namaste|namaskar|salaam|salam|assalam|yo|sup|hola|good\s?(morning|afternoon|evening|night)|gm|gn|thanks|thank\s?you|thx|shukriya|dhanyavaad|ok|okay|thik hai|theek hai|great|cool|nice|👍|🙏|bye|good\s?bye|tata|welcome|how are you|kaise ho|kya haal)\b/i;

const LIST_INTENT_RE = /(list|dikhao|show|batao|sari|sare|all|names?|rows?|details?)\b/i;
const PIPELINE_STATUS_RE = /\b(new|contacted|qualified|negotiating|lost)\b/i;
const PIPELINE_ENTITY_LIST_RE = /\b(buyer|seller|tenant|owner)\s+(list|leads?)\b/i;
const HOT_PRIORITY_LEADS_RE = /\b(hot\s+leads?|priority\s+leads?|high\s+priority\s+leads?|who\s+(should|to)\s+call)\b/i;
const CONVERTED_TENANT_RE = /\b(lease|rental|customer|kirayedar|converted|rent)\b/i;

function mentionsLeadWord(lower) {
  return /(^|[^a-z])leads?([^a-z]|$)/i.test(lower);
}

/**
 * Detect pipeline-lead list intent even when the user omits the word "leads"
 * (e.g. "buyer list", "sare tenants", "qualified dikhao").
 */
function isPipelineLeadListIntent(lower) {
  if (mentionsLeadWord(lower)) return true;
  if (!LIST_INTENT_RE.test(lower) && !PIPELINE_STATUS_RE.test(lower)) return false;
  if (PIPELINE_STATUS_RE.test(lower)) return true;
  if (PIPELINE_ENTITY_LIST_RE.test(lower)) return true;
  if (/\b(buyer|seller|tenant|owner)\s+list\b/i.test(lower)) return true;
  if (/\btenants?\b/i.test(lower) && !CONVERTED_TENANT_RE.test(lower)) return true;
  return false;
}

/**
 * Match domains by keyword aliases. Returns domain ids ordered by score.
 * @param {string} lower - lowercased message
 * @returns {{ domain: string, score: number }[]}
 */
function scoreDomains(lower) {
  const scores = [];
  for (const d of DOMAIN_CATALOG) {
    let score = 0;
    for (const alias of d.aliases) {
      // word-ish boundary match so "owner" doesn't fire inside "downtown"
      const re = new RegExp(`(^|[^a-z])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
      if (re.test(lower)) score += 1;
    }
    if (score > 0) scores.push({ domain: d.id, score });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores;
}

/**
 * Rules fast-path. Returns null when not confident enough (defer to LLM).
 * @param {string} message
 * @returns {{ domains: string[], smalltalk: boolean, source: string } | null}
 */
export function routeDomainsFast(message) {
  const raw = String(message || '').trim();
  const lower = raw.toLowerCase();
  if (!lower) return { domains: [], smalltalk: true, source: 'rules.empty' };

  const scored = scoreDomains(lower);
  const mentionsLead = mentionsLeadWord(lower);

  // Pure greeting / thanks with no CRM keyword → small talk.
  if (SMALLTALK_RE.test(lower) && scored.length === 0 && raw.length < 40) {
    return { domains: [], smalltalk: true, source: 'rules.smalltalk' };
  }

  // Hot / priority lead ranking → analytics tools (get_work_queue), not row search.
  if (HOT_PRIORITY_LEADS_RE.test(lower)) {
    const domains = ['analytics'];
    if (mentionsLead) domains.push('leads');
    return { domains: domains.filter((d) => DOMAIN_SET.has(d)), smalltalk: false, source: 'rules.keyword.priority' };
  }

  // Pipeline queries → leads domain only (not buyers/owners/tenants entity records).
  if (isPipelineLeadListIntent(lower)) {
    const isCount = /(how many|kitn[ei]|count|total\b|summary|breakdown)/i.test(lower);
    const wantsRows = LIST_INTENT_RE.test(lower);
    const domains = ['leads'];
    if (isCount && !wantsRows) domains.push('analytics');
    return { domains: domains.filter((d) => DOMAIN_SET.has(d)), smalltalk: false, source: 'rules.keyword.leads' };
  }

  if (scored.length === 0) return null; // unclear → LLM

  // "how many / kitne <entity>" style → analytics, but keep the entity domain too.
  const isCount = /(how many|kitn[ei]|count|total\b|summary|breakdown)/i.test(lower);

  // Build the domain shortlist (max 2) from the top scores.
  const top = scored[0];
  const domains = new Set([top.domain]);

  // Counts/summaries pull in analytics unless the user asked for explicit rows.
  const wantsRows = /(list|dikhao|show|batao|names?|rows?|details?)/i.test(lower);
  if (isCount && !wantsRows) domains.add('analytics');

  // Include a strong second domain if it nearly ties the top one.
  if (scored[1] && scored[1].score >= top.score) domains.add(scored[1].domain);

  const result = [...domains].filter((d) => DOMAIN_SET.has(d)).slice(0, 2);

  // Ambiguous if the top two domains tie AND neither is clearly dominant and no
  // lead/count disambiguator applied — let the LLM decide.
  if (scored.length >= 2 && scored[0].score === scored[1].score && !mentionsLead && !isCount) {
    return null;
  }

  return { domains: result, smalltalk: false, source: 'rules.keyword' };
}

function buildRouterPrompt() {
  const lines = DOMAIN_CATALOG.map((d) => `- ${d.id}: ${d.description}`).join('\n');
  return `You are the domain router for a real-estate CRM WhatsApp assistant. Users write in Hinglish (English + romanised Hindi).

Classify the user's LATEST message into the 1 or 2 most relevant CRM domains, or mark it as small talk.

DOMAINS:
${lines}

RULES:
- Return ONLY JSON: {"domains":["<id>", ...],"smalltalk":false}. No prose, no code fences.
- Use domain ids exactly as listed. At most 2 domains, most relevant first.
- Small talk (greetings, thanks, chit-chat with no CRM data need): {"domains":[],"smalltalk":true}.
- "tenant leads" / "seller leads" / pipeline lists → "leads". Converted records → the entity domain.
- "how many / kitne / summary / dashboard / pipeline / follow-ups / who to call" → "analytics".
- If unsure between rows of an entity vs its leads, prefer "leads".`;
}

/**
 * LLM fallback classification.
 * @param {string} message
 * @param {object} [opts]
 * @param {() => void} [opts.onApiCall]
 * @returns {Promise<{ domains: string[], smalltalk: boolean, source: string } | null>}
 */
async function routeDomainsLlm(message, opts = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_CLASSIFIER_MODEL || process.env.GEMINI_MODEL;
  if (!apiKey || !modelName) return null;

  const systemInstruction = buildRouterPrompt();
  try {
    const geminiLog = createGeminiLogSession({ agentId: 'domain_router', kind: 'router' });
    await geminiLog?.writeInput({
      type: 'generate_content',
      model: modelName,
      systemInstruction,
      userPrompt: message,
    });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName, systemInstruction });
    opts.onApiCall?.();
    const result = await model.generateContent(message);
    const text = (result.response.text() || '').trim().replace(/^```json\s*|\s*```$/gi, '').trim();
    const parsed = JSON.parse(text);

    const smalltalk = parsed.smalltalk === true;
    const domains = Array.isArray(parsed.domains)
      ? parsed.domains.filter((d) => DOMAIN_SET.has(d)).slice(0, 2)
      : [];

    const route = { domains, smalltalk: smalltalk && domains.length === 0, source: 'llm' };
    await geminiLog?.writeOutput({
      type: 'generate_content_response',
      model: modelName,
      text,
      parsed,
      route,
    });

    return route;
  } catch (err) {
    logger.debug('agent.router.llm_failed', { error: err.message, message: String(message).slice(0, 80) });
    return null;
  }
}

/**
 * Route a message to CRM domain(s).
 * @param {string} message
 * @param {object} [opts]
 * @param {object|null} [opts.conversationState]
 * @param {() => void} [opts.onApiCall]
 * @returns {Promise<{ domains: string[], smalltalk: boolean, source: string }>}
 */
export async function routeDomains(message, opts = {}) {
  const fast = routeDomainsFast(message);
  if (fast && (fast.smalltalk || fast.domains.length > 0)) {
    logger.info('agent.router.result', { source: fast.source, domains: fast.domains, smalltalk: fast.smalltalk });
    return fast;
  }

  const llm = await routeDomainsLlm(message, opts);
  if (llm && (llm.smalltalk || llm.domains.length > 0)) {
    logger.info('agent.router.result', { source: llm.source, domains: llm.domains, smalltalk: llm.smalltalk });
    return llm;
  }

  // Last resort: carry over the focused entity's domain if we have one, else a
  // sensible CRM superset. Never dump all tools blindly.
  const focusType = opts.conversationState?.context?.currentEntity?.type;
  const carry = focusType && DOMAIN_SET.has(`${focusType}s`) ? [`${focusType}s`] : [];
  const domains = carry.length > 0 ? carry : DEFAULT_DOMAINS;
  logger.info('agent.router.result', { source: 'default', domains, smalltalk: false });
  return { domains, smalltalk: false, source: 'default' };
}
