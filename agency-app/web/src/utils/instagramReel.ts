/**
 * Instagram reel links pasted onto a property by the agency owner.
 *
 * A reel shared into a DM arrives as a card that carries no URL, so the owner
 * pastes the reel's own link on the property and the shortcode is what the two
 * sides are matched on. Accepts the /reel/, /reels/ and /p/ spellings, with or
 * without a query string or trailing slash.
 */

const REEL_PATH_PATTERN = /^\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)\/?$/;

/**
 * Trims a pasted reel link and gives it an https:// scheme if it has none.
 *
 * People paste `instagram.com/reel/abc` as often as the full link, and the
 * server validates `permalink` as a URL — without this the whole property save
 * would fail on a link that is otherwise perfectly good.
 */
export function normalizeInstagramUrl(raw: string | null | undefined): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Returns the shortcode in an Instagram post/reel URL, or null if there is none. */
export function extractInstagramShortcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return null;

  const match = url.pathname.match(REEL_PATH_PATTERN);
  return match ? match[1] : null;
}
