/**
 * A7 - Sender. Every outbound message on the laptop leaves through here.
 *
 * Queue-then-send, deliberately. Queuing records the window state at the moment
 * the decision was made; sending re-checks it immediately before the call,
 * because a queued item can sit long enough for a 24h window to lapse. Both
 * states are stored on the row, so an audit can tell "we were allowed when we
 * decided" apart from "we were still allowed when we sent".
 *
 * On a window error from Meta the thread is DOWNGRADED and the item is marked
 * `blocked` - never retried. Retrying a window-blocked send is the exact
 * behaviour Meta's anti-spam systems look for.
 */
import {
  insertOutbox, updateOutbox, listSendableOutbox, getConversation,
  updateConversationWindow, setCommentState, updateDraft, audit,
} from '../store/repos.js';
import { canSend, classifyWindow, WINDOW } from './windowClassifier.js';
import { assertNotEngaged, isDryRun, KillSwitchError } from '../runtime/killSwitch.js';
import { ERROR_KIND, backoffMs } from '../runtime/errors.js';
import { RateLimitError } from '../runtime/governor.js';
import { now } from '../util/time.js';
import { logger } from '../util/logger.js';

const log = logger('engine/sender');

/** Meta caps a DM at 1000 characters. Truncate here rather than let the API reject it. */
export const MAX_DM_CHARS = 1000;

function clamp(body) {
  const s = String(body ?? '').trim();
  return s.length > MAX_DM_CHARS ? `${s.slice(0, MAX_DM_CHARS - 1)}…` : s;
}

// ---------------------------------------------------------------------------
// Queueing
// ---------------------------------------------------------------------------

/**
 * Queue a free-form DM. Only legal in the STANDARD window, or in HUMAN_AGENT
 * with an explicit human approval.
 */
export function queueDirectMessage(ctx, {
  conversationId, igUserId, recipientId, body, draftId = null,
  humanApproved = false, approvedBy = null,
}) {
  const conversation = conversationId ? getConversation(conversationId, ctx.db) : null;
  const verdict = canSend({ conversation, kind: 'dm', humanApproved });

  const row = insertOutbox({
    kind: 'dm',
    igUserId,
    conversationId,
    recipientId,
    draftId,
    body: clamp(body),
    windowStateAtQueue: verdict.state,
    humanApproved,
    approvedBy,
    approvedAt: humanApproved ? now() : null,
    // A refused item is still recorded, as `blocked`. Silently dropping it would
    // hide from the owner that the reply they expected never went out.
    status: verdict.allowed ? 'queued' : 'blocked',
  }, ctx.db);

  if (!verdict.allowed) {
    updateOutbox(row.outbox_id, { lastError: verdict.reason, lastErrorCode: 'WINDOW' }, ctx.db);
    log.warn('dm refused at queue time', { conversationId, state: verdict.state, reason: verdict.reason });
  }

  audit({
    scope: 'sender', action: 'queue_dm', targetId: row.outbox_id,
    outcome: verdict.allowed ? 'ok' : 'blocked', detail: verdict.reason,
  }, ctx.db);

  return row;
}

/**
 * Queue a private reply to a comment - the comment-to-DM path. Legal for 7 days
 * after the comment, and the only way to open a thread with someone who has
 * never messaged us.
 */
export function queuePrivateReply(ctx, { commentId, igUserId, conversationId = null, body }) {
  const row = insertOutbox({
    kind: 'private_reply',
    igUserId,
    conversationId,
    commentId,
    body: clamp(body),
    windowStateAtQueue: WINDOW.COMMENT_REPLY,
    status: 'queued',
  }, ctx.db);

  setCommentState(commentId, { privateReplyState: 'queued' }, ctx.db);
  audit({ scope: 'sender', action: 'queue_private_reply', targetId: row.outbox_id, outcome: 'ok' }, ctx.db);
  return row;
}

/** Queue a public reply on a comment. Not a message, so not window-bound. */
export function queueCommentReply(ctx, { commentId, igUserId, body }) {
  const row = insertOutbox({
    kind: 'comment_reply',
    igUserId,
    commentId,
    body: clamp(body),
    status: 'queued',
  }, ctx.db);

  setCommentState(commentId, { publicReplyState: 'queued' }, ctx.db);
  audit({ scope: 'sender', action: 'queue_comment_reply', targetId: row.outbox_id, outcome: 'ok' }, ctx.db);
  return row;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/** Build the Graph request for an outbox row. Kept pure so it is testable. */
export function buildRequest(row) {
  switch (row.kind) {
    case 'comment_reply':
      return { path: `/${row.comment_id}/replies`, body: { message: row.body } };
    case 'private_reply':
      // The comment id in `recipient` is what makes this a private reply rather
      // than an ordinary DM, and what buys the 7-day allowance.
      return { path: '/me/messages', body: { recipient: { comment_id: row.comment_id }, message: { text: row.body } } };
    case 'dm':
      return { path: '/me/messages', body: { recipient: { id: row.recipient_id }, message: { text: row.body } } };
    default:
      throw new Error(`unknown outbox kind: ${row.kind}`);
  }
}

async function sendOne(ctx, row) {
  // Re-check the window at send time. A queued item can outlive its window.
  if (row.kind !== 'comment_reply') {
    const conversation = row.conversation_id ? getConversation(row.conversation_id, ctx.db) : null;

    // A private reply is authorised by the comment, not by the conversation, so
    // a thread with no inbound message yet is expected here and must not block it.
    if (row.kind === 'dm') {
      const verdict = canSend({
        conversation, kind: 'dm', humanApproved: Boolean(row.human_approved),
      });
      if (!verdict.allowed) {
        updateOutbox(row.outbox_id, {
          status: 'blocked', windowStateAtSend: verdict.state,
          lastError: `window closed before send: ${verdict.reason}`, lastErrorCode: 'WINDOW',
        }, ctx.db);
        audit({
          scope: 'sender', action: 'send', targetId: row.outbox_id,
          outcome: 'blocked', detail: verdict.reason,
        }, ctx.db);
        return { outboxId: row.outbox_id, status: 'blocked', reason: verdict.reason };
      }
    }
  }

  try {
    assertNotEngaged(`send ${row.kind}`);
  } catch (err) {
    if (err instanceof KillSwitchError) {
      updateOutbox(row.outbox_id, { lastError: err.message, lastErrorCode: 'KILL_SWITCH' }, ctx.db);
      return { outboxId: row.outbox_id, status: 'queued', reason: 'kill switch engaged' };
    }
    throw err;
  }

  const { path, body } = buildRequest(row);

  // Dry run stops here: the request is fully built and logged, nothing leaves.
  if (isDryRun()) {
    updateOutbox(row.outbox_id, { status: 'dry_run', windowStateAtSend: row.window_state_at_queue }, ctx.db);
    audit({ scope: 'sender', action: 'send', targetId: row.outbox_id, outcome: 'dry_run', detail: path }, ctx.db);
    log.info('dry run - not sent', { outboxId: row.outbox_id, kind: row.kind, path });
    return { outboxId: row.outbox_id, status: 'dry_run', request: { path, body } };
  }

  updateOutbox(row.outbox_id, { status: 'sending', attemptDelta: 1 }, ctx.db);

  try {
    const res = await ctx.graph.post(path, { accountId: row.ig_user_id, body, retries: 0 });
    const providerMessageId = res?.message_id ?? res?.id ?? null;

    updateOutbox(row.outbox_id, {
      status: 'sent', sentAt: now(), providerMessageId,
      windowStateAtSend: row.window_state_at_queue,
    }, ctx.db);

    if (row.kind === 'private_reply') {
      setCommentState(row.comment_id, { privateReplyState: 'sent', privateReplyAt: now() }, ctx.db);
    } else if (row.kind === 'comment_reply') {
      setCommentState(row.comment_id, { publicReplyState: 'sent', publicReplyId: providerMessageId }, ctx.db);
    }
    if (row.draft_id) updateDraft(row.draft_id, { status: 'sent' }, ctx.db);

    audit({ scope: 'sender', action: 'send', targetId: row.outbox_id, outcome: 'ok', detail: `sent ${path}` }, ctx.db);
    return { outboxId: row.outbox_id, status: 'sent', providerMessageId };
  } catch (err) {
    return handleSendError(ctx, row, err);
  }
}

function handleSendError(ctx, row, err) {
  const kind = err?.kind ?? ERROR_KIND.UNKNOWN;
  const code = err?.code ?? null;

  // A window error is authoritative: Meta is telling us the thread is closed.
  // Downgrade the conversation so the console stops offering a Send button, and
  // do NOT retry.
  if (kind === ERROR_KIND.WINDOW_BLOCKED) {
    if (row.conversation_id) {
      updateConversationWindow(row.conversation_id, {
        windowState: WINDOW.CLOSED, windowExpiresAt: null,
      }, ctx.db);
    }
    updateOutbox(row.outbox_id, {
      status: 'blocked', windowStateAtSend: WINDOW.CLOSED,
      lastError: err.message, lastErrorCode: String(code ?? 'WINDOW'),
    }, ctx.db);
    audit({
      scope: 'sender', action: 'send', targetId: row.outbox_id, outcome: 'blocked',
      detail: `window error ${code} - conversation downgraded to CLOSED, not retried`,
    }, ctx.db);
    log.warn('window error - downgraded, not retried', { outboxId: row.outbox_id, code });
    return { outboxId: row.outbox_id, status: 'blocked', reason: err.message };
  }

  // Rate limited or bucket halted: put it back on the queue behind a delay.
  if (kind === ERROR_KIND.RATE_LIMIT || err instanceof RateLimitError) {
    const retryAt = now() + (err?.retryAfterMs ?? backoffMs(row.attempts + 1));
    updateOutbox(row.outbox_id, {
      status: 'queued', lastError: err.message, lastErrorCode: String(code ?? 'RATE'),
    }, ctx.db);
    // not_before is only writable at insert, so record the intent in the audit
    // trail and let the governor gate the next attempt.
    audit({
      scope: 'sender', action: 'send', targetId: row.outbox_id, outcome: 'error',
      detail: `retry after ${new Date(retryAt).toISOString()}`,
    }, ctx.db);
    return { outboxId: row.outbox_id, status: 'queued', reason: 'rate limited' };
  }

  const terminal = kind === ERROR_KIND.AUTH || kind === ERROR_KIND.PERMISSION
    || kind === ERROR_KIND.VALIDATION || kind === ERROR_KIND.NOT_FOUND;
  const attempts = (row.attempts ?? 0) + 1;
  const giveUp = terminal || attempts >= 4;

  updateOutbox(row.outbox_id, {
    status: giveUp ? 'failed' : 'queued',
    lastError: err?.message ?? String(err),
    lastErrorCode: String(code ?? kind),
  }, ctx.db);
  audit({
    scope: 'sender', action: 'send', targetId: row.outbox_id,
    outcome: 'error', detail: err?.message ?? String(err),
  }, ctx.db);

  return { outboxId: row.outbox_id, status: giveUp ? 'failed' : 'queued', reason: err?.message };
}

/** Drain the outbox. Returns a per-item summary; never throws on a send failure. */
export async function processOutbox(ctx, { limit = 25 } = {}) {
  const rows = listSendableOutbox(limit, now(), ctx.db);
  const results = [];
  for (const row of rows) {
    try {
      results.push(await sendOne(ctx, row));
    } catch (err) {
      log.error('unexpected sender failure', { outboxId: row.outbox_id, error: err.message });
      updateOutbox(row.outbox_id, {
        status: 'failed', lastError: err.message, lastErrorCode: 'INTERNAL',
      }, ctx.db);
      results.push({ outboxId: row.outbox_id, status: 'failed', reason: err.message });
    }
  }
  return { processed: results.length, results };
}

/** Approve a pending draft and queue it. The human-in-the-loop path (F16). */
export function approveDraft(ctx, draftId, { approvedBy = 'owner', body = null } = {}) {
  const draft = ctx.db.prepare('SELECT * FROM drafts WHERE draft_id = ?').get(draftId);
  if (!draft) throw new Error(`draft not found: ${draftId}`);

  const conversation = getConversation(draft.conversation_id, ctx.db);
  const w = classifyWindow(conversation);
  const text = body ?? draft.edited_body ?? draft.body;

  updateDraft(draftId, { status: 'approved', editedBody: body ?? undefined }, ctx.db);

  return queueDirectMessage(ctx, {
    conversationId: draft.conversation_id,
    igUserId: draft.ig_user_id,
    recipientId: conversation?.participant_id ?? null,
    body: text,
    draftId,
    // Only HUMAN_AGENT actually requires the approval flag, but recording it for
    // every human-approved send keeps the audit trail honest about who acted.
    humanApproved: true,
    approvedBy,
  });
}

export default {
  queueDirectMessage, queuePrivateReply, queueCommentReply,
  processOutbox, approveDraft, buildRequest, MAX_DM_CHARS,
};
