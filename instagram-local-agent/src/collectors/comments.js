/**
 * A4 - Comment Watcher. The lead engine.
 *
 * Polls comments on recent media, matches them against the keyword rules pulled
 * from the CRM, and for a match queues two things:
 *
 *   1. a public reply on the comment      ("DM kiya hai!") - looks responsive
 *   2. a private reply that opens a real DM thread - legal for 7 days after the
 *      comment, and the officially blessed comment-to-DM path
 *
 * Both go through `engine/sender.js`, so both pass the window classifier. This
 * collector never sends anything itself.
 */
import {
  upsertComment, setCommentState, listRecentMedia, listEnabledRules, getComment,
  getSyncState, saveSyncState, audit,
} from '../store/repos.js';
import { queueCommentReply, queuePrivateReply } from '../engine/sender.js';
import { COMMENT_REPLY_WINDOW_MS } from '../engine/windowClassifier.js';
import { now, parseMetaTime, sleep } from '../util/time.js';
import { logger } from '../util/logger.js';

const log = logger('collectors/comments');
export const COLLECTOR = 'comments';

export const COMMENT_FIELDS = ['id', 'text', 'timestamp', 'username', 'from', 'parent_id', 'hidden'];

/**
 * Does `text` match `rule`? Case-insensitive, whitespace-tolerant.
 * Exported because the console previews rules against real comments.
 */
export function matchesRule(text, rule) {
  if (!text) return false;
  const t = String(text).toLowerCase().trim();
  const k = String(rule.keyword ?? '').toLowerCase().trim();
  if (!k) return false;
  switch (rule.match_type ?? rule.matchType ?? 'contains') {
    case 'exact':      return t === k;
    case 'startswith': return t.startsWith(k);
    case 'regex':
      try {
        return new RegExp(rule.keyword, 'i').test(text);
      } catch {
        log.warn('rule has an invalid regex, skipping', { ruleId: rule.rule_id ?? rule.ruleId });
        return false;
      }
    case 'contains':
    default: {
      // Word-ish containment so "PRICE" does not fire on "priceless".
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`, 'iu');
      return re.test(t);
    }
  }
}

function ruleAppliesToMedia(rule, mediaId) {
  const scope = rule.media_scope ?? rule.mediaScope ?? 'all';
  if (!scope || scope === 'all') return true;
  return scope.split(',').map((s) => s.trim()).includes(mediaId);
}

/** First matching rule in priority order, or null. */
export function findRule(text, mediaId, rules) {
  return rules.find((r) => ruleAppliesToMedia(r, mediaId) && matchesRule(text, r)) ?? null;
}

export async function syncComments(ctx, accountId, { lookbackDays = 7, maxPages = 5 } = {}) {
  const started = now();
  const state = getSyncState(COLLECTOR, accountId);
  saveSyncState(COLLECTOR, accountId, { lastRunAt: started });

  try {
    const rules = listEnabledRules();
    // Only media inside the private-reply window is worth watching: a comment
    // older than 7 days can no longer legally open a DM.
    const media = listRecentMedia(accountId, lookbackDays);
    const since = state.cursor_time ?? 0;

    let seen = 0;
    let matched = 0;
    let queued = 0;
    let newest = since;

    for (const m of media) {
      let items = [];
      try {
        const page = await ctx.graph.paginate(`/${m.media_id}/comments`, {
          accountId,
          params: { fields: COMMENT_FIELDS.join(','), limit: 50 },
          maxPages,
        });
        items = page.items;
      } catch (err) {
        log.warn('comment fetch failed, continuing', { mediaId: m.media_id, error: err.message });
        audit({ scope: 'collector', action: 'comments.fetch', igUserId: accountId, outcome: 'error',
          subjectType: 'media', subjectId: m.media_id, detail: { error: err.message } });
        continue;
      }

      for (const c of items) {
        const createdAt = parseMetaTime(c.timestamp) ?? now();
        const commentId = String(c.id);
        const fromId = c.from?.id ?? null;
        const fromUsername = c.from?.username ?? c.username ?? null;

        const rule = findRule(c.text, m.media_id, rules);
        const isNew = upsertComment({
          commentId,
          mediaId: m.media_id,
          igUserId: accountId,
          parentId: c.parent_id ?? null,
          fromId,
          fromUsername,
          text: c.text ?? null,
          matchedRuleId: rule?.rule_id ?? null,
          hidden: c.hidden ? 1 : 0,
          createdAt,
        });
        seen += 1;
        if (createdAt > newest) newest = createdAt;

        if (!rule) continue;
        matched += 1;

        // Only act on comments we have not acted on, and only inside the window.
        const stored = getComment(commentId);
        if (stored?.private_reply_state !== 'none') continue;
        if (now() - createdAt > COMMENT_REPLY_WINDOW_MS) {
          setCommentState(commentId, { privateReplyState: 'expired' });
          continue;
        }
        // Our own comments never trigger the engine.
        if (fromId && String(fromId) === String(accountId)) continue;

        if (rule.public_reply) {
          queueCommentReply({
            igUserId: accountId, commentId, body: rule.public_reply, ruleId: rule.rule_id,
          });
          setCommentState(commentId, { publicReplyState: 'pending' });
          queued += 1;
        }
        if (rule.dm_message) {
          queuePrivateReply({
            igUserId: accountId,
            commentId,
            commentCreatedAt: createdAt,
            recipientId: fromId,
            body: rule.dm_message,
            ruleId: rule.rule_id,
            sourceMediaId: m.media_id,
            participantUsername: fromUsername,
          });
          setCommentState(commentId, { privateReplyState: 'pending' });
          queued += 1;
        }
        if (!isNew) log.debug('re-matched an existing comment', { commentId });
      }
      await sleep(ctx.governor.pacing('graph_read'));
    }

    saveSyncState(COLLECTOR, accountId, {
      cursorTime: newest, lastSuccessAt: now(), lastError: null, consecutiveErrors: 0,
      itemsSeen: (state.items_seen ?? 0) + seen, backfillComplete: true,
    });
    audit({ scope: 'collector', action: 'comments.sync', igUserId: accountId, outcome: 'ok',
      detail: { seen, matched, queued } });
    log.info('comments synced', { accountId, seen, matched, queued });

    return { accountId, seen, matched, queued };
  } catch (err) {
    saveSyncState(COLLECTOR, accountId, {
      lastError: err.message, consecutiveErrors: (state.consecutive_errors ?? 0) + 1,
    });
    audit({ scope: 'collector', action: 'comments.sync', igUserId: accountId, outcome: 'error',
      errorCode: err.kind ?? 'ERROR', detail: { error: err.message } });
    throw err;
  }
}
