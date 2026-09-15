// Keyword rules: does a comment match, and which rule wins.
//
// Ported from the laptop agent's collectors/comments.js, with one fix: the
// agent matched `startswith` while the API and the console store
// `starts_with`, so every starts-with rule silently fell through to
// `contains`. Both spellings are accepted here.

export function matchesRule(text, rule) {
  if (!text || !rule) return false;
  const t = String(text).toLowerCase().trim();
  const k = String(rule.keyword ?? '').toLowerCase().trim();
  if (!k) return false;

  switch (rule.matchType ?? 'contains') {
    case 'exact':
      return t === k;
    case 'starts_with':
    case 'startswith':
      return t.startsWith(k);
    case 'regex':
      try {
        return new RegExp(rule.keyword, 'i').test(String(text));
      } catch {
        return false;
      }
    case 'contains':
    default: {
      // Word-ish containment so "PRICE" does not fire on "priceless".
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'iu').test(t);
    }
  }
}

export function ruleAppliesToMedia(rule, mediaId) {
  const scope = rule.mediaScope ?? 'all';
  if (!scope || scope === 'all') return true;
  return String(scope)
    .split(',')
    .map((s) => s.trim())
    .includes(String(mediaId));
}

/** First enabled rule, in creation order, that matches this comment on this media. */
export function findRule(text, mediaId, rules = []) {
  return (
    [...rules]
      .filter((r) => r.enabled !== false)
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
      .find((r) => ruleAppliesToMedia(r, mediaId) && matchesRule(text, r)) ?? null
  );
}

export default { matchesRule, ruleAppliesToMedia, findRule };
