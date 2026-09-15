// The single gate every outbound Instagram message passes through.
//
// Meta's messaging windows are the difference between a tool that works and a
// tool that gets an agency's account restricted, so they are enforced here in
// code rather than left to whoever writes the next feature. Ported from the
// laptop agent's engine/windowClassifier.js.
//
//   STANDARD       the person messaged us within 24h   -> a reply may be sent
//   COMMENT_REPLY  they commented within 7 days        -> one private reply only
//   CLOSED         anything older                     -> nothing can be sent
//
// The HUMAN_AGENT tag is deliberately not offered: it needs its own Meta
// permission and is restricted to a human resolving a support issue.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const STANDARD_WINDOW_MS = 24 * HOUR_MS;
export const COMMENT_REPLY_WINDOW_MS = 7 * DAY_MS;

/** Meta rejects a DM longer than 1000 characters. */
export const MAX_MESSAGE_CHARS = 1000;

export const WINDOW = {
  STANDARD: 'STANDARD',
  COMMENT_REPLY: 'COMMENT_REPLY',
  HUMAN_AGENT: 'HUMAN_AGENT',
  CLOSED: 'CLOSED',
};

function toMs(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * @param {{lastInboundAt?: string|number, lastCommentAt?: string|number}} thread
 * @returns {{state: string, expiresAt: string|null, reason: string}}
 */
export function classifyWindow(thread = {}, at = Date.now()) {
  const lastInbound = toMs(thread.lastInboundAt);
  const lastComment = toMs(thread.lastCommentAt);
  // Set when Meta refused a send as outside the window. Meta is authoritative:
  // the thread stays closed until the person writes again.
  const closedByMeta = toMs(thread.windowClosedAt);
  const metaClosedSinceInbound = closedByMeta !== null && (lastInbound === null || closedByMeta >= lastInbound);

  if (!metaClosedSinceInbound && lastInbound !== null && at - lastInbound < STANDARD_WINDOW_MS) {
    return {
      state: WINDOW.STANDARD,
      expiresAt: new Date(lastInbound + STANDARD_WINDOW_MS).toISOString(),
      reason: 'they messaged within the last 24 hours',
    };
  }

  if (lastComment !== null && at - lastComment < COMMENT_REPLY_WINDOW_MS) {
    return {
      state: WINDOW.COMMENT_REPLY,
      expiresAt: new Date(lastComment + COMMENT_REPLY_WINDOW_MS).toISOString(),
      reason: 'they commented within the last 7 days - only a private reply to that comment is allowed',
    };
  }

  return {
    state: WINDOW.CLOSED,
    expiresAt: null,
    reason: 'no open window - nothing can be sent until this person messages again',
  };
}

/**
 * Can this outbound item be sent right now?
 *
 * @param {object} args
 * @param {'dm'|'private_reply'|'comment_reply'} args.kind
 * @param {object} [args.thread] - for a dm
 * @param {string|number} [args.commentCreatedAt] - for a private reply
 */
export function canSend({ kind = 'dm', thread = null, commentCreatedAt = null } = {}, at = Date.now()) {
  // A public comment reply is a comment, not a message. No window applies.
  if (kind === 'comment_reply') {
    return { allowed: true, state: null, reason: 'a public comment reply is not window-bound' };
  }

  if (kind === 'private_reply') {
    const created = toMs(commentCreatedAt);
    if (created === null) {
      return { allowed: false, state: WINDOW.CLOSED, reason: 'the comment time is unknown' };
    }
    return at - created < COMMENT_REPLY_WINDOW_MS
      ? { allowed: true, state: WINDOW.COMMENT_REPLY, reason: 'private reply within 7 days of the comment' }
      : { allowed: false, state: WINDOW.CLOSED, reason: 'the comment is older than 7 days' };
  }

  const w = classifyWindow(thread ?? {}, at);
  if (w.state === WINDOW.STANDARD) return { allowed: true, state: w.state, reason: w.reason };
  return {
    allowed: false,
    state: w.state,
    reason:
      w.state === WINDOW.COMMENT_REPLY
        ? 'only a private reply to their comment is allowed, not a free-form DM'
        : 'the 24-hour window is closed - they have to message you again first',
  };
}

export function clampMessage(text) {
  const s = String(text ?? '').trim();
  return s.length > MAX_MESSAGE_CHARS ? `${s.slice(0, MAX_MESSAGE_CHARS - 1)}…` : s;
}

export default { classifyWindow, canSend, clampMessage, WINDOW, STANDARD_WINDOW_MS, COMMENT_REPLY_WINDOW_MS };
