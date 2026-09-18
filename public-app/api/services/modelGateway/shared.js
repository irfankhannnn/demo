/**
 * What both model adapters have in common: the prompts, the strict-JSON
 * extraction, and the normalisation that turns whatever the model returned
 * into the exact `intent` shape the rest of the service relies on.
 *
 * ── why the prompts live here and not in each adapter ──────────────────────
 * Switching MODEL_PROVIDER must change the wire call and nothing else. If
 * each adapter carried its own prompt, the two would drift and "Bedrock
 * understands '1.2 cr' but Gemini doesn't" would become a real bug class.
 *
 * ── Hinglish ───────────────────────────────────────────────────────────────
 * Buyers type the way they speak: "2 bhk andheri under 80 lakh", "ghar
 * chahiye kiraye pe 25k", "furnished flat near metro". The prompt spells
 * out the vocabulary and the unit conversions so the model never has to
 * guess what a lakh is, and the normaliser below re-checks the numbers
 * anyway — a model that answers "80 lakh" as 80 gets corrected, not trusted.
 */

export const PROPERTY_TYPES = ['apartment', 'villa', 'house', 'plot', 'office', 'shop', 'penthouse', 'studio'];
export const FURNISHING = ['furnished', 'semi-furnished', 'unfurnished'];

export function intentSystemPrompt() {
  return [
    'You turn an Indian home-buyer\'s search into a JSON filter. The buyer may write in English, Hindi (romanised) or a mix (Hinglish).',
    '',
    'Vocabulary: "ghar", "makaan", "flat", "home" = a home (propertyType null unless a type word appears); "flat"/"apartment" = apartment; "villa"/"bungalow"/"kothi" = villa; "independent house"/"row house" = house; "plot"/"zameen" = plot; "office"/"shop"/"dukaan" = office/shop.',
    'Mode: "rent", "rental", "kiraye", "kiraya", "kiraye pe", "lease", "pg" = rent. "buy", "kharidna", "kharidne", "purchase", "sale", "resale", "invest" = sale. If no mode word appears, use "sale" unless the budget is clearly a monthly rent (under 5 lakh total).',
    'Money: convert everything to whole rupees. 1 lakh/lac/l = 100000. 1 crore/cr = 10000000. 1k = 1000. "80 lakh" = 8000000, "1.2 cr" = 12000000, "50k" = 50000. "under"/"upto"/"below"/"max"/"tak"/"se kam" = maxPrice. "above"/"min"/"se zyada" = minPrice. "between X and Y" / "X se Y" = both.',
    'BHK: "2 bhk", "2bhk", "2 bedroom", "do bhk" = bhk 2. "1 rk"/"studio" = bhk 0 (propertyType studio).',
    'Furnishing: "furnished"/"fully furnished" = furnished; "semi furnished"/"semi" = semi-furnished; "unfurnished"/"bare shell" = unfurnished.',
    'City: match against the provided list of marketplace cities (by name or common alias — Bombay=Mumbai, Bangalore=Bengaluru, Gurgaon=Gurugram, Madras=Chennai). If the query names a locality (Andheri, Whitefield, Wakad, Powai) and a default city is given, keep that city. If no city can be determined and no default is given, set cityKey and city to null.',
    'Locality: the neighbourhood/area if mentioned (not the city). mustHaves: short lowercase phrases for hard requirements (e.g. "parking", "gym", "pet friendly", "near metro", "sea view", "east facing").',
    'canonicalQuery: one clean English sentence describing the request, e.g. "2 BHK apartment in Andheri West, Mumbai, for sale, under 80 lakh".',
    '',
    'Return ONLY a JSON object, no prose, no markdown fences, with exactly these keys:',
    '{"cityKey": string|null, "city": string|null, "mode": "sale"|"rent"|null, "propertyType": string|null, "bhk": integer|null, "minPrice": integer|null, "maxPrice": integer|null, "locality": string|null, "furnishing": string|null, "mustHaves": string[], "canonicalQuery": string}',
  ].join('\n');
}

export function intentUserPrompt({ query, city, cities }) {
  const list = (cities || []).map((c) => `${c.name} (cityKey: ${c.cityKey})`).join('; ') || 'none';
  return [
    `Marketplace cities: ${list}`,
    `Default city: ${city || 'none'}`,
    `Buyer query: ${JSON.stringify(String(query || '').slice(0, 500))}`,
  ].join('\n');
}

export function explainSystemPrompt() {
  return [
    'You are a friendly Indian property advisor. You are given a buyer\'s query, the structured intent parsed from it, and a short list of listings that matched.',
    'For each listing write ONE short sentence (max 25 words) saying why it fits the buyer, in the same language mix the buyer used (English or Hinglish). Mention the concrete match: price vs budget, BHK, locality, furnishing, amenities. Never invent facts that are not in the listing.',
    'Then write exactly two follow-up questions the buyer could ask next to narrow the search (e.g. "Sirf ready-to-move dikhao?", "Show me only ones with parking?").',
    'Then one assistantMessage: a single warm sentence summarising what was found (e.g. "Andheri West mein aapke budget ke andar 6 flats mile — yeh top picks hain.").',
    '',
    'Return ONLY a JSON object, no prose, no markdown fences, with exactly these keys:',
    '{"why": {"<propertyId>": "<sentence>", ...}, "followUps": [string, string], "assistantMessage": string}',
  ].join('\n');
}

/** Only the fields the model needs; never the agency card, never coordinates. */
export function listingForPrompt(l) {
  return {
    propertyId: l.propertyId,
    title: l.title,
    propertyType: l.propertyType,
    bhk: l.bhk,
    furnishing: l.furnishing,
    facing: l.facing,
    carpetArea: l.carpetArea,
    locality: l.locality,
    city: l.city,
    mode: l.pricing?.mode,
    price: l.pricing?.amount,
    amenities: Array.isArray(l.amenities) ? l.amenities.slice(0, 10) : [],
    matchScore: l.matchScore,
  };
}

export function explainUserPrompt({ query, intent, listings }) {
  return [
    `Buyer query: ${JSON.stringify(String(query || '').slice(0, 500))}`,
    `Parsed intent: ${JSON.stringify(intent)}`,
    `Listings: ${JSON.stringify((listings || []).slice(0, 8).map(listingForPrompt))}`,
  ].join('\n');
}

/**
 * Pull a JSON object out of a model reply.
 *
 * Even with JSON mode requested, models occasionally wrap the object in
 * ```json fences or add a leading sentence. Take the first balanced object
 * rather than failing; a genuinely unparseable reply throws and the caller
 * falls back to the heuristic.
 */
export function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('empty model response');
  const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('no JSON object in model response');
    return JSON.parse(unfenced.slice(start, end + 1));
  }
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * A price under 1000 is not rupees — the model echoed "80" for "80 lakh".
 * Anything that small is treated as lakh, which is the only unit a buyer
 * would ever omit. Rents below 1000/month do not exist either.
 */
function rupees(v) {
  const n = num(v);
  if (n === null || n <= 0) return null;
  if (n < 1000) return Math.round(n * 100000);
  return Math.round(n);
}

const str = (v, max = 80) => {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  return s || null;
};

/** Force the model's answer into the exact intent shape; unknowns become null. */
export function normaliseIntent(raw, { query = '' } = {}) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const bhk = num(o.bhk);
  let mode = typeof o.mode === 'string' ? o.mode.toLowerCase() : null;
  if (!['sale', 'rent'].includes(mode)) mode = null;
  let propertyType = str(o.propertyType, 40)?.toLowerCase() || null;
  if (propertyType && !PROPERTY_TYPES.includes(propertyType)) {
    // Keep unknown-but-plausible words (the CRM filters by string), drop noise.
    propertyType = /^[a-z-]{3,30}$/.test(propertyType) ? propertyType : null;
  }
  let furnishing = str(o.furnishing, 40)?.toLowerCase().replace(/\s+/g, '-') || null;
  if (furnishing && !FURNISHING.includes(furnishing)) furnishing = null;

  let minPrice = rupees(o.minPrice);
  let maxPrice = rupees(o.maxPrice);
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];

  return {
    cityKey: str(o.cityKey, 60),
    city: str(o.city, 80),
    mode,
    propertyType,
    bhk: bhk === null ? null : Math.max(0, Math.min(20, Math.round(bhk))),
    minPrice,
    maxPrice,
    locality: str(o.locality, 80),
    furnishing,
    mustHaves: Array.isArray(o.mustHaves)
      ? o.mustHaves.filter((m) => typeof m === 'string').map((m) => m.trim().toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 8)
      : [],
    canonicalQuery: str(o.canonicalQuery, 300) || String(query || '').trim().slice(0, 300),
  };
}

/** Force the explain answer into shape; a missing `why` for a listing stays absent (→ null downstream). */
export function normaliseExplanation(raw, listings = []) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const ids = new Set((listings || []).map((l) => l.propertyId));
  const why = {};
  if (o.why && typeof o.why === 'object') {
    for (const [id, text] of Object.entries(o.why)) {
      if (ids.has(id) && typeof text === 'string' && text.trim()) why[id] = text.trim().slice(0, 240);
    }
  }
  const followUps = Array.isArray(o.followUps)
    ? o.followUps.filter((f) => typeof f === 'string' && f.trim()).map((f) => f.trim().slice(0, 120)).slice(0, 2)
    : [];
  return {
    why,
    followUps,
    assistantMessage: typeof o.assistantMessage === 'string' ? o.assistantMessage.trim().slice(0, 300) : '',
  };
}

/** Reject a promise that takes longer than `ms`; the model call itself is aborted by the adapter. */
export function withTimeout(promise, ms, label = 'model') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
