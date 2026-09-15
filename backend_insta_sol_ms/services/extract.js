// Deterministic enquiry extraction from a DM thread.
//
// Ported from the laptop agent's extract/enquiry.js. Regex and heuristics:
// testable, offline, free, and good enough for most Hinglish property
// enquiries. It is the `rules` analyser on its own, and the safety net under
// the LLM analyser - a phone number is only ever stored if it appears in the
// lead's own messages, whatever a model claims.

import { normalisePhone } from './normalise.js';

/** Every plausible Indian mobile number in a block of text, de-duplicated, in order. */
export function findPhones(text) {
  if (!text) return [];
  const out = [];
  // Spaces and dashes inside, so "98123 45678" is found as one number.
  const re = /(?:\+?91[\s-]?)?0?[6-9](?:[\s-]?\d){9}/g;
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
  { re: /^(cr|crore|crores|karod)$/i, mult: 1e7 },
  { re: /^(l|lac|lacs|lakh|lakhs)$/i, mult: 1e5 },
  { re: /^(k|thousand|hazaar|hazar)$/i, mult: 1e3 },
];

/**
 * A bare number with no unit. Indian property conversation has a strong
 * convention here and getting it wrong is a factor-of-100 error:
 *   "1.4 tak" -> 1.4 crore, "80 tak" -> 80 lakh, "5000000" -> rupees
 */
function inferBareUnit(n) {
  if (n < 10) return 1e7;
  if (n < 1000) return 1e5;
  return 1;
}

function toRupees(numStr, unit) {
  const n = Number.parseFloat(numStr);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = String(unit ?? '').trim();
  if (u) {
    for (const candidate of UNITS) {
      if (candidate.re.test(u)) return Math.round(n * candidate.mult);
    }
  }
  return Math.round(n * inferBareUnit(n));
}

/** Parse a budget out of free Hinglish. Returns { min, max } in rupees, or null. */
export function parseBudget(text) {
  if (!text) return null;
  const t = String(text).replace(/,/g, '');
  const unit = '(cr|crore|crores|l|lac|lacs|lakh|lakhs|k)';

  // Range first, so "80L-1Cr" is not read as just "80L".
  const range = t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}?\\s*(?:-|to|se|–|—)\\s*(\\d+(?:\\.\\d+)?)\\s*${unit}\\b`, 'i'));
  if (range) {
    // An omitted unit on the low side inherits the high side's: "80-90 lakh".
    const lo = toRupees(range[1], range[2] || range[4]);
    const hi = toRupees(range[3], range[4] || range[2]);
    if (lo && hi) return { min: Math.min(lo, hi), max: Math.max(lo, hi) };
  }

  const single = t.match(new RegExp(`(?:rs\\.?|₹|inr)?\\s*(\\d+(?:\\.\\d+)?)\\s*${unit}\\b`, 'i'));
  if (single) {
    const v = toRupees(single[1], single[2]);
    if (v) return { min: null, max: v };
  }

  // A bare number only counts next to a budget word - otherwise "2 BHK" and
  // "3rd floor" would both parse as prices.
  const bare = t.match(/(?:budget|bajat|upto|up to|max|maximum|tak|around|approx)\s*(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d+)?)\b/i);
  if (bare) {
    const v = toRupees(bare[1], '');
    if (v) return { min: null, max: v };
  }

  return null;
}

export function formatMoney(v) {
  if (v === null || v === undefined) return '';
  if (v >= 1e7) return `${+(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `${+(v / 1e5).toFixed(0)} L`;
  if (v >= 1e3) return `${+(v / 1e3).toFixed(0)}k`;
  return String(v);
}

export function describeBudget(budget) {
  if (!budget) return '';
  if (budget.min && budget.max) return `${formatMoney(budget.min)} - ${formatMoney(budget.max)}`;
  if (budget.max) return `up to ${formatMoney(budget.max)}`;
  return '';
}

// ---------------------------------------------------------------------------
// Intent, property, name, area
// ---------------------------------------------------------------------------

const INTENT_PATTERNS = [
  // Before `rent`: a heavy-deposit arrangement mentions rent too, and it is a
  // materially different product.
  { intent: 'heavy_deposit_ok', re: /\b(heavy deposit|heavy dep|deposit basis|pagdi)\b/i },
  { intent: 'rent', re: /\b(rent|rental|kiraya|kiraye|lease|tenant|11 month|paying guest|pg)\b/i },
  { intent: 'sell', re: /\b(sell|selling|bech|bechna|list my|apna flat)\b/i },
  { intent: 'buy', re: /\b(buy|buying|purchase|kharid|kharidna|lena hai|invest|booking|resale)\b/i },
];

export function detectIntent(text) {
  if (!text) return 'unknown';
  for (const p of INTENT_PATTERNS) {
    if (p.re.test(text)) return p.intent;
  }
  return 'unknown';
}

export function detectPropertyType(text) {
  if (!text) return '';
  const bhk = String(text).match(/\b(\d(?:\.5)?)\s*(?:bhk|bk)\b/i);
  if (bhk) return `${bhk[1]} BHK`;
  if (/\b(1\s*rk|studio)\b/i.test(text)) return '1 RK';
  if (/\b(shop|office|commercial)\b/i.test(text)) return 'Commercial';
  if (/\b(plot|land|bungalow|villa)\b/i.test(text)) return String(text).match(/\b(plot|land|bungalow|villa)\b/i)[1].replace(/^\w/, (c) => c.toUpperCase());
  return '';
}

export function extractName(text) {
  if (!text) return null;
  // The lead-in is case-insensitive, the name capture is not: capitalisation is
  // the only signal separating "Priya" from the Hindi word after it.
  const lead = String(text).match(/(?:my name is|name is|myself|this is|mera naam)\s+/i);
  if (!lead) return null;
  const rest = String(text).slice(lead.index + lead[0].length);
  const m = rest.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  return m ? m[1].trim() : null;
}

/** "rakesh.properties_22" -> "Rakesh Properties". A poor name, but better than an empty row. */
export function nameFromUsername(username) {
  if (!username) return null;
  const cleaned = String(username)
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, '')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return cleaned || null;
}

export function extractArea(text, knownAreas = []) {
  if (!text) return null;
  const t = String(text);
  for (const area of knownAreas) {
    if (area && new RegExp(`\\b${String(area).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t)) {
      return area;
    }
  }
  const m = t.match(/\b(?:in|at|near|around|looking in)\s+([A-Z][A-Za-z]+(?:\s+(?:East|West|North|South))?)/);
  return m ? m[1].trim() : null;
}

const SITE_VISIT_RE = /\b(site visit|visit|dekhna|dekhne|dikha|showing|viewing)\b/i;
const CALL_ME_RE = /\b(call me|call karo|call kar|phone karo|ring me|contact me)\b/i;
const SPAM_RE = /\b(job|vacancy|hiring|internship|followers|promotion|collab|crypto|loan agent|seo|marketing services)\b/i;

/** Obvious timepass, so it never reaches the owner's enquiry list. */
export function looksLikeSpam(text) {
  return Boolean(text) && SPAM_RE.test(String(text)) && !/\b(flat|property|bhk|rent|buy)\b/i.test(String(text));
}

/**
 * Score 0-100, weighted by what predicts a deal for a broker: a phone number
 * first, then a stated budget, then engagement depth.
 */
export function scoreLead({ phone = null, budget = null, intent = 'unknown', area = null, messageCount = 0, askedSiteVisit = false } = {}) {
  let score = 0;
  if (phone) score += 40;
  if (budget?.max) score += 25;
  if (intent !== 'unknown') score += 12;
  if (area) score += 10;
  if (askedSiteVisit) score += 10;
  score += Math.min(8, Math.max(0, messageCount - 1) * 2);
  return Math.min(100, score);
}

/** The analyst's three-level score, from the numeric one. */
export function scoreToLeadScore(score, { phone = null, requirementSignals = 0 } = {}) {
  if (phone && requirementSignals >= 1) return 'very_hot';
  if (score >= 40) return 'hot';
  return 'cold';
}

export const INTENT_TO_LEAD_TYPE = {
  buy: 'buyer',
  rent: 'tenant',
  heavy_deposit_ok: 'tenant',
  sell: 'seller',
};

export { SITE_VISIT_RE, CALL_ME_RE };

export default {
  findPhones,
  parseBudget,
  describeBudget,
  formatMoney,
  detectIntent,
  detectPropertyType,
  extractName,
  nameFromUsername,
  extractArea,
  looksLikeSpam,
  scoreLead,
  scoreToLeadScore,
  INTENT_TO_LEAD_TYPE,
};
