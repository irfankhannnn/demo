// Turns a DM thread into a decision a salesperson can act on in ten seconds:
// who this is, what they want, how hot they are, what to do next, and a reply
// ready to send in Hinglish.
//
// The judgement rules come from the insta-lead-analyst agent used by the
// hp-insta-lead-automation workbook pipeline; this is the same analyst running
// inside the service instead of on a laptop.
//
// Providers are pluggable (LLM_PROVIDER):
//   rules   deterministic, free, offline - always available
//   gemini  used when GEMINI_API_KEY is set
//
// Whatever a model returns is checked against the conversation before it is
// kept. A phone number is only accepted when it appears in the lead's own
// messages, so a model can never invent one and our own number (sent in our
// messages) can never be stored as theirs. Any model failure falls back to
// the rules result instead of dropping the lead.

import { getConfig } from '../config/env.js';
import { logger } from '../logger.js';
import { toBudgetBracket } from './normalise.js';
import {
  findPhones,
  parseBudget,
  describeBudget,
  detectIntent,
  detectPropertyType,
  extractName,
  nameFromUsername,
  extractArea,
  looksLikeSpam,
  scoreLead,
  INTENT_TO_LEAD_TYPE,
  SITE_VISIT_RE,
  CALL_ME_RE,
} from './extract.js';

const log = logger.child({ module: 'services/leadAnalyst' });

const LEAD_TYPES = new Set(['buyer', 'seller', 'tenant', 'landlord', 'not_a_lead', 'unknown']);
const LEAD_SCORES = new Set(['very_hot', 'hot', 'cold']);
const DEAL_TYPES = new Set(['rent', 'buy', 'heavy_deposit']);

const SCORE_TO_TEMPERATURE = { very_hot: 'hot', hot: 'warm', cold: 'cold' };
const STALE_AFTER_MS = 21 * 24 * 60 * 60 * 1000;

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

/** buyer/tenant/seller + deal type -> the intent vocabulary the CRM adapter understands. */
export function toIntent(leadType, dealType) {
  if (leadType === 'tenant') return dealType === 'heavy_deposit' ? 'heavy_deposit_ok' : 'rent';
  if (leadType === 'buyer') return 'buy';
  if (leadType === 'seller') return 'sell';
  return 'unknown';
}

function transcript(messages, participantUsername) {
  return messages
    .slice(-40)
    .map((m) => {
      const when = m.createdAt ? String(m.createdAt).slice(0, 16).replace('T', ' ') : 'unknown time';
      const who = m.direction === 'out' ? 'US (the agency)' : `LEAD${participantUsername ? ` @${participantUsername}` : ''}`;
      return `[${when}] ${who}: ${String(m.text || '').slice(0, 1000)}`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Rules provider
// ---------------------------------------------------------------------------

export function analyseWithRules({ messages = [], participantUsername = null, now = Date.now(), knownAreas = [] }) {
  const inbound = messages.filter((m) => m.direction === 'in' && m.text);
  if (inbound.length === 0) return null;

  const inboundText = inbound.map((m) => m.text).join('\n');
  const lastInboundAt = Date.parse(inbound.at(-1).createdAt || '') || now;
  const lastMessage = messages.at(-1);
  const unanswered = lastMessage?.direction === 'in';

  if (looksLikeSpam(inboundText)) {
    return finalise({
      analyser: 'rules',
      isLead: false,
      leadType: 'not_a_lead',
      leadScore: 'cold',
      summary: 'Looks like a promotion, job or collaboration message rather than a property enquiry.',
      nextAction: 'No follow-up needed unless a human reads it differently.',
      suggestedReply: '',
      needsReview: false,
    });
  }

  const phone = findPhones(inboundText)[0] ?? null;
  const budget = parseBudget(inboundText);
  const intent = detectIntent(inboundText);
  const locality = extractArea(inboundText, knownAreas) || '';
  const propertyType = detectPropertyType(inboundText);
  const name = extractName(inboundText) || nameFromUsername(participantUsername);
  const askedSiteVisit = SITE_VISIT_RE.test(inboundText);
  const callRequested = Boolean(phone) && CALL_ME_RE.test(inboundText);

  const score = scoreLead({ phone, budget, intent, area: locality, messageCount: inbound.length, askedSiteVisit });
  const requirementSignals = [intent !== 'unknown', budget, locality, propertyType].filter(Boolean).length;

  let leadScore = phone && requirementSignals >= 1 ? 'very_hot' : requirementSignals >= 2 ? 'hot' : 'cold';
  // Recency is part of the score: a number from a month-old dead thread is not very hot.
  if (leadScore === 'very_hot' && now - lastInboundAt > STALE_AFTER_MS) leadScore = 'hot';

  const leadType = INTENT_TO_LEAD_TYPE[intent] || 'unknown';
  const dealType = intent === 'heavy_deposit_ok' ? 'heavy_deposit' : intent === 'rent' ? 'rent' : intent === 'buy' ? 'buy' : '';

  const wants =
    leadType === 'tenant' ? 'wants to rent' : leadType === 'buyer' ? 'wants to buy' : leadType === 'seller' ? 'wants to sell' : 'is asking about';
  const what = propertyType ? ` a ${propertyType}` : leadType === 'unknown' ? ' a property' : '';
  const summaryParts = [
    `${name || 'This person'} ${wants}${what}${locality ? ` in ${locality}` : ''}${budget ? `, budget ${describeBudget(budget)}` : ''}.`,
    phone ? 'They shared a phone number.' : 'No phone number captured yet.',
    unanswered ? 'Their last message is still waiting on our reply.' : 'We replied last.',
  ];

  const first = firstName(name);
  const missing = [!budget && 'budget', !locality && 'preferred area', !propertyType && 'configuration'].filter(Boolean);
  const suggestedReply = phone
    ? `Thanks ${first || 'ji'}! Aapka number mil gaya. Hum aaj hi call karke ${locality ? `${locality} ke ` : ''}best options share karte hain. Site visit ke liye kab free ho?`
    : `Hi ${first || 'ji'}! ${locality ? `${locality} me ` : ''}${propertyType || 'property'} ke liye kuch achhe options hain. Aapka ${missing.length ? `${missing.join(', ')} aur ` : ''}contact number share karenge? Hum call karke details bata denge.`;

  return finalise({
    analyser: 'rules',
    // A clear requirement is a lead even before a number arrives; the score
    // and the enquiry list must never disagree about that.
    isLead: score >= 20 || requirementSignals >= 2,
    leadType,
    leadScore,
    dealType,
    propertyType,
    locality,
    budgetText: describeBudget(budget),
    budgetRupees: budget?.max ?? budget?.min ?? null,
    name,
    phone,
    summary: summaryParts.join(' '),
    nextAction: phone
      ? `Call ${first || 'them'} today while the enquiry is fresh${missing.length ? ` and confirm ${missing.join(', ')}` : ''}.`
      : `Reply inside the 24-hour window and ask for their phone number${missing.length ? ` and ${missing.join(', ')}` : ''}.`,
    suggestedReply,
    callRequested,
    needsReview: false,
    score,
  });
}

// ---------------------------------------------------------------------------
// Gemini provider
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an Instagram lead analyst for an Indian real estate agency.
You turn one DM thread into decisions a salesperson can act on in under ten seconds.
Messages marked US are the agency. Messages marked LEAD are the other person.

Rules:
- Leave a field as an empty string when the conversation never said it. Never invent a budget, locality, city, building or phone number.
- A number inside a US message is the agency's own contact, never the lead's. Only put a number in mobile_number when the LEAD sent it.
- lead_score: very_hot = a lead's mobile number is on record with a real requirement, or a meeting/site visit is fixed. hot = a clear requirement (at least two of deal type, configuration, locality, budget) with recent activity but no number. cold = vague, one-line, stale, dead negotiation, or said no. A lead silent for weeks after we quoted above budget is hot, not very_hot.
- lead_type: tenant wants to rent (heavy deposit is tenant with deal_type heavy_deposit), buyer wants to purchase, landlord/seller are offering property, not_a_lead is collab/spam/jobs, unknown when intent never surfaced.
- summary: 3 to 5 sentences. What they want, what we told them, where the thread stopped, and the blocker (price gap, no inventory, we never replied, they went quiet).
- next_action: 2 to 3 sentences with the single most useful next step and what to capture. Say so if we broke a promise.
- suggested_reply: ready to paste, about 70% English and 30% romanized Hindi, short enough for a phone, referencing what they asked about. Empty only for not_a_lead.
- meeting_datetime: YYYY-MM-DDTHH:MM only when both a specific date and time were agreed, else empty.
- call_requested: yes only when the lead asked us to call them. needs_review: yes when your reading could be wrong.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    lead_type: { type: 'STRING', enum: [...LEAD_TYPES] },
    lead_score: { type: 'STRING', enum: [...LEAD_SCORES] },
    deal_type: { type: 'STRING', enum: ['rent', 'buy', 'heavy_deposit', 'none'] },
    name: { type: 'STRING' },
    property_type: { type: 'STRING' },
    locality: { type: 'STRING' },
    city: { type: 'STRING' },
    budget: { type: 'STRING' },
    mobile_number: { type: 'STRING' },
    summary: { type: 'STRING' },
    next_action: { type: 'STRING' },
    suggested_reply: { type: 'STRING' },
    meeting_schedule: { type: 'STRING' },
    meeting_datetime: { type: 'STRING' },
    call_requested: { type: 'STRING', enum: ['yes', 'no'] },
    needs_review: { type: 'STRING', enum: ['yes', 'no'] },
    notes: { type: 'STRING' },
  },
  required: ['lead_type', 'lead_score', 'deal_type', 'summary', 'next_action', 'suggested_reply', 'call_requested', 'needs_review'],
};

async function callGemini({ messages, participantUsername, now }, { fetchImpl } = {}) {
  const cfg = getConfig().llm;
  if (!cfg.geminiApiKey) throw new Error('GEMINI_API_KEY is not set');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await (fetchImpl || globalThis.fetch)(`${cfg.geminiBaseUrl}/models/${encodeURIComponent(cfg.model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.geminiApiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [{ text: `Today is ${new Date(now).toISOString().slice(0, 10)}.\n\nThread:\n${transcript(messages, participantUsername)}` }],
          },
        ],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
      }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Gemini answered HTTP ${res.status}${body?.error?.status ? ` (${body.error.status})` : ''}`);
    const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    if (!text) throw new Error(`Gemini returned no content${body?.promptFeedback?.blockReason ? ` (blocked: ${body.promptFeedback.blockReason})` : ''}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

function clean(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function analyseWithGemini(input, deps = {}) {
  const rules = analyseWithRules(input);
  if (!rules) return null;

  const raw = await callGemini({ ...input, now: input.now ?? Date.now() }, deps);
  const inboundText = input.messages.filter((m) => m.direction === 'in').map((m) => m.text || '').join('\n');
  const inboundPhones = findPhones(inboundText);

  // Guard: a model phone number is only kept when the lead actually sent it.
  const modelPhone = findPhones(clean(raw.mobile_number))[0] ?? null;
  const phone = modelPhone && inboundPhones.includes(modelPhone) ? modelPhone : rules.phone;

  const leadType = LEAD_TYPES.has(raw.lead_type) ? raw.lead_type : rules.leadType;
  const dealType = DEAL_TYPES.has(raw.deal_type) ? raw.deal_type : '';
  const budgetText = clean(raw.budget, 120);
  const parsedBudget = parseBudget(budgetText);

  return finalise({
    analyser: 'gemini',
    model: getConfig().llm.model,
    isLead: leadType !== 'not_a_lead' && (rules.isLead || leadType !== 'unknown'),
    leadType,
    leadScore: LEAD_SCORES.has(raw.lead_score) ? raw.lead_score : rules.leadScore,
    dealType,
    propertyType: clean(raw.property_type, 60) || rules.propertyType,
    locality: clean(raw.locality, 120) || rules.locality,
    city: clean(raw.city, 60),
    buildingName: '',
    budgetText: budgetText || rules.budgetText,
    budgetRupees: parsedBudget?.max ?? parsedBudget?.min ?? rules.budgetRupees,
    name: clean(raw.name, 80) || rules.name,
    phone,
    summary: clean(raw.summary) || rules.summary,
    nextAction: clean(raw.next_action) || rules.nextAction,
    suggestedReply: clean(raw.suggested_reply, 1000),
    meetingSchedule: clean(raw.meeting_schedule, 200),
    meetingDatetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(clean(raw.meeting_datetime)) ? clean(raw.meeting_datetime) : '',
    callRequested: raw.call_requested === 'yes' && Boolean(phone),
    needsReview: raw.needs_review === 'yes' || (Boolean(modelPhone) && modelPhone !== phone),
    notes: clean(raw.notes, 300),
    score: rules.score,
  });
}

// ---------------------------------------------------------------------------

function finalise(a) {
  const leadScore = a.leadScore || 'cold';
  const dealType = a.dealType || '';
  return {
    analyser: a.analyser,
    model: a.model ?? null,
    isLead: Boolean(a.isLead),
    leadType: a.leadType || 'unknown',
    leadScore,
    temperature: SCORE_TO_TEMPERATURE[leadScore] || 'cold',
    intent: toIntent(a.leadType, dealType),
    dealType,
    propertyType: a.propertyType || '',
    locality: a.locality || '',
    city: a.city || '',
    budgetText: a.budgetText || '',
    budgetRupees: a.budgetRupees ?? null,
    budgetBracket: a.budgetRupees ? toBudgetBracket(a.budgetRupees) : 'unknown',
    name: a.name || null,
    phone: a.phone || null,
    summary: a.summary || '',
    nextAction: a.nextAction || '',
    suggestedReply: a.suggestedReply || '',
    meetingSchedule: a.meetingSchedule || '',
    meetingDatetime: a.meetingDatetime || '',
    callRequested: Boolean(a.callRequested),
    needsReview: Boolean(a.needsReview),
    notes: a.notes || '',
    score: a.score ?? null,
    analysedAt: new Date().toISOString(),
  };
}

/**
 * @param {{messages: Array<{direction: 'in'|'out', text: string, createdAt: string}>,
 *   participantUsername?: string, now?: number, knownAreas?: string[]}} input
 * @returns {Promise<object|null>} null when the thread has no inbound message
 */
export async function analyseConversation(input, deps = {}) {
  const provider = deps.provider || getConfig().llm.provider;
  if (provider === 'gemini') {
    try {
      return await analyseWithGemini(input, deps);
    } catch (err) {
      log.warn('leadAnalyst.gemini_failed_using_rules', { error: err.message });
      const fallback = analyseWithRules(input);
      return fallback ? { ...fallback, needsReview: true, notes: 'AI analysis unavailable, rule-based result shown.' } : null;
    }
  }
  return analyseWithRules(input);
}

export default { analyseConversation, analyseWithRules, analyseWithGemini, toIntent };
