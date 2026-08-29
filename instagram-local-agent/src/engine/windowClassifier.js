/**
 * A7 - Window classifier.
 *
 * The single gate every outbound message passes through. Meta's messaging
 * windows are the difference between a tool that works and a tool that gets the
 * agency's account restricted, so they are enforced here in code rather than
 * left to whoever writes the next feature.
 *
 *   STANDARD       the person messaged us within 24h        -> auto-send allowed
 *   COMMENT_REPLY  they commented within 7 days             -> private reply allowed
 *   HUMAN_AGENT    within 7 days, support case              -> human click required
 *   CLOSED         older than all of the above              -> NOTHING can be sent
 *
 * Two rules that are easy to get wrong and are therefore asserted in tests:
 *
 *   1. HUMAN_AGENT is NOT an automation lever. Meta's policy restricts the tag
 *      to a human resolving an issue and they detect misuse, so a HUMAN_AGENT
 *      send requires an explicit human_approved flag on the outbox row. The
 *      classifier reports the state; it never grants automated permission.
 *   2. A window error from Meta must DOWNGRADE the thread, never trigger a
 *      retry. Retrying a blocked send is precisely the pattern that gets
 *      accounts flagged.
 */
import { DAY_MS, HOUR_MS, now } from '../util/time.js';

export const STANDARD_WINDOW_MS = 24 * HOUR_MS;
export const COMMENT_REPLY_WINDOW_MS = 7 * DAY_MS;
export const HUMAN_AGENT_WINDOW_MS = 7 * DAY_MS;

export const WINDOW = {
  STANDARD: 'STANDARD',
  COMMENT_REPLY: 'COMMENT_REPLY',
  HUMAN_AGENT: 'HUMAN_AGENT',
  CLOSED: 'CLOSED',
};

/** Ranked best-to-worst. Used to decide whether a re-classification is a downgrade. */
export const WINDOW_RANK = {
  [WINDOW.STANDARD]: 3,
  [WINDOW.COMMENT_REPLY]: 2,
  [WINDOW.HUMAN_AGENT]: 1,
  [WINDOW.CLOSED]: 0,
};

export class WindowClosedError extends Error {
  constructor(message, { conversationId = null, state = WINDOW.CLOSED } = {}) {
    super(message);
    this.name = 'WindowClosedError';
    this.conversationId = conversationId;
    this.state = state;
  }
}

/**
 * Classify a conversation row (or a plain object with the same fields).
 *
 * Accepts both snake_case (straight off SQLite) and camelCase (in-memory), so
 * callers never have to remember which shape they are holding.
 */
export function classifyWindow(conversation = {}, at = now()) {
  const lastInboundAt = conversation.last_inbound_at ?? conversation.lastInboundAt ?? null;
  const lastCommentAt = conversation.last_comment_at ?? conversation.lastCommentAt ?? null;
  const humanAgentUntil = conversation.human_agent_until ?? conversation.humanAgentUntil ?? null;

  if (lastInboundAt && at - lastInboundAt < STANDARD_WINDOW_MS) {
    return {
      state: WINDOW.STANDARD,
      expiresAt: lastInboundAt + STANDARD_WINDOW_MS,
      // Only the standard window permits sending with no further ceremony.
      autoSendAllowed: true,
      reason: 'inbound message within 24h',
    };
  }

  if (lastCommentAt && at - lastCommentAt < COMMENT_REPLY_WINDOW_MS) {
    return {
      state: WINDOW.COMMENT_REPLY,
      expiresAt: lastCommentAt + COMMENT_REPLY_WINDOW_MS,
      // A private reply is automated and allowed, but it is the ONLY thing this
      // state permits - a free-form DM here would be outside the window.
      autoSendAllowed: true,
      reason: 'comment within 7 days',
    };
  }

  if (humanAgentUntil && at < humanAgentUntil) {
    return {
      state: WINDOW.HUMAN_AGENT,
      expiresAt: humanAgentUntil,
      // Deliberately false. See the note at the top of this file.
      autoSendAllowed: false,
      reason: 'human agent window - requires an explicit human send',
    };
  }

  return {
    state: WINDOW.CLOSED,
    expiresAt: null,
    autoSendAllowed: false,
    reason: 'no open window - re-engagement requires a Story CTA (feature F25)',
  };
}

/**
 * Can this specific outbound item be sent right now?
 *
 * `kind` matters: COMMENT_REPLY only authorises a private_reply or a
 * comment_reply, never a free-form DM, because the 7-day allowance attaches to
 * answering that comment.
 */
export function canSend({ conversation, kind = 'dm', humanApproved = false }, at = now()) {
  const w = classifyWindow(conversation, at);

  // A public comment reply is not a message at all - it is a comment. It is
  // governed by the comment rate bucket, not by the messaging window.
  if (kind === 'comment_reply') {
    return { allowed: true, state: w.state, reason: 'public comment reply is not window-bound' };
  }

  if (w.state === WINDOW.CLOSED) {
    return {
      allowed: false,
      state: w.state,
      reason: 'thread is CLOSED - no API mechanism reaches it. Use a Story CTA to reopen.',
    };
  }

  if (w.state === WINDOW.HUMAN_AGENT) {
    return humanApproved
      ? { allowed: true, state: w.state, reason: 'human-approved send inside the 7-day human agent window' }
      : { allowed: false, state: w.state, reason: 'HUMAN_AGENT requires an explicit human approval' };
  }

  if (w.state === WINDOW.COMMENT_REPLY && kind === 'dm') {
    return {
      allowed: false,
      state: w.state,
      reason: 'only a private_reply may be sent in the COMMENT_REPLY window, not a free-form DM',
    };
  }

  return { allowed: true, state: w.state, reason: w.reason };
}

/** True when `next` is worse than `current` - used to confirm a Meta window error downgraded us. */
export function isDowngrade(current, next) {
  return (WINDOW_RANK[next] ?? 0) < (WINDOW_RANK[current] ?? 0);
}

export default { classifyWindow, canSend, isDowngrade, WINDOW, WINDOW_RANK, WindowClosedError };
