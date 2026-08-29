/**
 * A8 - Enquiry extractor.
 *
 * Pulls name, phone, intent, budget, area and source reel out of a DM thread.
 * Deterministic regex and heuristics first: they are testable, run offline, cost
 * nothing, and handle the overwhelming majority of Hinglish property enquiries.
 * An LLM refinement pass is optional and only fills fields the rules missed - it
 * never overrides a confidently parsed phone number or budget.
 */
import { upsertEnquiry, listMessages, getConversation, audit } from '../store/repos.js';
import { now } from '../util/time.js';
import { logger } from '../util/logger.js';

const log = logger('extract/enquiry');

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

/**
 * Normalise an Indian mobile number to E.164 (+91XXXXXXXXXX).
 *
 * Handles the shapes people actually type: "98123 45678", "+91-9812345678",
 * "0 9812345678", "919812345678". Returns null for anything that is not a
 * plausible Indian mobile, because a wrong number in the CRM is worse than none.
 */
export function normalisePhone(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d]/g, '');

  if (d.length > 10 && d.startsWith('91')) d = d.slice(2);   // country code
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1); // STD trunk prefix

  if (d.length !== 10) return null;
  // Indian mobile numbers start 6-9. This is what rejects prices, pincodes,
  // years and flat numbers that happen to be ten digits long.
  if (!/^[6-9]/.test(d)) return null;
  return `+91${d}`;
}

/** Every plausible phone number in a block of text, de-duplicated, in order. */
export function findPhones(text) {
  if (!text) return [];
  const out = [];
  // Allow spaces and dashes inside, so "98123 45678" is found as one number.
  const re = /(?:\+?91[\s-]?)?[6-9](?:[\s-]?\d){9}/g;
  for (const m of String(text).matchAll(re)) {
    const n = normalisePhone(m[0]);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

const UNITS = [
  { re: /\b(cr|crore|crores|karod|कर(ो|ौ)ड़?)\b/i, mult: 1e7 },
  { re: /\b(l|lac|lacs|lakh|lakhs|लाख)\b/i, mult: 1e5 },
  { re: /\b(k|thousand|hazaar|hazar)\b/i, mult: 1e3 },
];

/**
 * A bare number with no unit. Indian property conversation has a strong
 * convention here and getting it wrong is a factor-of-100 error:
 *   "1.4 tak"  -> 1.4 crore   (small numbers, usually with a decimal)
 *   "80 tak"   -> 80 lakh
 *   "5000000"  -> already rupees
 */
function inferBareUnit(n) {
  if (n < 10) return 1e7;        // crore
  if (n < 1000) return 1e5;      // lakh
  return 1;                      // already an absolute rupee figure
}

function toRupees(numStr, tail) {
  const n = parseFloat(numStr);
  if (!Number.isFinite(n)) return null;
  for (const u of UNITS) {
    if (u.re.test(tail)) return Math.round(n * u.mult);
  }
  return Math.round(n * inferBareUnit(n));
}

/**
 * Parse a budget out of free Hinglish. Returns { min, max, bracket } in rupees,
 * or null. A range ("80L-1Cr") gives both bounds; a single figure with an
 * upper-bound word ("1.4 tak", "50 lakh max") sets max only.
 */
export function parseBudget(text) {
  if (!text) return null;
  const t = String(text);

  // Range first, so "80L-1Cr" is not read as just "80L".
  const range = t.match(
    /(\d+(?:\.\d+)?)\s*(cr|crore|crores|l|lac|lacs|lakh|lakhs|k)?\s*(?:-|to|se|–|—)\s*(\d+(?:\.\d+)?)\s*(cr|crore|crores|l|lac|lacs|lakh|lakhs|k)?/i,
  );
  if (range) {
    // An omitted unit on the low side inherits the high side's unit: in "80-90
    // lakh" the 80 is obviously also lakh.
    const lo = toRupees(range[1], range[2] || range[4] || '');
    const hi = toRupees(range[3], range[4] || range[2] || '');
    if (lo && hi) return { min: Math.min(lo, hi), max: Math.max(lo, hi), bracket: formatBracket(lo, hi) };
  }

  const single = t.match(
    /(?:budget|bajat|around|approx|upto|up to|max|maximum|tak|ke|se)?\s*(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d+)?)\s*(cr|crore|crores|l|lac|lacs|lakh|lakhs|k)\b/i,
  );
  if (single) {
    const v = toRupees(single[1], single[2]);
    if (v) return { min: null, max: v, bracket: formatBracket(null, v) };
  }

  // Bare number, but only when a budget word is nearby - otherwise "2 BHK" and
  // "3rd floor" would both parse as prices.
  const bare = t.match(
    /(?:budget|bajat|upto|up to|max|maximum|tak|around|approx)\s*(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d+)?)\b/i,
  );
  if (bare) {
    const v = toRupees(bare[1], '');
    if (v) return { min: null, max: v, bracket: formatBracket(null, v) };
  }

  return null;
}

export function formatMoney(v) {
  if (v == null) return '';
  if (v >= 1e7) return `${+(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${+(v / 1e5).toFixed(0)}L`;
  return String(v);
}

export function formatBracket(min, max) {
  if (min && max) return `${formatMoney(min)}-${formatMoney(max)}`;
  if (max) return `<${formatMoney(max)}`;
  if (min) return `${formatMoney(min)}+`;
  return '';
}

// ---------------------------------------------------------------------------
// Intent
// ---------------------------------------------------------------------------

const INTENT_PATTERNS = [
  // Checked before `rent`: a heavy-deposit arrangement mentions rent too, and
  // it is a materially different product.
  { intent: 'heavy_deposit_ok', re: /\b(heavy deposit|heavy dep|deposit basis|pagdi)\b/i },
  { intent: 'rent', re: /\b(rent|rental|kiraya|kiraye|lease|tenant|11 month|paying guest|\bpg\b)\b/i },
  { intent: 'sell', re: /\b(sell|selling|bech|bechna|list my|apna flat)\b/i },
  { intent: 'buy', re: /\b(buy|buying|purchase|kharid|kharidna|lena hai|invest|booking)\b/i },
];

export function detectIntent(text) {
  if (!text) return 'unknown';
  for (const p of INTENT_PATTERNS) {
    if (p.re.test(text)) return p.intent;
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Name and area
// ---------------------------------------------------------------------------

export function extractName(text, fallbackUsername = null) {
  if (text) {
    // The lead-in is matched case-insensitively, but the NAME capture is NOT.
    // With /i on the whole pattern, [A-Z] also matches lowercase, so
    // "mera naam Priya hai" captured "Priya hai" - the trailing Hindi word
    // looked like a surname. Capitalisation is the only signal separating a
    // name from the rest of the sentence, so it has to stay case-sensitive.
    const lead = String(text).match(/(?:my name is|name is|myself|this is|mera naam)\s+/i);
    if (lead) {
      const rest = String(text).slice(lead.index + lead[0].length);
      const m = rest.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
      if (m) return m[1].trim();
    }
  }
  if (!fallbackUsername) return null;
  // "rakesh.properties" -> "Rakesh Properties". A handle is a poor name but
  // better than an empty row, and the owner can correct it.
  return String(fallbackUsername)
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, '')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || null;
}

/** Match against the tenant's own area list when available - free text otherwise. */
export function extractArea(text, knownAreas = []) {
  if (!text) return null;
  const t = String(text);
  for (const area of knownAreas) {
    if (area && new RegExp(`\\b${String(area).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t)) {
      return area;
    }
  }
  const m = t.match(/\b(?:in|at|near|around|chahiye|dhundh raha|looking in)\s+([A-Z][A-Za-z]+(?:\s+(?:East|West|North|South))?)/);
  return m ? m[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Temperature (F10)
// ---------------------------------------------------------------------------

/**
 * Score 0-100. Weighted by what actually predicts a deal for a broker: a phone
 * number is the single strongest signal, then a stated budget, then engagement
 * depth. Thresholds are deliberately conservative - calling something "hot"
 * that is not wastes the owner's most expensive resource, their time.
 */
export function scoreTemperature({
  phone = null, budget = null, intent = 'unknown', area = null,
  messageCount = 0, askedSiteVisit = false,
} = {}) {
  let score = 0;
  if (phone) score += 40;
  if (budget?.max) score += 25;
  if (intent !== 'unknown') score += 12;
  if (area) score += 10;
  if (askedSiteVisit) score += 10;
  score += Math.min(8, Math.max(0, messageCount - 1) * 2);

  const temperature = score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold';
  return { score: Math.min(100, score), temperature };
}

const SITE_VISIT_RE = /\b(site visit|visit|dekhna|dekhne|dikha|showing|viewing)\b/i;

const SPAM_RE = /\b(job|vacancy|hiring|internship|followers|promotion|collab|crypto|loan agent|seo|marketing services)\b/i;

/** F15 - obvious timepass, so it never reaches the owner's enquiry list. */
export function looksLikeSpam(text) {
  return Boolean(text) && SPAM_RE.test(String(text)) && !/\b(flat|property|bhk|rent|buy)\b/i.test(String(text));
}

// ---------------------------------------------------------------------------
// Extraction over a thread
// ---------------------------------------------------------------------------

/**
 * Extract an enquiry from one conversation. Returns the stored row, or null
 * when there is not enough signal to be worth showing the owner.
 *
 * Only inbound messages are considered: our own replies mention prices and
 * areas constantly, and treating those as the customer's requirements is how a
 * naive extractor invents enquiries out of its own words.
 */
export function extractFromConversation(ctx, conversationId, { knownAreas = [], minScore = 20 } = {}) {
  const conversation = getConversation(conversationId, ctx.db);
  if (!conversation) return null;

  const messages = listMessages(conversationId, 200, ctx.db);
  const inbound = messages.filter((m) => m.direction === 'in');
  if (inbound.length === 0) return null;

  const text = inbound.map((m) => m.text ?? '').join('\n');
  if (looksLikeSpam(text)) {
    audit({ scope: 'extract', action: 'skip_spam', targetId: conversationId, outcome: 'skipped' }, ctx.db);
    return null;
  }

  const phone = findPhones(text)[0] ?? null;
  const budget = parseBudget(text);
  const intent = detectIntent(text);
  const area = extractArea(text, knownAreas);
  const name = extractName(text, conversation.participant_username);
  const askedSiteVisit = SITE_VISIT_RE.test(text);

  const { score, temperature } = scoreTemperature({
    phone, budget, intent, area, messageCount: inbound.length, askedSiteVisit,
  });

  if (score < minScore) return null;

  const enquiryId = `enq_${conversationId}`;
  const row = upsertEnquiry({
    enquiryId,
    igUserId: conversation.ig_user_id,
    conversationId,
    igSenderId: conversation.participant_id,
    igUsername: conversation.participant_username,
    name,
    phone,
    phoneRaw: phone ? null : (text.match(/\d[\d\s-]{7,}/)?.[0] ?? null),
    intent,
    budgetMin: budget?.min ?? null,
    budgetMax: budget?.max ?? null,
    budgetBracket: budget?.bracket ?? null,
    preferredArea: area,
    temperature,
    score,
    sourceMediaId: conversation.source_media_id ?? null,
    extracted: { askedSiteVisit, messageCount: inbound.length },
    extractor: 'deterministic',
    confidence: score / 100,
  }, ctx.db);

  audit({
    scope: 'extract', action: 'enquiry', targetId: enquiryId, outcome: 'ok',
    detail: `${temperature} (${score}) intent=${intent}${phone ? ' phone' : ''}`,
  }, ctx.db);

  log.info('enquiry extracted', { enquiryId, temperature, score, intent, hasPhone: Boolean(phone) });
  return row;
}

/** Run the extractor across every conversation with recent inbound activity. */
export function extractAll(ctx, { knownAreas = [], sinceMs = 30 * 24 * 3600 * 1000 } = {}) {
  const cutoff = now() - sinceMs;
  const rows = ctx.db
    .prepare('SELECT conversation_id FROM conversations WHERE last_inbound_at IS NOT NULL AND last_inbound_at >= ?')
    .all(cutoff);

  const out = [];
  for (const r of rows) {
    const e = extractFromConversation(ctx, r.conversation_id, { knownAreas });
    if (e) out.push(e);
  }
  return { scanned: rows.length, extracted: out.length, enquiries: out };
}

export default {
  normalisePhone, findPhones, parseBudget, formatBracket, formatMoney,
  detectIntent, extractName, extractArea, scoreTemperature, looksLikeSpam,
  extractFromConversation, extractAll,
};
