/**
 * Extracts a customer phone number from a call-recording file name.
 *
 * Agency owners export recordings from call recorder apps, so file names are
 * inconsistent. Known shapes in the wild:
 *   9876543210.mp3
 *   +91 98765 43210.m4a
 *   Call recording Rahul_919876543210_20260809_101500.mp3
 *   WhatsApp Audio 2026-08-09 at 9876543210.opus
 *   0091-9876543210 (owner).amr
 *   20260809_101500_09876543210.wav
 */

const DEFAULT_COUNTRY_CODE = (process.env.DEFAULT_COUNTRY_CODE || '91').replace(/\D/g, '') || '91';

/** Indian mobile numbers are 10 digits beginning with 6-9. */
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export const MATCH_CONFIDENCE = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

/**
 * Reduce any phone-ish input to its comparable digits.
 * Indian numbers collapse to the trailing 10 digits so that `+919876543210`,
 * `09876543210` and `9876543210` all compare equal.
 */
export function normalizePhoneForMatch(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

/** True when two phone values refer to the same subscriber. */
export function phonesEqual(a, b) {
  const left = normalizePhoneForMatch(a);
  const right = normalizePhoneForMatch(b);
  return Boolean(left) && left === right;
}

/** Render a national number in E.164 using the configured country code. */
export function toE164(national, countryCode = DEFAULT_COUNTRY_CODE) {
  const digits = String(national ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length > 10) return `+${digits}`;
  return `+${countryCode}${digits}`;
}

/**
 * Strip country/trunk prefixes from a single run of digits.
 * Returns the 10-digit national number, or null when the run cannot be one.
 */
function nationalFromDigitRun(run) {
  if (!run) return null;

  if (run.length === 10) {
    return INDIAN_MOBILE.test(run) ? { national: run, confidence: MATCH_CONFIDENCE.HIGH } : null;
  }

  // 0XXXXXXXXXX (trunk prefix)
  if (run.length === 11 && run.startsWith('0')) {
    const candidate = run.slice(1);
    return INDIAN_MOBILE.test(candidate) ? { national: candidate, confidence: MATCH_CONFIDENCE.HIGH } : null;
  }

  // 91XXXXXXXXXX
  if (run.length === 12 && run.startsWith(DEFAULT_COUNTRY_CODE)) {
    const candidate = run.slice(DEFAULT_COUNTRY_CODE.length);
    return INDIAN_MOBILE.test(candidate) ? { national: candidate, confidence: MATCH_CONFIDENCE.HIGH } : null;
  }

  // 091XXXXXXXXXX / 0091XXXXXXXXXX
  if (run.length === 13 || run.length === 14) {
    const trimmed = run.replace(/^0+/, '');
    if (trimmed.length === 12 && trimmed.startsWith(DEFAULT_COUNTRY_CODE)) {
      const candidate = trimmed.slice(DEFAULT_COUNTRY_CODE.length);
      return INDIAN_MOBILE.test(candidate) ? { national: candidate, confidence: MATCH_CONFIDENCE.HIGH } : null;
    }
  }

  // Longer runs usually glue a timestamp to the number
  // (e.g. 919876543210_20260809 collapses to 91987654321020260809).
  if (run.length > 12) {
    const embedded = run.match(new RegExp(`${DEFAULT_COUNTRY_CODE}([6-9]\\d{9})`));
    if (embedded) {
      return { national: embedded[1], confidence: MATCH_CONFIDENCE.MEDIUM };
    }
    const tail = run.slice(-10);
    if (INDIAN_MOBILE.test(tail)) {
      return { national: tail, confidence: MATCH_CONFIDENCE.LOW };
    }
  }

  return null;
}

/**
 * Extract the most likely customer phone number from a file name.
 *
 * @param {string} filename
 * @returns {{ phone: string|null, e164: string|null, confidence: string|null, candidates: string[] }}
 */
export function extractPhoneFromFilename(filename) {
  const empty = { phone: null, e164: null, confidence: null, candidates: [] };
  const name = String(filename ?? '').trim();
  if (!name) return empty;

  // Drop the extension so ".mp3" style suffixes never contribute digits.
  const withoutExtension = name.replace(/\.[A-Za-z0-9]{1,5}$/, '');

  // Join digit groups separated by spaces/dashes so "+91 98765 43210" reads as one run.
  const glued = withoutExtension.replace(/(\d)[\s\-.](?=\d)/g, '$1');

  const runs = glued.match(/\d+/g) || [];
  const ranked = [];

  for (const run of runs) {
    const parsed = nationalFromDigitRun(run);
    if (parsed) ranked.push(parsed);
  }

  if (ranked.length === 0) return { ...empty, candidates: [] };

  const order = { [MATCH_CONFIDENCE.HIGH]: 0, [MATCH_CONFIDENCE.MEDIUM]: 1, [MATCH_CONFIDENCE.LOW]: 2 };
  ranked.sort((a, b) => order[a.confidence] - order[b.confidence]);

  const unique = [];
  for (const entry of ranked) {
    if (!unique.includes(entry.national)) unique.push(entry.national);
  }

  const best = ranked[0];
  return {
    phone: best.national,
    e164: toE164(best.national),
    // Several distinct numbers in one file name means we picked one of many.
    confidence: unique.length > 1 && best.confidence === MATCH_CONFIDENCE.HIGH
      ? MATCH_CONFIDENCE.MEDIUM
      : best.confidence,
    candidates: unique,
  };
}
