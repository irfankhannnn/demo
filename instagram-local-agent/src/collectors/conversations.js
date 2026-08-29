/**
 * A5 - DM inbox sync. Read-only.
 *
 * This is the collector that answers the original question behind the whole
 * project: reading DM history is NOT window-limited. Only sending is. So the
 * entire backlog - including threads months old that can never be auto-replied
 * to - is readable, indexable and countable from day one.
 *
 * First run backfills everything the API will hand over, paced. Later runs are
 * incremental from a stored cursor.
 */
import {
  upsertConversation, insertMessage, recomputeConversation, updateConversationWindow,
  setConversationUnanswered, getSyncState, saveSyncState, listAccounts, audit,
} from '../store/repos.js';
import { classifyWindow } from '../engine/windowClassifier.js';
import { now, parseMetaTime, sleep, jitter } from '../util/time.js';
import { logger } from '../util/logger.js';

const log = logger('collectors/conversations');
export const COLLECTOR = 'conversations';

export const CONVERSATION_FIELDS = ['id', 'updated_time', 'participants'];
export const MESSAGE_FIELDS = ['id', 'from', 'to', 'message', 'created_time'];

/**
 * Pick the other party out of a conversation's participant list.
 * Meta includes us in `participants`, so the account's own id is filtered out.
 */
export function pickParticipant(conversation = {}, selfIgId = null) {
  const list = conversation.participants?.data ?? [];
  const other = list.find((p) => String(p.id) !== String(selfIgId)) ?? list[0] ?? {};
  return { id: other.id ?? null, username: other.username ?? null };
}

/** Normalise one Meta message into the shape `messages` expects. */
export function toMessageRow(raw, { conversationId, igUserId, selfIgId }) {
  const fromId = raw?.from?.id ?? null;
  const direction = String(fromId) === String(selfIgId) ? 'out' : 'in';
  return {
    messageId: raw.id,
    conversationId,
    igUserId,
    direction,
    senderId: fromId,
    senderUsername: raw?.from?.username ?? null,
    recipientId: raw?.to?.data?.[0]?.id ?? null,
    text: raw.message ?? '',
    createdAt: parseMetaTime(raw.created_time) ?? now(),
    raw,
  };
}

/**
 * Sync conversations and their messages for one account.
 *
 * `fullBackfill` walks every page on the first run; afterwards only threads
 * whose updated_time is newer than the cursor are touched, which keeps the
 * steady-state poll to a handful of calls.
 */
export async function syncConversations(ctx, accountId, {
  maxPages = 20, messageLimit = 200, pageDelayMs = null,
} = {}) {
  const state = getSyncState(COLLECTOR, accountId, ctx.db) ?? {};
  const since = state.cursor ? Number(state.cursor) : null;
  const fullBackfill = !since;

  log.info(fullBackfill ? 'starting full DM backfill' : 'incremental DM sync', { accountId, since });

  let conversations = 0;
  let messages = 0;
  let newest = since ?? 0;
  let stop = false;

  try {
    const pages = ctx.graph.paginate('/me/conversations', {
      accountId,
      params: { platform: 'instagram', fields: CONVERSATION_FIELDS.join(',') },
      maxPages: fullBackfill ? maxPages : Math.min(maxPages, 5),
    });

    for await (const page of pages) {
      for (const conv of page ?? []) {
        const updatedAt = parseMetaTime(conv.updated_time) ?? now();
        newest = Math.max(newest, updatedAt);

        // Conversations come back newest-first, so once we reach one older than
        // the cursor every remaining thread is older too.
        if (since && updatedAt <= since) {
          stop = true;
          break;
        }

        const participant = pickParticipant(conv, accountId);
        upsertConversation({
          conversationId: conv.id,
          igUserId: accountId,
          participantId: participant.id,
          participantUsername: participant.username,
          firstSeenAt: now(),
          lastSyncedAt: now(),
        }, ctx.db);

        messages += await syncMessages(ctx, accountId, conv.id, { messageLimit });
        conversations += 1;

        if (pageDelayMs) await sleep(jitter(pageDelayMs));
      }
      if (stop) break;
    }

    saveSyncState(COLLECTOR, accountId, {
      cursor: String(newest || now()),
      lastRunAt: now(),
      lastOk: true,
      lastError: null,
    }, ctx.db);

    audit({
      scope: 'collector', action: COLLECTOR, targetId: accountId, outcome: 'ok',
      detail: `${conversations} conversations, ${messages} messages`,
    }, ctx.db);

    log.info('DM sync complete', { accountId, conversations, messages });
    return { conversations, messages, fullBackfill };
  } catch (err) {
    saveSyncState(COLLECTOR, accountId, { lastRunAt: now(), lastOk: false, lastError: err.message }, ctx.db);
    audit({ scope: 'collector', action: COLLECTOR, targetId: accountId, outcome: 'error', detail: err.message }, ctx.db);
    throw err;
  }
}

/** Pull one thread's messages, then recompute its counters and window state. */
export async function syncMessages(ctx, accountId, conversationId, { messageLimit = 200 } = {}) {
  const res = await ctx.graph.get(`/${conversationId}`, {
    accountId,
    params: { fields: `messages.limit(${messageLimit}){${MESSAGE_FIELDS.join(',')}}` },
  });

  const raws = res?.messages?.data ?? [];
  let inserted = 0;
  for (const raw of raws) {
    // insertMessage is INSERT OR IGNORE on the primary key, so re-syncing a
    // thread is idempotent and the backfill can safely overlap the cursor.
    const changed = insertMessage(
      toMessageRow(raw, { conversationId, igUserId: accountId, selfIgId: accountId }),
      ctx.db,
    );
    if (changed) inserted += 1;
  }

  recomputeConversation(conversationId, ctx.db);

  // Recompute the window from the freshly stored timestamps rather than trusting
  // whatever was there before - this is what moves a thread to CLOSED when its
  // 24h lapses, so the console stops offering a Send button on it.
  const conversation = ctx.db
    .prepare('SELECT * FROM conversations WHERE conversation_id = ?')
    .get(conversationId);
  if (conversation) {
    const w = classifyWindow(conversation);
    updateConversationWindow(conversationId, {
      windowState: w.state,
      windowExpiresAt: w.expiresAt,
    }, ctx.db);

    // Unanswered = their last message is newer than ours. Drives the missed-DM
    // rescue queue (F5).
    const unanswered = Boolean(conversation.last_inbound_at)
      && (!conversation.last_outbound_at || conversation.last_inbound_at > conversation.last_outbound_at);
    setConversationUnanswered(conversationId, unanswered, ctx.db);
  }

  return inserted;
}

/** Sync every connected account. */
export async function syncAllConversations(ctx, opts = {}) {
  const results = [];
  for (const acc of listAccounts(ctx.db)) {
    try {
      results.push({ accountId: acc.ig_user_id, ...(await syncConversations(ctx, acc.ig_user_id, opts)) });
    } catch (err) {
      log.error('conversation sync failed', { accountId: acc.ig_user_id, error: err.message });
      results.push({ accountId: acc.ig_user_id, error: err.message });
    }
  }
  return results;
}

export default { syncConversations, syncMessages, syncAllConversations, pickParticipant, toMessageRow };
