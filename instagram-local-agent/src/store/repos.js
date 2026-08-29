/**
 * Repository layer: every SQL statement in the agent lives here.
 *
 * Collectors, the engine, the console and the uplink all go through these
 * functions, which keeps the query shapes in one place next to the indexes in
 * schema.js. Nothing else in the codebase writes SQL.
 */
import { getDb } from './db.js';
import { migrate, verifySchema } from './migrations.js';
import { now, day } from '../util/time.js';
import { uuid, stableId } from '../util/ids.js';

// Tracked per handle, not as a single boolean: closeDb() can be followed by a
// getDb() that opens a DIFFERENT file (a new IG_AGENT_HOME, a restored backup,
// or a fresh temp DB in a test). A module-level flag would then report that
// database as migrated when it has no tables at all, and every query after it
// fails with "no such table".
const migratedHandles = new WeakSet();

/** Open the singleton DB, migrating on first use of each handle. */
export function openStore() {
  const db = getDb();
  if (!migratedHandles.has(db)) {
    migrate(db);
    migratedHandles.add(db);
  }
  return db;
}

export function storeHealth(db = openStore()) {
  return verifySchema(db);
}

const json = (v) => (v == null ? null : JSON.stringify(v));
const unjson = (v) => {
  if (v == null) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// audit_log - F62. Everything the agent does lands here.
// ---------------------------------------------------------------------------

export function audit(entry, db = openStore()) {
  const {
    scope, action, actor = 'agent', igUserId = null, subjectType = null,
    subjectId = null, outcome = 'ok', httpStatus = null, errorCode = null, detail = null,
  } = entry;
  db.prepare(
    `INSERT INTO audit_log (ts, scope, action, actor, ig_user_id, subject_type, subject_id,
                            outcome, http_status, error_code, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(now(), scope, action, actor, igUserId, subjectType, subjectId, outcome, httpStatus, errorCode, json(detail));
}

export function listAudit({ limit = 100, scope = null, outcome = null } = {}, db = openStore()) {
  const where = [];
  const params = [];
  if (scope) { where.push('scope = ?'); params.push(scope); }
  if (outcome) { where.push('outcome = ?'); params.push(outcome); }
  const sql = `SELECT * FROM audit_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY ts DESC LIMIT ?`;
  return db.prepare(sql).all(...params, limit).map((r) => ({ ...r, detail: unjson(r.detail) }));
}

// ---------------------------------------------------------------------------
// accounts
// ---------------------------------------------------------------------------

export function upsertAccount(acc, db = openStore()) {
  const ts = now();
  db.prepare(
    `INSERT INTO accounts (ig_user_id, username, name, biography, profile_picture_url, account_type,
                           followers_count, follows_count, media_count, tenant_id, token_expires_at,
                           status, connected_at, last_sync_at, last_error, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(ig_user_id) DO UPDATE SET
       username            = COALESCE(excluded.username, accounts.username),
       name                = COALESCE(excluded.name, accounts.name),
       biography           = COALESCE(excluded.biography, accounts.biography),
       profile_picture_url = COALESCE(excluded.profile_picture_url, accounts.profile_picture_url),
       account_type        = COALESCE(excluded.account_type, accounts.account_type),
       followers_count     = COALESCE(excluded.followers_count, accounts.followers_count),
       follows_count       = COALESCE(excluded.follows_count, accounts.follows_count),
       media_count         = COALESCE(excluded.media_count, accounts.media_count),
       tenant_id           = COALESCE(excluded.tenant_id, accounts.tenant_id),
       token_expires_at    = COALESCE(excluded.token_expires_at, accounts.token_expires_at),
       status              = COALESCE(excluded.status, accounts.status),
       last_sync_at        = COALESCE(excluded.last_sync_at, accounts.last_sync_at),
       last_error          = excluded.last_error,
       updated_at          = excluded.updated_at`,
  ).run(
    acc.igUserId, acc.username ?? null, acc.name ?? null, acc.biography ?? null,
    acc.profilePictureUrl ?? null, acc.accountType ?? null,
    acc.followersCount ?? null, acc.followsCount ?? null, acc.mediaCount ?? null,
    acc.tenantId ?? null, acc.tokenExpiresAt ?? null, acc.status ?? 'connected',
    acc.connectedAt ?? ts, acc.lastSyncAt ?? null, acc.lastError ?? null, ts, ts,
  );
  return getAccount(acc.igUserId, db);
}

export const getAccount = (igUserId, db = openStore()) =>
  db.prepare('SELECT * FROM accounts WHERE ig_user_id = ?').get(igUserId) ?? null;

export const listAccounts = (db = openStore()) =>
  db.prepare('SELECT * FROM accounts ORDER BY created_at').all();

export function setAccountStatus(igUserId, status, lastError = null, db = openStore()) {
  db.prepare('UPDATE accounts SET status = ?, last_error = ?, updated_at = ? WHERE ig_user_id = ?')
    .run(status, lastError, now(), igUserId);
}

// ---------------------------------------------------------------------------
// tokens - rows only. Encryption/decryption is src/auth/vault.js.
// ---------------------------------------------------------------------------

export function saveTokenRow(row, db = openStore()) {
  const ts = now();
  db.prepare(
    `INSERT INTO tokens (ig_user_id, kind, alg, iv, tag, ciphertext, key_id, scopes,
                         issued_at, expires_at, refresh_after, last_refreshed_at,
                         refresh_failures, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(ig_user_id, kind) DO UPDATE SET
       alg = excluded.alg, iv = excluded.iv, tag = excluded.tag,
       ciphertext = excluded.ciphertext, key_id = excluded.key_id, scopes = excluded.scopes,
       issued_at = excluded.issued_at, expires_at = excluded.expires_at,
       refresh_after = excluded.refresh_after, last_refreshed_at = excluded.last_refreshed_at,
       refresh_failures = 0, updated_at = excluded.updated_at`,
  ).run(
    row.igUserId, row.kind ?? 'long_lived', row.alg ?? 'aes-256-gcm', row.iv, row.tag,
    row.ciphertext, row.keyId ?? null, row.scopes ?? null, row.issuedAt ?? ts,
    row.expiresAt ?? null, row.refreshAfter ?? null, row.lastRefreshedAt ?? null, 0, ts, ts,
  );
}

export const getTokenRow = (igUserId, kind = 'long_lived', db = openStore()) =>
  db.prepare('SELECT * FROM tokens WHERE ig_user_id = ? AND kind = ?').get(igUserId, kind) ?? null;

/** Tokens whose refresh_after has passed - the daily refresh check (A1). */
export const listTokensDueForRefresh = (at = now(), db = openStore()) =>
  db.prepare('SELECT * FROM tokens WHERE refresh_after IS NOT NULL AND refresh_after <= ?').all(at);

export function noteRefreshFailure(igUserId, kind = 'long_lived', db = openStore()) {
  db.prepare(
    'UPDATE tokens SET refresh_failures = refresh_failures + 1, updated_at = ? WHERE ig_user_id = ? AND kind = ?',
  ).run(now(), igUserId, kind);
}

export function deleteTokens(igUserId, db = openStore()) {
  db.prepare('DELETE FROM tokens WHERE ig_user_id = ?').run(igUserId);
}

// ---------------------------------------------------------------------------
// sync_state - the cursors that make every collector incremental
// ---------------------------------------------------------------------------

export function getSyncState(collector, igUserId, db = openStore()) {
  const row = db.prepare('SELECT * FROM sync_state WHERE collector = ? AND ig_user_id = ?')
    .get(collector, igUserId);
  if (!row) return { collector, ig_user_id: igUserId, cursor: null, cursor_time: null, state: null,
    backfill_complete: 0, items_seen: 0, consecutive_errors: 0 };
  return { ...row, state: unjson(row.state) };
}

export function saveSyncState(collector, igUserId, patch, db = openStore()) {
  const cur = getSyncState(collector, igUserId, db);
  const next = {
    cursor: patch.cursor !== undefined ? patch.cursor : cur.cursor,
    cursorTime: patch.cursorTime !== undefined ? patch.cursorTime : cur.cursor_time,
    lastRunAt: patch.lastRunAt !== undefined ? patch.lastRunAt : cur.last_run_at,
    lastSuccessAt: patch.lastSuccessAt !== undefined ? patch.lastSuccessAt : cur.last_success_at,
    lastError: patch.lastError !== undefined ? patch.lastError : cur.last_error,
    consecutiveErrors: patch.consecutiveErrors !== undefined ? patch.consecutiveErrors : cur.consecutive_errors,
    itemsSeen: patch.itemsSeen !== undefined ? patch.itemsSeen : cur.items_seen,
    backfillComplete: patch.backfillComplete !== undefined ? (patch.backfillComplete ? 1 : 0) : cur.backfill_complete,
    state: patch.state !== undefined ? patch.state : cur.state,
  };
  db.prepare(
    `INSERT INTO sync_state (collector, ig_user_id, cursor, cursor_time, last_run_at, last_success_at,
                             last_error, consecutive_errors, items_seen, backfill_complete, state, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(collector, ig_user_id) DO UPDATE SET
       cursor = excluded.cursor, cursor_time = excluded.cursor_time,
       last_run_at = excluded.last_run_at, last_success_at = excluded.last_success_at,
       last_error = excluded.last_error, consecutive_errors = excluded.consecutive_errors,
       items_seen = excluded.items_seen, backfill_complete = excluded.backfill_complete,
       state = excluded.state, updated_at = excluded.updated_at`,
  ).run(
    collector, igUserId, next.cursor, next.cursorTime, next.lastRunAt, next.lastSuccessAt,
    next.lastError, next.consecutiveErrors, next.itemsSeen, next.backfillComplete,
    json(next.state), now(),
  );
}

export const listSyncState = (db = openStore()) =>
  db.prepare('SELECT * FROM sync_state ORDER BY collector, ig_user_id').all();

// ---------------------------------------------------------------------------
// media + metrics (A3)
// ---------------------------------------------------------------------------

export function upsertMedia(m, db = openStore()) {
  const ts = now();
  db.prepare(
    `INSERT INTO media (media_id, ig_user_id, caption, media_type, media_product_type, permalink,
                        thumbnail_url, media_url, published_at, first_seen_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(media_id) DO UPDATE SET
       caption = COALESCE(excluded.caption, media.caption),
       media_type = COALESCE(excluded.media_type, media.media_type),
       media_product_type = COALESCE(excluded.media_product_type, media.media_product_type),
       permalink = COALESCE(excluded.permalink, media.permalink),
       thumbnail_url = COALESCE(excluded.thumbnail_url, media.thumbnail_url),
       media_url = COALESCE(excluded.media_url, media.media_url),
       published_at = COALESCE(excluded.published_at, media.published_at),
       updated_at = excluded.updated_at`,
  ).run(
    m.mediaId, m.igUserId, m.caption ?? null, m.mediaType ?? null, m.mediaProductType ?? null,
    m.permalink ?? null, m.thumbnailUrl ?? null, m.mediaUrl ?? null, m.publishedAt ?? null,
    ts, ts, ts,
  );
}

export function upsertMediaMetrics(mediaId, metrics, missing = [], date = day(), db = openStore()) {
  db.prepare(
    `INSERT INTO media_metrics (media_id, metric_date, views, reach, likes, comments, saved, shares,
                                total_interactions, avg_watch_time_ms, total_watch_time_ms,
                                missing_metrics, collected_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(media_id, metric_date) DO UPDATE SET
       views = COALESCE(excluded.views, media_metrics.views),
       reach = COALESCE(excluded.reach, media_metrics.reach),
       likes = COALESCE(excluded.likes, media_metrics.likes),
       comments = COALESCE(excluded.comments, media_metrics.comments),
       saved = COALESCE(excluded.saved, media_metrics.saved),
       shares = COALESCE(excluded.shares, media_metrics.shares),
       total_interactions = COALESCE(excluded.total_interactions, media_metrics.total_interactions),
       avg_watch_time_ms = COALESCE(excluded.avg_watch_time_ms, media_metrics.avg_watch_time_ms),
       total_watch_time_ms = COALESCE(excluded.total_watch_time_ms, media_metrics.total_watch_time_ms),
       missing_metrics = excluded.missing_metrics,
       collected_at = excluded.collected_at`,
  ).run(
    mediaId, date, metrics.views ?? null, metrics.reach ?? null, metrics.likes ?? null,
    metrics.comments ?? null, metrics.saved ?? null, metrics.shares ?? null,
    metrics.total_interactions ?? null, metrics.avg_watch_time_ms ?? null,
    metrics.total_watch_time_ms ?? null, json(missing.length ? missing : null), now(),
  );
  db.prepare('UPDATE media SET last_metrics_at = ?, updated_at = ? WHERE media_id = ?')
    .run(now(), now(), mediaId);
}

/** Media published inside `days` - the set A3 refreshes stats for. */
export const listRecentMedia = (igUserId, days = 30, db = openStore()) =>
  db.prepare('SELECT * FROM media WHERE ig_user_id = ? AND published_at >= ? ORDER BY published_at DESC')
    .all(igUserId, now() - days * 86400000);

export const listMedia = (igUserId, limit = 100, db = openStore()) =>
  db.prepare('SELECT * FROM media WHERE ig_user_id = ? ORDER BY published_at DESC LIMIT ?')
    .all(igUserId, limit);

export const getMedia = (mediaId, db = openStore()) =>
  db.prepare('SELECT * FROM media WHERE media_id = ?').get(mediaId) ?? null;

/**
 * Reel leaderboard (F29): ranked by enquiries, not views. Latest metric row per
 * media, joined onto the enquiry and comment counts we derived locally.
 */
export const leaderboard = (limit = 25, db = openStore()) =>
  db.prepare(
    `SELECT m.media_id, m.caption, m.permalink, m.media_product_type, m.published_at,
            m.comment_count, m.dm_count, m.enquiry_count,
            mm.views, mm.reach, mm.likes, mm.comments, mm.saved, mm.shares,
            (SELECT COUNT(*) FROM enquiries e
              WHERE e.source_media_id = m.media_id AND e.temperature = 'hot') AS hot_count
       FROM media m
       LEFT JOIN media_metrics mm
         ON mm.media_id = m.media_id
        AND mm.metric_date = (SELECT MAX(metric_date) FROM media_metrics x WHERE x.media_id = m.media_id)
      ORDER BY m.enquiry_count DESC, mm.views DESC
      LIMIT ?`,
  ).all(limit);

/** Recompute the derived counters the leaderboard reads. Cheap; run after a sync. */
export function recomputeMediaCounters(db = openStore()) {
  db.exec(`
    UPDATE media SET
      comment_count = (SELECT COUNT(*) FROM comments c WHERE c.media_id = media.media_id),
      dm_count      = (SELECT COUNT(*) FROM conversations cv WHERE cv.source_media_id = media.media_id),
      enquiry_count = (SELECT COUNT(*) FROM enquiries e WHERE e.source_media_id = media.media_id)`);
}

// ---------------------------------------------------------------------------
// account_metrics (A2)
// ---------------------------------------------------------------------------

export function upsertAccountMetrics(igUserId, metrics, missing = [], date = day(), db = openStore()) {
  db.prepare(
    `INSERT INTO account_metrics (ig_user_id, metric_date, followers_count, follows_count, media_count,
                                  reach, views, accounts_engaged, total_interactions,
                                  follows_and_unfollows, profile_links_taps, demographics,
                                  missing_metrics, collected_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(ig_user_id, metric_date) DO UPDATE SET
       followers_count = COALESCE(excluded.followers_count, account_metrics.followers_count),
       follows_count = COALESCE(excluded.follows_count, account_metrics.follows_count),
       media_count = COALESCE(excluded.media_count, account_metrics.media_count),
       reach = COALESCE(excluded.reach, account_metrics.reach),
       views = COALESCE(excluded.views, account_metrics.views),
       accounts_engaged = COALESCE(excluded.accounts_engaged, account_metrics.accounts_engaged),
       total_interactions = COALESCE(excluded.total_interactions, account_metrics.total_interactions),
       follows_and_unfollows = COALESCE(excluded.follows_and_unfollows, account_metrics.follows_and_unfollows),
       profile_links_taps = COALESCE(excluded.profile_links_taps, account_metrics.profile_links_taps),
       demographics = COALESCE(excluded.demographics, account_metrics.demographics),
       missing_metrics = excluded.missing_metrics,
       collected_at = excluded.collected_at`,
  ).run(
    igUserId, date, metrics.followers_count ?? null, metrics.follows_count ?? null,
    metrics.media_count ?? null, metrics.reach ?? null, metrics.views ?? null,
    metrics.accounts_engaged ?? null, metrics.total_interactions ?? null,
    metrics.follows_and_unfollows ?? null, metrics.profile_links_taps ?? null,
    json(metrics.demographics ?? null), json(missing.length ? missing : null), now(),
  );
}

export const accountTimeseries = (igUserId, days = 30, db = openStore()) =>
  db.prepare(
    `SELECT * FROM account_metrics WHERE ig_user_id = ? ORDER BY metric_date DESC LIMIT ?`,
  ).all(igUserId, days).reverse();

// ---------------------------------------------------------------------------
// conversations + messages (A5)
// ---------------------------------------------------------------------------

export function upsertConversation(c, db = openStore()) {
  const ts = now();
  db.prepare(
    `INSERT INTO conversations (conversation_id, ig_user_id, participant_id, participant_username,
                                message_count, last_inbound_at, last_outbound_at, last_comment_at,
                                last_comment_id, human_agent_until, window_state, window_expires_at,
                                unanswered, source_media_id, first_seen_at, last_synced_at,
                                created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(conversation_id) DO UPDATE SET
       participant_id = COALESCE(excluded.participant_id, conversations.participant_id),
       participant_username = COALESCE(excluded.participant_username, conversations.participant_username),
       message_count = COALESCE(excluded.message_count, conversations.message_count),
       last_inbound_at = MAX(COALESCE(excluded.last_inbound_at, 0), COALESCE(conversations.last_inbound_at, 0)),
       last_outbound_at = MAX(COALESCE(excluded.last_outbound_at, 0), COALESCE(conversations.last_outbound_at, 0)),
       last_comment_at = MAX(COALESCE(excluded.last_comment_at, 0), COALESCE(conversations.last_comment_at, 0)),
       last_comment_id = COALESCE(excluded.last_comment_id, conversations.last_comment_id),
       source_media_id = COALESCE(conversations.source_media_id, excluded.source_media_id),
       last_synced_at = excluded.last_synced_at,
       updated_at = excluded.updated_at`,
  ).run(
    c.conversationId, c.igUserId, c.participantId ?? null, c.participantUsername ?? null,
    c.messageCount ?? 0, c.lastInboundAt ?? null, c.lastOutboundAt ?? null, c.lastCommentAt ?? null,
    c.lastCommentId ?? null, c.humanAgentUntil ?? null, c.windowState ?? 'CLOSED',
    c.windowExpiresAt ?? null, c.unanswered ? 1 : 0, c.sourceMediaId ?? null,
    c.firstSeenAt ?? ts, ts, ts, ts,
  );
}

export const getConversation = (conversationId, db = openStore()) =>
  db.prepare('SELECT * FROM conversations WHERE conversation_id = ?').get(conversationId) ?? null;

export function updateConversationWindow(conversationId, { windowState, windowExpiresAt, humanAgentUntil }, db = openStore()) {
  db.prepare(
    `UPDATE conversations SET window_state = COALESCE(?, window_state),
                              window_expires_at = ?,
                              human_agent_until = COALESCE(?, human_agent_until),
                              updated_at = ?
      WHERE conversation_id = ?`,
  ).run(windowState ?? null, windowExpiresAt ?? null, humanAgentUntil ?? null, now(), conversationId);
}

export function setConversationUnanswered(conversationId, unanswered, db = openStore()) {
  db.prepare('UPDATE conversations SET unanswered = ?, updated_at = ? WHERE conversation_id = ?')
    .run(unanswered ? 1 : 0, now(), conversationId);
}

export function listConversations({ unanswered = null, windowState = null, limit = 100 } = {}, db = openStore()) {
  const where = [];
  const params = [];
  if (unanswered !== null) { where.push('unanswered = ?'); params.push(unanswered ? 1 : 0); }
  if (windowState) { where.push('window_state = ?'); params.push(windowState); }
  return db.prepare(
    `SELECT * FROM conversations ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY COALESCE(last_inbound_at, 0) DESC LIMIT ?`,
  ).all(...params, limit);
}

export function insertMessage(m, db = openStore()) {
  const res = db.prepare(
    `INSERT OR IGNORE INTO messages (message_id, conversation_id, ig_user_id, direction, sender_id,
                                     sender_username, recipient_id, text, attachments, is_story_reply,
                                     created_at, inserted_at, raw)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    m.messageId, m.conversationId, m.igUserId, m.direction, m.senderId ?? null,
    m.senderUsername ?? null, m.recipientId ?? null, m.text ?? null, json(m.attachments ?? null),
    m.isStoryReply ? 1 : 0, m.createdAt, now(), json(m.raw ?? null),
  );
  return Number(res.changes) > 0;
}

export const listMessages = (conversationId, limit = 200, db = openStore()) =>
  db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?')
    .all(conversationId, limit);

export const lastInboundMessage = (conversationId, db = openStore()) =>
  db.prepare(
    `SELECT * FROM messages WHERE conversation_id = ? AND direction = 'in'
      ORDER BY created_at DESC LIMIT 1`,
  ).get(conversationId) ?? null;

/** Recompute per-thread counters and the unanswered flag after a message sync. */
export function recomputeConversation(conversationId, db = openStore()) {
  const agg = db.prepare(
    `SELECT COUNT(*) AS n,
            MAX(CASE WHEN direction = 'in'  THEN created_at END) AS last_in,
            MAX(CASE WHEN direction = 'out' THEN created_at END) AS last_out
       FROM messages WHERE conversation_id = ?`,
  ).get(conversationId);
  const unanswered = agg.last_in && (!agg.last_out || agg.last_out < agg.last_in) ? 1 : 0;
  db.prepare(
    `UPDATE conversations SET message_count = ?, last_inbound_at = ?, last_outbound_at = ?,
                              unanswered = ?, updated_at = ?
      WHERE conversation_id = ?`,
  ).run(agg.n, agg.last_in ?? null, agg.last_out ?? null, unanswered, now(), conversationId);
  return { ...agg, unanswered };
}

// ---------------------------------------------------------------------------
// comments (A4)
// ---------------------------------------------------------------------------

export function upsertComment(c, db = openStore()) {
  const ts = now();
  const res = db.prepare(
    `INSERT INTO comments (comment_id, media_id, ig_user_id, parent_id, from_id, from_username, text,
                           matched_rule_id, public_reply_state, private_reply_state, conversation_id,
                           hidden, created_at, inserted_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(comment_id) DO UPDATE SET
       text = COALESCE(excluded.text, comments.text),
       matched_rule_id = COALESCE(excluded.matched_rule_id, comments.matched_rule_id),
       updated_at = excluded.updated_at`,
  ).run(
    c.commentId, c.mediaId, c.igUserId, c.parentId ?? null, c.fromId ?? null,
    c.fromUsername ?? null, c.text ?? null, c.matchedRuleId ?? null,
    c.publicReplyState ?? 'none', c.privateReplyState ?? 'none', c.conversationId ?? null,
    c.hidden ? 1 : 0, c.createdAt, ts, ts,
  );
  return Number(res.changes) > 0;
}

export const getComment = (commentId, db = openStore()) =>
  db.prepare('SELECT * FROM comments WHERE comment_id = ?').get(commentId) ?? null;

export function setCommentState(commentId, patch, db = openStore()) {
  db.prepare(
    `UPDATE comments SET
       public_reply_state  = COALESCE(?, public_reply_state),
       public_reply_id     = COALESCE(?, public_reply_id),
       private_reply_state = COALESCE(?, private_reply_state),
       private_reply_at    = COALESCE(?, private_reply_at),
       conversation_id     = COALESCE(?, conversation_id),
       matched_rule_id     = COALESCE(?, matched_rule_id),
       hidden              = COALESCE(?, hidden),
       updated_at          = ?
     WHERE comment_id = ?`,
  ).run(
    patch.publicReplyState ?? null, patch.publicReplyId ?? null,
    patch.privateReplyState ?? null, patch.privateReplyAt ?? null,
    patch.conversationId ?? null, patch.matchedRuleId ?? null,
    patch.hidden === undefined ? null : (patch.hidden ? 1 : 0), now(), commentId,
  );
}

/** Matched comments still owing a private reply, inside the 7-day window. */
export const listCommentsAwaitingPrivateReply = (limit = 50, db = openStore()) =>
  db.prepare(
    `SELECT * FROM comments
      WHERE private_reply_state IN ('none','pending')
        AND matched_rule_id IS NOT NULL
      ORDER BY created_at ASC LIMIT ?`,
  ).all(limit);

export const listComments = (mediaId, limit = 100, db = openStore()) =>
  db.prepare('SELECT * FROM comments WHERE media_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(mediaId, limit);

// ---------------------------------------------------------------------------
// enquiries (A8)
// ---------------------------------------------------------------------------

export function upsertEnquiry(e, db = openStore()) {
  const ts = now();
  // Duplicate detection (F14): the same person from three reels is one enquiry.
  const dedupeKey = e.dedupeKey ?? stableId('', e.igUserId, e.phone || e.igSenderId || e.conversationId || uuid());
  const existing = db.prepare('SELECT * FROM enquiries WHERE dedupe_key = ?').get(dedupeKey);
  const enquiryId = existing?.enquiry_id ?? e.enquiryId ?? stableId('enq', dedupeKey);

  db.prepare(
    `INSERT INTO enquiries (enquiry_id, ig_user_id, conversation_id, ig_sender_id, ig_username, name,
                            phone, phone_raw, intent, budget_min, budget_max, budget_bracket,
                            preferred_area, temperature, score, source_media_id, source_comment_id,
                            status, notes, extracted, extractor, confidence, dedupe_key,
                            upload_state, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(enquiry_id) DO UPDATE SET
       name = COALESCE(excluded.name, enquiries.name),
       phone = COALESCE(excluded.phone, enquiries.phone),
       phone_raw = COALESCE(excluded.phone_raw, enquiries.phone_raw),
       intent = CASE WHEN excluded.intent = 'unknown' THEN enquiries.intent ELSE excluded.intent END,
       budget_min = COALESCE(excluded.budget_min, enquiries.budget_min),
       budget_max = COALESCE(excluded.budget_max, enquiries.budget_max),
       budget_bracket = COALESCE(excluded.budget_bracket, enquiries.budget_bracket),
       preferred_area = COALESCE(excluded.preferred_area, enquiries.preferred_area),
       temperature = excluded.temperature,
       score = excluded.score,
       source_media_id = COALESCE(enquiries.source_media_id, excluded.source_media_id),
       extracted = excluded.extracted,
       extractor = excluded.extractor,
       confidence = excluded.confidence,
       upload_state = CASE WHEN enquiries.upload_state = 'uploaded' THEN 'pending' ELSE enquiries.upload_state END,
       updated_at = excluded.updated_at`,
  ).run(
    enquiryId, e.igUserId, e.conversationId ?? null, e.igSenderId ?? null, e.igUsername ?? null,
    e.name ?? null, e.phone ?? null, e.phoneRaw ?? null, e.intent ?? 'unknown',
    e.budgetMin ?? null, e.budgetMax ?? null, e.budgetBracket ?? null, e.preferredArea ?? null,
    e.temperature ?? 'cold', e.score ?? 0, e.sourceMediaId ?? null, e.sourceCommentId ?? null,
    e.status ?? 'new', e.notes ?? null, json(e.extracted ?? null), e.extractor ?? 'deterministic',
    e.confidence ?? null, dedupeKey, 'pending', ts, ts,
  );
  return getEnquiry(enquiryId, db);
}

export const getEnquiry = (enquiryId, db = openStore()) =>
  db.prepare('SELECT * FROM enquiries WHERE enquiry_id = ?').get(enquiryId) ?? null;

export function listEnquiries({ status = null, temperature = null, limit = 100 } = {}, db = openStore()) {
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (temperature) { where.push('temperature = ?'); params.push(temperature); }
  return db.prepare(
    `SELECT * FROM enquiries ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY created_at DESC LIMIT ?`,
  ).all(...params, limit).map((r) => ({ ...r, extracted: unjson(r.extracted) }));
}

export const listEnquiriesPendingUpload = (limit = 250, db = openStore()) =>
  db.prepare(`SELECT * FROM enquiries WHERE upload_state = 'pending' ORDER BY created_at LIMIT ?`).all(limit);

export function markEnquiriesUploaded(ids, db = openStore()) {
  const stmt = db.prepare(`UPDATE enquiries SET upload_state = 'uploaded', uploaded_at = ?, updated_at = ? WHERE enquiry_id = ?`);
  const ts = now();
  const run = db.transaction(() => ids.forEach((id) => stmt.run(ts, ts, id)));
  run();
}

export function updateEnquiry(enquiryId, patch, db = openStore()) {
  db.prepare(
    `UPDATE enquiries SET status = COALESCE(?, status), notes = COALESCE(?, notes),
                          upload_state = 'pending', updated_at = ?
      WHERE enquiry_id = ?`,
  ).run(patch.status ?? null, patch.notes ?? null, now(), enquiryId);
}

// ---------------------------------------------------------------------------
// drafts (A6)
// ---------------------------------------------------------------------------

export function insertDraft(d, db = openStore()) {
  const ts = now();
  const draftId = d.draftId ?? `dft_${uuid()}`;
  db.prepare(
    `INSERT INTO drafts (draft_id, conversation_id, ig_user_id, trigger_message_id, body, language,
                         category, drafter, model, rationale, confidence, auto_send_eligible,
                         status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    draftId, d.conversationId, d.igUserId, d.triggerMessageId ?? null, d.body,
    d.language ?? null, d.category ?? null, d.drafter ?? 'template', d.model ?? null,
    d.rationale ?? null, d.confidence ?? null, d.autoSendEligible ? 1 : 0, 'pending', ts, ts,
  );
  return getDraft(draftId, db);
}

export const getDraft = (draftId, db = openStore()) =>
  db.prepare('SELECT * FROM drafts WHERE draft_id = ?').get(draftId) ?? null;

export const listDrafts = ({ status = 'pending', limit = 100 } = {}, db = openStore()) =>
  db.prepare(
    `SELECT d.*, c.participant_username, c.window_state
       FROM drafts d LEFT JOIN conversations c ON c.conversation_id = d.conversation_id
      WHERE d.status = ? ORDER BY d.created_at ASC LIMIT ?`,
  ).all(status, limit);

export function updateDraft(draftId, patch, db = openStore()) {
  db.prepare(
    `UPDATE drafts SET status = COALESCE(?, status), edited_body = COALESCE(?, edited_body),
                       approved_by = COALESCE(?, approved_by), approved_at = COALESCE(?, approved_at),
                       outbox_id = COALESCE(?, outbox_id), updated_at = ?
      WHERE draft_id = ?`,
  ).run(
    patch.status ?? null, patch.editedBody ?? null, patch.approvedBy ?? null,
    patch.approvedAt ?? null, patch.outboxId ?? null, now(), draftId,
  );
}

/** Supersede older pending drafts on a thread when a newer inbound arrives. */
export function supersedePendingDrafts(conversationId, db = openStore()) {
  db.prepare(`UPDATE drafts SET status = 'superseded', updated_at = ? WHERE conversation_id = ? AND status = 'pending'`)
    .run(now(), conversationId);
}

// ---------------------------------------------------------------------------
// outbox (A7). Rows are created by engine/sender.js only.
// ---------------------------------------------------------------------------

export function insertOutbox(o, db = openStore()) {
  const ts = now();
  const outboxId = o.outboxId ?? `out_${uuid()}`;
  db.prepare(
    `INSERT INTO outbox (outbox_id, kind, ig_user_id, conversation_id, recipient_id, comment_id,
                         draft_id, body, attachments, window_state_at_queue, human_approved,
                         approved_by, approved_at, status, not_before, dry_run, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    outboxId, o.kind, o.igUserId, o.conversationId ?? null, o.recipientId ?? null,
    o.commentId ?? null, o.draftId ?? null, o.body, json(o.attachments ?? null),
    o.windowStateAtQueue ?? null, o.humanApproved ? 1 : 0, o.approvedBy ?? null,
    o.approvedAt ?? null, o.status ?? 'queued', o.notBefore ?? null, o.dryRun ? 1 : 0, ts, ts,
  );
  return getOutbox(outboxId, db);
}

export const getOutbox = (outboxId, db = openStore()) =>
  db.prepare('SELECT * FROM outbox WHERE outbox_id = ?').get(outboxId) ?? null;

export const listSendableOutbox = (limit = 50, at = now(), db = openStore()) =>
  db.prepare(
    `SELECT * FROM outbox WHERE status = 'queued' AND (not_before IS NULL OR not_before <= ?)
      ORDER BY created_at ASC LIMIT ?`,
  ).all(at, limit);

export function updateOutbox(outboxId, patch, db = openStore()) {
  db.prepare(
    `UPDATE outbox SET status = COALESCE(?, status),
                       attempts = attempts + ?,
                       last_error = ?,
                       last_error_code = ?,
                       window_state_at_send = COALESCE(?, window_state_at_send),
                       provider_message_id = COALESCE(?, provider_message_id),
                       sent_at = COALESCE(?, sent_at),
                       human_approved = COALESCE(?, human_approved),
                       approved_by = COALESCE(?, approved_by),
                       approved_at = COALESCE(?, approved_at),
                       updated_at = ?
      WHERE outbox_id = ?`,
  ).run(
    patch.status ?? null, patch.attemptDelta ?? 0, patch.lastError ?? null,
    patch.lastErrorCode ?? null, patch.windowStateAtSend ?? null, patch.providerMessageId ?? null,
    patch.sentAt ?? null,
    patch.humanApproved === undefined ? null : (patch.humanApproved ? 1 : 0),
    patch.approvedBy ?? null, patch.approvedAt ?? null, now(), outboxId,
  );
  return getOutbox(outboxId, db);
}

export const listOutbox = ({ status = null, limit = 100 } = {}, db = openStore()) =>
  db.prepare(
    `SELECT * FROM outbox ${status ? 'WHERE status = ?' : ''} ORDER BY created_at DESC LIMIT ?`,
  ).all(...(status ? [status] : []), limit);

// ---------------------------------------------------------------------------
// rules (A4)
// ---------------------------------------------------------------------------

export function replaceRules(rules, source = 'cloud', db = openStore()) {
  const ts = now();
  const del = db.prepare('DELETE FROM rules WHERE source = ?');
  const ins = db.prepare(
    `INSERT INTO rules (rule_id, keyword, match_type, public_reply, dm_message, media_scope,
                        enabled, priority, source, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const run = db.transaction(() => {
    del.run(source);
    for (const r of rules) {
      ins.run(
        r.ruleId ?? r.rule_id ?? stableId('rule', r.keyword), r.keyword,
        r.matchType ?? r.match_type ?? 'contains', r.publicReply ?? r.public_reply ?? null,
        r.dmMessage ?? r.dm_message ?? null, r.mediaScope ?? r.media_scope ?? 'all',
        (r.enabled ?? true) ? 1 : 0, r.priority ?? 100, source, ts, ts,
      );
    }
  });
  run();
  return rules.length;
}

export const listEnabledRules = (db = openStore()) =>
  db.prepare('SELECT * FROM rules WHERE enabled = 1 ORDER BY priority ASC, keyword ASC').all();

export const listRules = (db = openStore()) =>
  db.prepare('SELECT * FROM rules ORDER BY priority ASC, keyword ASC').all();

// ---------------------------------------------------------------------------
// upload_queue (A9)
// ---------------------------------------------------------------------------

export function enqueueUpload({ endpoint, payload, method = 'POST', idempotencyKey = null }, db = openStore()) {
  const ts = now();
  const key = idempotencyKey ?? stableId('up', endpoint, JSON.stringify(payload));
  const res = db.prepare(
    `INSERT OR IGNORE INTO upload_queue (endpoint, method, payload, idempotency_key, status,
                                         attempts, next_attempt_at, created_at, updated_at)
     VALUES (?,?,?,?, 'pending', 0, ?, ?, ?)`,
  ).run(endpoint, method, JSON.stringify(payload), key, ts, ts, ts);
  return { inserted: Number(res.changes) > 0, idempotencyKey: key };
}

export const listDueUploads = (limit = 20, at = now(), db = openStore()) =>
  db.prepare(
    `SELECT * FROM upload_queue WHERE status IN ('pending','failed') AND next_attempt_at <= ?
      ORDER BY next_attempt_at ASC, id ASC LIMIT ?`,
  ).all(at, limit).map((r) => ({ ...r, payload: unjson(r.payload) }));

export function completeUpload(id, statusCode, db = openStore()) {
  const ts = now();
  db.prepare(
    `UPDATE upload_queue SET status = 'done', completed_at = ?, last_status_code = ?, updated_at = ? WHERE id = ?`,
  ).run(ts, statusCode ?? null, ts, id);
}

export function failUpload(id, { error, statusCode, nextAttemptAt, dead = false }, db = openStore()) {
  db.prepare(
    `UPDATE upload_queue SET status = ?, attempts = attempts + 1, last_error = ?,
                             last_status_code = ?, next_attempt_at = ?, updated_at = ?
      WHERE id = ?`,
  ).run(dead ? 'dead' : 'failed', String(error ?? ''), statusCode ?? null, nextAttemptAt ?? now(), now(), id);
}

export const uploadQueueDepth = (db = openStore()) =>
  db.prepare(`SELECT status, COUNT(*) AS n FROM upload_queue GROUP BY status`).all();

// ---------------------------------------------------------------------------
// console summary
// ---------------------------------------------------------------------------

export function summary(db = openStore()) {
  const one = (sql, ...p) => db.prepare(sql).get(...p) ?? {};
  return {
    accounts: db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n,
    media: one('SELECT COUNT(*) AS n FROM media').n,
    conversations: one('SELECT COUNT(*) AS n FROM conversations').n,
    unanswered: one('SELECT COUNT(*) AS n FROM conversations WHERE unanswered = 1').n,
    messages: one('SELECT COUNT(*) AS n FROM messages').n,
    comments: one('SELECT COUNT(*) AS n FROM comments').n,
    enquiries: one('SELECT COUNT(*) AS n FROM enquiries').n,
    hotEnquiries: one(`SELECT COUNT(*) AS n FROM enquiries WHERE temperature = 'hot'`).n,
    pendingDrafts: one(`SELECT COUNT(*) AS n FROM drafts WHERE status = 'pending'`).n,
    queuedOutbox: one(`SELECT COUNT(*) AS n FROM outbox WHERE status = 'queued'`).n,
    blockedOutbox: one(`SELECT COUNT(*) AS n FROM outbox WHERE status = 'blocked'`).n,
    pendingUploads: one(`SELECT COUNT(*) AS n FROM upload_queue WHERE status IN ('pending','failed')`).n,
  };
}
