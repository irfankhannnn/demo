/**
 * Phone-masking helpers (CONTRACTS.md section 7).
 *
 * The CRM masks phone fields on every `/api/crm/*` response for roles other
 * than ADMIN / FOUNDER / OWNER (`+919812345678` → `+91 ******5678`) and stamps
 * `phoneMasked: true` on each object it touched. The frontend must then
 * (a) never build a `tel:` link from a masked value and (b) never send a
 * masked value back on save, or it would overwrite the real number.
 */

import { getUserProfile } from './authStorage';

export const FULL_PHONE_ROLES = ['ADMIN', 'FOUNDER', 'OWNER'] as const;

export const PHONE_HIDDEN_NOTE = 'Number hidden for your role';

/** Keys the server masks (case-sensitive, any depth). */
export const MASKED_PHONE_KEYS = [
  'phone',
  'mobile',
  'mobileNumber',
  'alternatePhone',
  'normalizedPhone',
  'contactNumber',
  'ownerPhone',
  'attendeePhone',
  'relatedEntityPhone',
  'whatsapp',
  'whatsappNumber',
  'phoneNumber',
  'tenantPhone',
  'buyerPhone',
  'sellerPhone',
] as const;

/** Whether the signed-in user's role receives unmasked numbers. */
export function canViewFullPhone(): boolean {
  const profile = getUserProfile();
  if (!profile) return false;
  return (FULL_PHONE_ROLES as readonly string[]).includes(profile.role);
}

/** True when a string looks like a server-masked number (`+91 ******5678`). */
export function isMaskedPhoneValue(value: unknown): boolean {
  return typeof value === 'string' && /\*{3,}/.test(value);
}

/**
 * Shallow copy of `obj` without any masked phone field and without the
 * `phoneMasked` flag. Use on update payloads so a masked user's save does
 * not clobber the real number with asterisks.
 */
export function stripMaskedPhoneFields<T extends object>(obj: T): T {
  const out: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  for (const key of MASKED_PHONE_KEYS) {
    if (key in out && isMaskedPhoneValue(out[key])) delete out[key];
  }
  delete out.phoneMasked;
  return out as T;
}
