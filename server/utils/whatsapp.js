/**
 * Shared WhatsApp utility functions.
 */

/**
 * Normalize a WhatsApp identifier (phone, JID, LID) to a stable phone number.
 * Strips whitespace, @domain suffix, :device suffix, leading +, and all non-digits.
 * This ensures consistent comparison across all modules.
 * @param {string} phone
 * @returns {string}
 */
export function normalizeWhatsAppPhone(phone) {
  if (!phone) return '';
  return String(phone)
    .replace(/\s/g, '')
    .replace(/@.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^\+/, '')
    .replace(/\D/g, '');
}

/**
 * Classify a WhatsApp identifier as a phone number, LID, group, or unknown.
 * @param {string} id
 * @returns {{ type: 'phone' | 'lid' | 'group' | 'unknown', digits: string }}
 */
export function classifyWhatsAppId(id) {
  const digits = String(id || '').replace(/@.*$/, '').replace(/:\d+$/, '').replace(/\D/g, '');
  if (!digits) return { type: 'unknown', digits: '' };
  if (id.includes('@g.us') || (digits.length >= 18 && digits.startsWith('120'))) {
    return { type: 'group', digits };
  }
  if (id.includes('@lid') || (digits.length === 14 && digits.startsWith('100'))) {
    return { type: 'lid', digits };
  }
  if (digits.length >= 10) return { type: 'phone', digits };
  return { type: 'unknown', digits };
}
