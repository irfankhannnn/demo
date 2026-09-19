/**
 * POST /search/ai, end to end: understand the query → search the CRM →
 * explain the results.
 *
 * ── the model is optional at every step ────────────────────────────────────
 * A buyer typing "2 bhk andheri under 80 lakh" must get flats whether or not
 * Gemini answers in time. So each model call is wrapped, and each has a
 * non-model substitute:
 *
 *   parseIntent fails  → heuristicIntent(): a deterministic regex parser
 *                        that understands the same Hinglish vocabulary and
 *                        the lakh/crore/k units. The CRM search still runs,
 *                        with the raw query as the embedding text.
 *   explain fails      → every result gets `why: null`, follow-ups and the
 *                        assistant message come from templates.
 *   CRM search fails   → the filtered /listings read is tried (no vectors,
 *                        but still real inventory) before giving up.
 *
 * The heuristic is not a toy: it is tested on its own (tests/aiSearch.test.js)
 * because it is what the buyer sees during every model outage, and because
 * its parsing of money is the part a model gets wrong most often.
 *
 * ── dependency injection ───────────────────────────────────────────────────
 * `createAiSearch({ crm, gateway })` exists so the flow can be tested with a
 * scripted CRM and a gateway that throws, without touching the network. The
 * default export is wired to the real modules.
 */

import * as realCrm from './crmClient.js';
import * as realGateway from './modelGateway/index.js';
import { CrmUnavailableError } from './crmClient.js';
import { logger } from '../logger.js';

// ── vocabulary ─────────────────────────────────────────────────────────────

const RENT_WORDS = ['rent', 'rental', 'rented', 'renting', 'kiraye', 'kiraya', 'kiray', 'lease', 'pg', 'tenant', 'bhade'];
const SALE_WORDS = ['buy', 'buying', 'kharidna', 'kharidne', 'kharid', 'purchase', 'sale', 'resale', 'invest', 'investment', 'own', 'ownership'];

const TYPE_WORDS = [
  [['apartment', 'apartments', 'flat', 'flats'], 'apartment'],
  [['villa', 'villas', 'bungalow', 'bunglow', 'kothi'], 'villa'],
  [['penthouse'], 'penthouse'],
  [['studio', 'rk', '1rk'], 'studio'],
  [['plot', 'plots', 'zameen', 'land'], 'plot'],
  [['office', 'offices', 'commercial'], 'office'],
  [['shop', 'shops', 'dukaan', 'showroom'], 'shop'],
  [['house', 'houses', 'row-house', 'rowhouse', 'independent'], 'house'],
];

const MUST_HAVES = [
  ['parking', ['parking', 'car park', 'covered parking']],
  ['gym', ['gym', 'gymnasium']],
  ['swimming pool', ['pool', 'swimming']],
  ['lift', ['lift', 'elevator']],
  ['balcony', ['balcony']],
  ['garden', ['garden', 'lawn']],
  ['pet friendly', ['pet', 'pets', 'pet friendly', 'pet-friendly', 'dog']],
  ['near metro', ['metro', 'near metro', 'metro station']],
  ['sea view', ['sea view', 'sea facing', 'seaview']],
  ['ready to move', ['ready to move', 'ready-to-move', 'ready possession', 'immediate']],
  ['east facing', ['east facing', 'east-facing']],
  ['vastu', ['vastu']],
  ['power backup', ['power backup', 'backup']],
  ['security', ['security', 'gated']],
  ['furnished', ['furnished']],
];

const CITY_ALIASES = {
  bombay: 'mumbai', bangalore: 'bengaluru', gurgaon: 'gurugram', madras: 'chennai',
  calcutta: 'kolkata', poona: 'pune', 'new delhi': 'delhi', trivandrum: 'thiruvananthapuram',
  cochin: 'kochi', baroda: 'vadodara', 'navi-mumbai': 'navi mumbai',
};

/**
 * Well-known localities → their city, for queries that name only the
 * neighbourhood ("2bhk in andheri"). Only consulted by the heuristic parser
 * and only honoured when that city is live on the marketplace. It is a hint
 * list, not inventory: a locality missing here still works once the buyer
 * names the city, or through the all-cities search in run().
 */
const LOCALITY_CITY = {
  mumbai: ['andheri', 'kurla', 'bandra', 'powai', 'borivali', 'malad', 'goregaon', 'kandivali', 'juhu', 'santacruz',
    'vile parle', 'dadar', 'worli', 'lower parel', 'chembur', 'ghatkopar', 'mulund', 'vikhroli', 'bhandup', 'colaba',
    'versova', 'jogeshwari', 'dahisar', 'sion', 'wadala', 'bkc', 'khar', 'mahim', 'byculla'],
  'navi mumbai': ['vashi', 'kharghar', 'nerul', 'belapur', 'panvel', 'airoli', 'ghansoli', 'seawoods', 'ulwe'],
  thane: ['ghodbunder', 'majiwada', 'kolshet', 'manpada', 'hiranandani estate'],
  pune: ['wakad', 'hinjewadi', 'baner', 'kothrud', 'viman nagar', 'kharadi', 'hadapsar', 'aundh', 'pimple saudagar',
    'magarpatta', 'koregaon park', 'wagholi', 'balewadi', 'pimpri', 'chinchwad'],
  bengaluru: ['whitefield', 'koramangala', 'indiranagar', 'hsr layout', 'hsr', 'marathahalli', 'electronic city',
    'jayanagar', 'jp nagar', 'hebbal', 'yelahanka', 'bellandur', 'sarjapur', 'btm layout', 'btm', 'malleshwaram'],
  hyderabad: ['gachibowli', 'kondapur', 'madhapur', 'hitech city', 'hitec city', 'banjara hills', 'jubilee hills',
    'kukatpally', 'miyapur', 'manikonda', 'begumpet', 'kompally', 'nallagandla'],
  chennai: ['adyar', 'velachery', 'anna nagar', 'omr', 'porur', 'tambaram', 't nagar', 'sholinganallur', 'besant nagar'],
  delhi: ['dwarka', 'rohini', 'saket', 'vasant kunj', 'greater kailash', 'lajpat nagar', 'janakpuri', 'pitampura'],
  gurugram: ['dlf phase', 'sohna road', 'golf course road', 'sushant lok', 'cyber city'],
  noida: ['greater noida', 'noida extension', 'sector 62', 'sector 137', 'sector 150'],
  kolkata: ['salt lake', 'new town', 'rajarhat', 'ballygunge', 'behala', 'garia'],
  ahmedabad: ['satellite', 'bopal', 'prahlad nagar', 'sg highway', 'thaltej', 'gota', 'maninagar'],
};

/** The marketplace city a locality in the text belongs to, or null. */
function cityFromLocality(text, cities = []) {
  for (const [cityName, localities] of Object.entries(LOCALITY_CITY)) {
    if (localities.some((l) => new RegExp(`(^|\\s)${l}(\\s|$)`).test(text))) {
      return resolveCity(cityName, cities);
    }
  }
  return null;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'in', 'at', 'near', 'for', 'with', 'and', 'or', 'of', 'to', 'me', 'my', 'i', 'want', 'need',
  'looking', 'chahiye', 'chahiye.', 'hai', 'ho', 'mein', 'main', 'ke', 'ki', 'ka', 'pe', 'par', 'se', 'ek', 'koi',
  'ghar', 'makaan', 'makan', 'home', 'homes', 'property', 'properties', 'place', 'accommodation', 'room', 'rooms',
  'under', 'upto', 'up', 'below', 'max', 'maximum', 'within', 'less', 'than', 'tak', 'kam', 'above', 'over', 'min',
  'minimum', 'more', 'zyada', 'between', 'budget', 'price', 'around', 'approx', 'about', 'please', 'pls', 'plz',
  'show', 'find', 'dikhao', 'dhundo', 'dhoondo', 'batao', 'good', 'nice', 'best', 'new', 'cheap', 'affordable',
  'bhk', 'bedroom', 'bedrooms', 'bed', 'beds', 'sqft', 'sq', 'ft', 'lakh', 'lakhs', 'lac', 'lacs', 'crore', 'crores',
  'cr', 'k', 'l', 'rs', 'rs.', 'inr', 'rupees', 'per', 'month', 'monthly', 'pm', 'p.m.', 'is', 'are', 'it', 'on',
  'semi', 'fully', 'full', 'un', 'furnished', 'unfurnished', 'semi-furnished', 'area', 'side', 'wala', 'wali', 'vala',
  ...RENT_WORDS, ...SALE_WORDS,
]);

const HINDI_NUMBERS = { ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, one: 1, two: 2, three: 3, four: 4, five: 5 };

const UNIT_RUPEES = {
  cr: 1e7, crore: 1e7, crores: 1e7,
  lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, l: 1e5,
  k: 1e3, thousand: 1e3, hazaar: 1e3, hazar: 1e3,
};

const MAX_QUALIFIERS = /\b(under|upto|up to|below|max|maximum|within|less than|not more than|tak|se kam|budget|around|approx|about)\b/;
const MIN_QUALIFIERS = /\b(above|over|min|minimum|more than|at least|starting|se zyada|se upar)\b/;

function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/₹/g, ' rs ')
    .replace(/[^\w\s.\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function keyOf(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Match a city name/alias/cityKey against the marketplace's live city list.
 * Returns `{ name, cityKey }` or null. Exported for the route and the tests.
 */
export function resolveCity(name, cities = []) {
  const wanted = keyOf(name);
  if (!wanted) return null;
  const canonical = CITY_ALIASES[wanted] || wanted;
  for (const c of cities || []) {
    const cName = keyOf(c.name);
    const cKey = keyOf(c.cityKey);
    if (cName === wanted || cName === canonical || cKey === wanted || cKey === canonical || cKey === wanted.replace(/ /g, '')) {
      return { name: c.name, cityKey: c.cityKey };
    }
  }
  return null;
}

/** Find which marketplace city, if any, the query text names. */
function cityInText(text, cities = []) {
  const candidates = [];
  for (const c of cities || []) {
    candidates.push([keyOf(c.name), c]);
    for (const [alias, canon] of Object.entries(CITY_ALIASES)) {
      if (canon === keyOf(c.name)) candidates.push([alias, c]);
    }
  }
  // Longest first so "navi mumbai" beats "mumbai".
  candidates.sort((a, b) => b[0].length - a[0].length);
  for (const [needle, c] of candidates) {
    if (needle && new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(text)) {
      return { city: { name: c.name, cityKey: c.cityKey }, matched: needle };
    }
  }
  return null;
}

/** Parse every money mention: "80 lakh", "1.2 cr", "50k", "25,000", "80-90 lakh". */
function parseMoney(text) {
  const found = [];
  const unitRe = '(cr|crores?|lakhs?|lacs?|l|k|thousand|hazaa?r)';
  const rangeRe = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:-|to|se)\\s*(\\d+(?:\\.\\d+)?)\\s*${unitRe}\\b`, 'g');
  const singleRe = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unitRe}\\b`, 'g');
  const consumed = [];

  let m;
  while ((m = rangeRe.exec(text)) !== null) {
    const mult = UNIT_RUPEES[m[3]] || 1;
    found.push({ min: Math.round(Number(m[1]) * mult), max: Math.round(Number(m[2]) * mult), index: m.index, range: true });
    consumed.push([m.index, m.index + m[0].length]);
  }
  const inConsumed = (i) => consumed.some(([s, e]) => i >= s && i < e);
  while ((m = singleRe.exec(text)) !== null) {
    if (inConsumed(m.index)) continue;
    const mult = UNIT_RUPEES[m[2]] || 1;
    found.push({ amount: Math.round(Number(m[1]) * mult), index: m.index, range: false });
    consumed.push([m.index, m.index + m[0].length]);
  }
  // Bare large numbers ("2500000", "25000 rent") are rupees already.
  const bareRe = /(?<![\d.])(\d{4,9})(?![\d.]|\s*(?:sq|sqft|bhk))/g;
  while ((m = bareRe.exec(text)) !== null) {
    if (inConsumed(m.index)) continue;
    found.push({ amount: Number(m[1]), index: m.index, range: false });
  }
  return found.sort((a, b) => a.index - b.index);
}

function qualifierBefore(text, index) {
  const before = text.slice(Math.max(0, index - 24), index);
  if (MIN_QUALIFIERS.test(before)) return 'min';
  if (MAX_QUALIFIERS.test(before)) return 'max';
  return null;
}

/**
 * Deterministic intent parser. Runs whenever the model is unavailable, and
 * is what the tests exercise. Same output shape as the model path.
 */
export function heuristicIntent({ query, city = null, cities = [] }) {
  const text = normalise(query);
  const intent = {
    cityKey: null, city: null, mode: null, propertyType: null, bhk: null,
    minPrice: null, maxPrice: null, locality: null, furnishing: null,
    mustHaves: [], canonicalQuery: String(query || '').trim().slice(0, 300),
  };

  // ── money ──
  const money = parseMoney(text);
  const between = /\bbetween\b/.test(text);
  if (money.length) {
    const first = money[0];
    if (first.range) {
      intent.minPrice = first.min;
      intent.maxPrice = first.max;
    } else if (money.length >= 2 && (between || !qualifierBefore(text, money[1].index))) {
      intent.minPrice = Math.min(money[0].amount, money[1].amount);
      intent.maxPrice = Math.max(money[0].amount, money[1].amount);
    } else {
      for (const item of money) {
        const q = qualifierBefore(text, item.index);
        if (q === 'min') intent.minPrice = item.amount;
        else intent.maxPrice = item.amount; // a lone budget is a ceiling
      }
    }
  }

  // ── mode ──
  const words = text.split(' ');
  const has = (list) => words.some((w) => list.includes(w));
  if (has(RENT_WORDS) || /\bkiraye\b|\bon rent\b|\bfor rent\b/.test(text)) intent.mode = 'rent';
  else if (has(SALE_WORDS) || /\bfor sale\b/.test(text)) intent.mode = 'sale';
  else {
    // No mode word: only a budget says anything. Without one the mode stays
    // null and the search covers both — guessing "sale" hid every rental.
    const budget = intent.maxPrice ?? intent.minPrice;
    if (budget !== null) intent.mode = budget < 500000 ? 'rent' : 'sale';
  }

  // ── bhk ──
  const bhkMatch = text.match(/(\d+(?:\.\d+)?)\s*-?\s*(?:bhk|bhks|bedroom|bedrooms|bed|beds)\b/)
    || text.match(/\b(ek|do|teen|chaar|char|paanch|panch|one|two|three|four|five)\s*-?\s*(?:bhk|bedroom|bedrooms|bed)\b/);
  if (bhkMatch) {
    const n = HINDI_NUMBERS[bhkMatch[1]] ?? Number(bhkMatch[1]);
    if (Number.isFinite(n)) intent.bhk = Math.max(0, Math.min(20, Math.round(n)));
  }
  if (/\b1\s*rk\b|\bstudio\b/.test(text)) intent.propertyType = 'studio';

  // ── property type ──
  if (!intent.propertyType) {
    for (const [tokens, type] of TYPE_WORDS) {
      if (words.some((w) => tokens.includes(w))) { intent.propertyType = type; break; }
    }
    if (/\bindependent house\b|\brow house\b/.test(text)) intent.propertyType = 'house';
  }

  // ── furnishing ──
  if (/\bsemi[\s-]?furnished\b|\bsemi\b/.test(text)) intent.furnishing = 'semi-furnished';
  else if (/\bun[\s-]?furnished\b|\bnon[\s-]?furnished\b|\bbare shell\b/.test(text)) intent.furnishing = 'unfurnished';
  else if (/\bfurnished\b/.test(text)) intent.furnishing = 'furnished';

  // ── must-haves ──
  for (const [label, needles] of MUST_HAVES) {
    if (label === 'furnished') continue;
    if (needles.some((n) => new RegExp(`\\b${n.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`).test(text))) {
      intent.mustHaves.push(label);
    }
  }

  // ── city ──
  const inText = cityInText(text, cities);
  let matchedCityWords = '';
  if (inText) {
    intent.city = inText.city.name;
    intent.cityKey = inText.city.cityKey;
    matchedCityWords = inText.matched;
  } else {
    // A locality the buyer typed beats the default city they happened to
    // have selected: "2bhk in kurla" means Mumbai whatever the picker says.
    const fromLocality = cityFromLocality(text, cities);
    if (fromLocality) {
      intent.city = fromLocality.name;
      intent.cityKey = fromLocality.cityKey;
    } else if (city) {
      const resolved = resolveCity(city, cities);
      intent.city = resolved?.name || String(city).trim();
      intent.cityKey = resolved?.cityKey || null;
    }
  }

  // ── locality: whatever is left once every recognised token is removed ──
  let leftover = text;
  if (matchedCityWords) leftover = leftover.replace(new RegExp(`(^|\\s)${matchedCityWords}(\\s|$)`), ' ');
  for (const [, needles] of MUST_HAVES) {
    for (const n of needles) leftover = leftover.replace(new RegExp(`\\b${n.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'g'), ' ');
  }
  leftover = leftover
    .replace(/\d+(?:\.\d+)?\s*(?:-|to|se)?\s*\d*(?:\.\d+)?\s*(?:cr|crores?|lakhs?|lacs?|l|k|thousand|hazaa?r|bhk|bhks|bedrooms?|beds?|rk|sqft|sq)\b/g, ' ')
    .replace(/\d+(?:\.\d+)?/g, ' ');
  const localityWords = leftover
    .split(' ')
    .map((w) => w.replace(/^[-.]+|[-.]+$/g, ''))
    .filter((w) => w && !STOPWORDS.has(w) && !TYPE_WORDS.some(([t]) => t.includes(w)) && !HINDI_NUMBERS[w] && w.length > 2);
  if (localityWords.length >= 1 && localityWords.length <= 3) {
    intent.locality = localityWords.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  }

  return intent;
}

// ── templates for when explain() is unavailable ────────────────────────────

function formatRupees(n) {
  if (n === null || n === undefined) return null;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 2).replace(/\.?0+$/, '')} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 1).replace(/\.?0+$/, '')} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function heuristicFollowUps(intent) {
  const ups = [];
  if (intent.bhk === null) ups.push('Kitne BHK chahiye — 1, 2 ya 3?');
  if (intent.maxPrice === null) ups.push(intent.mode === 'rent' ? 'Monthly budget kya hai?' : 'Aapka budget kitna hai?');
  if (!intent.locality) ups.push('Koi specific area ya locality prefer karte hain?');
  if (!intent.furnishing) ups.push('Furnished chahiye ya unfurnished?');
  ups.push('Sirf ready-to-move options dikhaun?');
  return ups.slice(0, 2);
}

export function heuristicMessage(intent, count, { relaxed = false } = {}) {
  const city = intent.city || 'sab cities';
  const where = intent.locality ? `${intent.locality}${intent.city ? `, ${intent.city}` : ''}` : city;
  const what = [intent.bhk !== null ? `${intent.bhk} BHK` : null, intent.propertyType || 'homes'].filter(Boolean).join(' ');
  const budget = intent.maxPrice !== null ? ` under ${formatRupees(intent.maxPrice)}${intent.mode === 'rent' ? '/month' : ''}` : '';
  if (count === 0) return `${where} mein abhi ${what}${budget} ke liye koi listing nahi mili — filters thode loose karke dekhein?`;
  if (relaxed) return `${where} mein exact ${what}${budget} abhi nahi hai — yeh ${city} ke sabse kareeb ke ${count} option${count === 1 ? '' : 's'} hain.`;
  return `${where} mein ${count} ${what}${budget} mile — yeh top matches hain.`;
}

/** Explicit filters from the request win over whatever the parser inferred. */
function applyFilters(intent, filters = {}) {
  if (!filters || typeof filters !== 'object') return intent;
  const out = { ...intent };
  if (filters.mode === 'sale' || filters.mode === 'rent') out.mode = filters.mode;
  if (typeof filters.propertyType === 'string' && filters.propertyType.trim()) out.propertyType = filters.propertyType.trim().toLowerCase().slice(0, 40);
  if (typeof filters.furnishing === 'string' && filters.furnishing.trim()) out.furnishing = filters.furnishing.trim().toLowerCase().slice(0, 40);
  if (typeof filters.locality === 'string' && filters.locality.trim()) out.locality = filters.locality.trim().slice(0, 80);
  for (const k of ['bhk', 'minPrice', 'maxPrice']) {
    if (filters[k] !== undefined && filters[k] !== null && filters[k] !== '') {
      const n = Number(filters[k]);
      if (Number.isFinite(n) && n >= 0) out[k] = Math.round(n);
    }
  }
  return out;
}

const MAX_FANOUT_CITIES = 6;

const NARROWING_KEYS = ['bhk', 'minPrice', 'maxPrice', 'propertyType', 'furnishing'];

function hasNarrowingFilters(intent) {
  return Boolean(intent.mode) || NARROWING_KEYS.some((k) => intent[k] !== null && intent[k] !== undefined);
}

/** Progressively looser copies of an intent; see run(). */
function relaxationLadder(intent) {
  const base = { ...intent, bhk: null, minPrice: null, maxPrice: null, propertyType: null, furnishing: null };
  const steps = [];
  if (NARROWING_KEYS.some((k) => intent[k] !== null && intent[k] !== undefined)) steps.push(base);
  if (intent.mode) steps.push({ ...base, mode: null });
  return steps;
}

export function createAiSearch({ crm = realCrm, gateway = realGateway } = {}) {
  async function safeCities() {
    try {
      return await crm.listCities();
    } catch (err) {
      logger.warn('aiSearch.cities_unavailable', { error: err.message });
      return [];
    }
  }

  async function searchCrm(intent, query) {
    const filters = {
      city: intent.city,
      mode: intent.mode || undefined,
      locality: intent.locality || undefined,
      propertyType: intent.propertyType || undefined,
      minPrice: intent.minPrice ?? undefined,
      maxPrice: intent.maxPrice ?? undefined,
      bhk: intent.bhk ?? undefined,
      furnishing: intent.furnishing || undefined,
    };
    try {
      const r = await crm.search({ ...filters, query: intent.canonicalQuery || query, limit: 25 });
      if (r?.reason !== 'search_unavailable') {
        return { items: r?.items || [], cityKey: r?.cityKey || null, degraded: false };
      }
      logger.warn('aiSearch.vector_search_unavailable', { city: intent.city });
    } catch (err) {
      if (!(err instanceof CrmUnavailableError)) throw err;
      logger.warn('aiSearch.search_failed', { status: err.status });
    }
    // No vectors, but real inventory: the plain filtered listing read.
    const r = await crm.listListings({ ...filters, sort: 'newest', limit: 25 });
    return { items: r?.items || [], cityKey: r?.cityKey || null, degraded: true };
  }

  /**
   * No city anywhere in the request: run the same search in every live city
   * (busiest first, capped) and merge by score. Four or five parallel CRM
   * calls cost less than sending the buyer away to pick a city first.
   */
  async function searchAcrossCities(intent, query, cities) {
    const targets = [...(cities || [])].sort((x, y) => (y.total || 0) - (x.total || 0)).slice(0, MAX_FANOUT_CITIES);
    if (targets.length === 0) return { items: [], cityKey: null, degraded: false };
    const settled = await Promise.allSettled(
      targets.map((c) => searchCrm({ ...intent, city: c.name, cityKey: c.cityKey }, query)),
    );
    const ok = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    if (ok.length === 0) throw settled[0].reason;
    const seen = new Set();
    const items = ok.flatMap((r) => r.items)
      .filter((l) => (seen.has(l.propertyId) ? false : seen.add(l.propertyId)))
      .sort((x, y) => (y.matchScore ?? 0) - (x.matchScore ?? 0))
      .slice(0, 25);
    return { items, cityKey: null, degraded: ok.some((r) => r.degraded) };
  }

  /**
   * @returns {{ intent, results, followUps, assistantMessage, needsCity, relaxed }}
   */
  async function run({ query, city = null, filters = {} }) {
    const cities = await safeCities();

    let intent;
    let intentSource = 'model';
    try {
      intent = await gateway.parseIntent({ query, city, cities });
    } catch (err) {
      intentSource = 'heuristic';
      logger.warn('aiSearch.intent_model_failed', { error: err.message });
      intent = heuristicIntent({ query, city, cities });
    }
    intent = applyFilters(intent, filters);

    // The city the search runs in: what the parser found, else the caller's
    // default. A name that is not a live marketplace city (a city we have no
    // agency in, or a locality the model mistook for a city) cannot return
    // anything, so that case searches every live city instead and the answer
    // is flagged as "closest", never passed off as a match. With no city list
    // to check against (CRM cities read failed) the name goes through as is.
    const resolved = resolveCity(intent.cityKey || intent.city, cities) || resolveCity(city, cities);
    const namedCity = intent.city || (city ? String(city).trim() : null);
    const cityName = resolved?.name || (cities.length === 0 ? namedCity : null);
    const cityNotLive = !cityName && Boolean(namedCity);
    intent.city = cityName || null;
    intent.cityKey = resolved?.cityKey || null;

    // Exact search first: one city when we know it, else every live city.
    let search = cityName
      ? await searchCrm(intent, query)
      : await searchAcrossCities(intent, query, cities);

    // Nothing fits every filter. A blank page helps nobody, so loosen the
    // search and say so: first keep rent/sale and drop the rest, then drop
    // rent/sale too. The buyer's locality still orders the results (the CRM
    // ranks the asked-for locality first), so the nearest homes lead.
    let relaxed = cityNotLive && search.items.length > 0;
    if (search.items.length === 0 && hasNarrowingFilters(intent)) {
      for (const loose of relaxationLadder(intent)) {
        const attempt = cityName
          ? await searchCrm(loose, query)
          : await searchAcrossCities(loose, query, cities);
        if (attempt.items.length > 0) {
          search = attempt;
          relaxed = true;
          break;
        }
      }
    }

    const { items, degraded } = search;
    if (search.cityKey) intent.cityKey = search.cityKey;

    // An all-cities search that landed in one city has found the buyer's city.
    if (!cityName && items.length > 0) {
      const found = [...new Set(items.map((l) => l.city).filter(Boolean))];
      if (found.length === 1) {
        const only = resolveCity(found[0], cities);
        intent.city = only?.name || found[0];
        intent.cityKey = only?.cityKey || intent.cityKey;
      }
    }

    if (!cityName && items.length === 0) {
      const names = cities.slice(0, 6).map((c) => c.name);
      return {
        intent,
        results: [],
        followUps: names.length ? names.slice(0, 2).map((n) => `${n} mein dikhao`) : ['Mumbai mein dikhao', 'Pune mein dikhao'],
        assistantMessage: names.length
          ? `Kaunse city mein dhoondh rahe hain? Abhi ${names.join(', ')} mein listings hain.`
          : 'Kaunse city mein dhoondh rahe hain?',
        needsCity: true,
        relaxed: false,
      };
    }

    let explanation = null;
    if (items.length > 0) {
      try {
        explanation = await gateway.explain({ query, intent, listings: items.slice(0, 8), relaxed });
      } catch (err) {
        logger.warn('aiSearch.explain_model_failed', { error: err.message });
      }
    }

    logger.info('aiSearch.completed', {
      cityKey: intent.cityKey, results: items.length, intentSource, explained: Boolean(explanation), degraded, relaxed,
    });

    return {
      intent,
      results: items.map((l) => ({ ...l, why: explanation?.why?.[l.propertyId] ?? null, closeMatch: relaxed })),
      followUps: explanation?.followUps?.length ? explanation.followUps : heuristicFollowUps(intent),
      assistantMessage: explanation?.assistantMessage || heuristicMessage(intent, items.length, { relaxed }),
      needsCity: false,
      relaxed,
    };
  }

  return { run };
}

export const aiSearch = createAiSearch();
