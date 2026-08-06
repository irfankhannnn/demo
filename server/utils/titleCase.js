function formatWord(word) {
  const match = word.match(/^([^A-Za-z0-9]*)([A-Za-z0-9.+/-]+)([^A-Za-z0-9]*)$/);
  if (!match) return word;

  const [, prefix, core, suffix] = match;

  if (/^\d[\d+.,/-]*$/.test(core)) return word;
  if (/^[A-Z0-9]*\d[A-Z0-9]*$/.test(core)) return word;
  if (/^[A-Z]{4,6}$/.test(core)) return word;
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
