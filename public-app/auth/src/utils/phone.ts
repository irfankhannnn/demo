/**
 * Phone normalisation for the consumer marketplace.
 *
 * Indian mobiles (the primary market) may arrive as any of
 *   +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
 * where the 10-digit subscriber number starts with 6-9. All four normalise
 * to E.164 `+91XXXXXXXXXX`. Any other input must already be a valid E.164
 * number (`+` then 8-15 digits, first digit 1-9) and is returned unchanged
 * apart from stripping spaces/dashes/parentheses/dots.
 */

const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().replace(/[\s\-().]/g, '');
  if (!cleaned) return null;

  // Indian forms first — "91XXXXXXXXXX" without "+" is ambiguous in pure
  // E.164 terms but unambiguous for our users, so it is treated as +91.
  let indian: string | null = null;
  if (cleaned.startsWith('+91')) indian = cleaned.slice(3); // any +91 number must be an Indian mobile
  else if (cleaned.startsWith('91') && cleaned.length === 12) indian = cleaned.slice(2);
  else if (cleaned.startsWith('0') && cleaned.length === 11) indian = cleaned.slice(1);
  else if (cleaned.length === 10) indian = cleaned;

  if (indian !== null) {
    return INDIAN_MOBILE.test(indian) ? `+91${indian}` : null;
  }

  return E164.test(cleaned) ? cleaned : null;
}

export function isIndianMobile(e164: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(e164);
}

/** Display form: +91 98765 43210 for Indian numbers, unchanged otherwise. */
export function formatPhoneForDisplay(e164: string): string {
  if (!isIndianMobile(e164)) return e164;
  const digits = e164.slice(3);
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}
