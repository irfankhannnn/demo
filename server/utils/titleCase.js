/**
 * Domain acronyms that must survive title-casing as-is.
 *
 * This replaced a `/^[A-Z]{4,6}$/` heuristic that preserved ANY 4-6 letter
 * all-caps word. That matched ordinary English just as readily as acronyms,
 * so a building or area name typed in caps came out mangled:
 * "SEA BREEZE TOWERS" → "Sea BREEZE TOWERS" (SEA is 3 letters so it was
 * corrected; BREEZE and TOWERS are 6, so they were "protected"). Since
 * pasting names in caps is common, this was corrupting real data.
 *
 * An explicit allowlist is the right shape here: the set of acronyms that
 * matter in Indian real estate is small, known, and closed — unlike the set
 * of 4-6 letter English words, which is not.
 */
const PRESERVED_ACRONYMS = new Set([
  'RERA', 'AADHAR', 'AADHAAR', 'PAN', 'KYC', 'NRI', 'OTP', 'EMI', 'BHK',
  'NOC', 'GST', 'TDS', 'LLP', 'HUF', 'POA', 'MOU', 'RTGS', 'NEFT', 'UPI',
  'IFSC', 'CIBIL', 'CC', 'OC', 'BMC', 'MHADA', 'CIDCO', 'DTCP', 'BBMP',
]);

function formatWord(word) {
  const match = word.match(/^([^A-Za-z0-9]*)([A-Za-z0-9.+/-]+)([^A-Za-z0-9]*)$/);
  if (!match) return word;

  const [, prefix, core, suffix] = match;

  if (/^\d[\d+.,/-]*$/.test(core)) return word;
  if (/^[A-Z0-9]*\d[A-Z0-9]*$/.test(core)) return word;
  if (PRESERVED_ACRONYMS.has(core)) return word;
  if (/^\d+[A-Za-z]?$/.test(core)) {
    const parts = core.match(/^(\d+)([A-Za-z]?)$/);
    return `${prefix}${parts[1]}${parts[2] ? parts[2].toUpperCase() : ''}${suffix}`;
  }

  const lower = core.toLowerCase();
  return `${prefix}${lower.charAt(0).toUpperCase() + lower.slice(1)}${suffix}`;
}

/**
 * Convert free-text to Title Case (each word capitalized).
 * Skips emails and leaves numeric tokens unchanged.
 */
export function toTitleCase(value) {
  if (value === null || value === undefined) return value;
  const str = String(value).trim();
  if (!str) return str;
  if (str.includes('@')) return str;

  return str
    .split(/\s+/)
    .map(formatWord)
    .join(' ');
}

export function titleCaseFields(target, fields) {
  if (!target || typeof target !== 'object') return target;
  for (const field of fields) {
    if (target[field] !== undefined && target[field] !== null && target[field] !== '') {
      target[field] = toTitleCase(target[field]);
    }
  }
  return target;
}
