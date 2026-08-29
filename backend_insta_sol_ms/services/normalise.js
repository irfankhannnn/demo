// Normalisers and enum guards shared by the agent-upload and dashboard routes.
//
// The laptop agent extracts enquiries from free-text Instagram DMs, so
// everything arriving on /agent/enquiries is best-effort human writing:
// "2.5cr", "budget 45 lakhs", "call me on 09876543210". Normalising server-side
// (in addition to on the laptop) keeps the dashboard's filters meaningful even
// when an older agent build uploads raw strings.

export const INTENTS = new Set(['buy', 'rent', 'heavy_deposit_ok', 'sell', 'unknown']);
export const TEMPERATURES = new Set(['hot', 'warm', 'cold']);
export const ENQUIRY_STATUSES = new Set([
  'new',
  'contacted',
  'qualified',
  'site_visit',
  'won',
  'lost',
  'spam',
]);
export const WINDOW_STATES = new Set(['STANDARD', 'COMMENT_REPLY', 'HUMAN_AGENT', 'CLOSED']);

/** Ordered low-to-high; the dashboard renders brackets in this exact order. */
export const BUDGET_BRACKETS = [
  'under_25L',
  '25L_50L',
  '50L_1Cr',
  '1Cr_2Cr',
  '2Cr_5Cr',
  'above_5Cr',
  'unknown',
];

const LAKH = 100_000;
const CRORE = 10_000_000;

/**
 * Accepts a number of rupees, or the kind of string a person types in a DM.
 * Returns one of BUDGET_BRACKETS — never throws, because a malformed budget
 * must not fail an otherwise good enquiry upload.
 */
export function toBudgetBracket(input) {
  const rupees = toRupees(input);
  if (rupees === null) return 'unknown';
  if (rupees < 25 * LAKH) return 'under_25L';
  if (rupees < 50 * LAKH) return '25L_50L';
  if (rupees < 1 * CRORE) return '50L_1Cr';
  if (rupees < 2 * CRORE) return '1Cr_2Cr';
  if (rupees < 5 * CRORE) return '2Cr_5Cr';
  return 'above_5Cr';
}

/**
 * Parses Indian budget shorthand to a rupee amount. Returns null when nothing
 * numeric is present. A bare number under 1000 is read as lakhs ("budget 50")
 * because nobody enquires about a fifty-rupee flat.
 */
export function toRupees(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input > 0 ? applyBareScale(input) : null;
  }
  if (typeof input !== 'string') return null;

  const text = input.toLowerCase().replace(/,/g, '').trim();
  if (!text) return null;

  // Take the first number plus whatever unit is glued to it. Scanning the whole
  // string for "l" or "cr" instead would read "rental" as lakhs; the unit has
  // to be adjacent to the digits to count.
  // A range ("50-60 lakh") is bracketed by its floor, which is the conservative
  // read for lead qualification.
  const match = text.match(/(\d+(?:\.\d+)?)\s*([a-z]*)/);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = match[2];
  if (/^(cr|crore|crores)$/.test(unit)) return value * CRORE;
  if (/^(l|lac|lacs|lakh|lakhs)$/.test(unit)) return value * LAKH;
  if (/^(k)$/.test(unit)) return value * 1_000;

  return applyBareScale(value);
}

function applyBareScale(value) {
  // Unitless small numbers are lakhs; anything already in the millions is
  // taken at face value as rupees.
  return value < 1000 ? value * LAKH : value;
}

/**
 * India-first E.164 normalisation. Returns null rather than a guess when the
 * digits cannot make a valid number — a null phone is a visible data problem,
 * a wrong phone is a wasted sales call.
 */
export function normalisePhone(input) {
  if (typeof input === 'number') input = String(input);
  if (typeof input !== 'string') return null;

  const hadPlus = input.trim().startsWith('+');
  let digits = input.replace(/\D/g, '');
  if (!digits) return null;

  // Trunk prefix from a locally-dialled number.
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  // "0091..." international access code.
  if (digits.length === 14 && digits.startsWith('0091')) digits = digits.slice(2);

  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    return `+${digits}`;
  }

  // Anything else is only accepted when it was explicitly written as
  // international; otherwise we would happily invent country codes.
  if (hadPlus && digits.length >= 8 && digits.length <= 15) return `+${digits}`;

  return null;
}

/**
 * Log- and UI-safe rendering. Full numbers never leave the table: they go to
 * the dashboard for a human to call, not to CloudWatch.
 */
export function maskPhone(input) {
  const phone = typeof input === 'string' ? input : '';
  if (phone.length < 4) return '****';
  return `${'*'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`;
}

export function normaliseIntent(value) {
  const v = String(value || '').toLowerCase().trim();
  return INTENTS.has(v) ? v : 'unknown';
}

export function normaliseTemperature(value) {
  const v = String(value || '').toLowerCase().trim();
  return TEMPERATURES.has(v) ? v : 'cold';
}

export function normaliseStatus(value) {
  const v = String(value || '').toLowerCase().trim();
  return ENQUIRY_STATUSES.has(v) ? v : null;
}

export function normaliseWindowState(value) {
  const v = String(value || '').toUpperCase().trim();
  return WINDOW_STATES.has(v) ? v : null;
}

/** YYYY-MM-DD, the snapshot sort-key granularity. */
export function toDateKey(input = Date.now()) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export default {
  INTENTS,
  TEMPERATURES,
  ENQUIRY_STATUSES,
  WINDOW_STATES,
  BUDGET_BRACKETS,
  toBudgetBracket,
  toRupees,
  normalisePhone,
  maskPhone,
  normaliseIntent,
  normaliseTemperature,
  normaliseStatus,
  normaliseWindowState,
  toDateKey,
};
