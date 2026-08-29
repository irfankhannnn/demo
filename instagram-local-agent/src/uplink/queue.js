/**
 * A9 - Offline upload queue.
 *
 * The local SQLite DB is the source of truth; the cloud copy is a projection.
 * So an upload failure is never data loss - it is a queued row that will go out
 * later. A laptop shut for a week catches up on its own, and a laptop that dies
 * is a re-sync, not an incident.
 *
 * Everything bound for the cloud goes through enqueue-then-flush rather than a
 * direct call, so there is exactly one retry policy and one place where the
 * ordering guarantees live.
 */
import {
  enqueueUpload, listDueUploads, completeUpload, failUpload, uploadQueueDepth,
  listEnquiriesPendingUpload, markEnquiriesUploaded, listAccounts, accountTimeseries,
  listMedia, listConversations, replaceRules, audit, summary,
} from '../store/repos.js';
import { UplinkClient, UplinkError, isPaired } from './client.js';
import { backoffMs } from '../runtime/errors.js';
import { now } from '../util/time.js';
import { logger } from '../util/logger.js';

const log = logger('uplink/queue');

/** Max rows per upload. Matches the backend's documented 500-item cap. */
export const BATCH_LIMIT = 500;

const ENDPOINTS = {
  snapshot: '/agent/snapshot',
  enquiries: '/agent/enquiries',
  threads: '/agent/threads',
  heartbeat: '/agent/heartbeat',
};

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Building payloads from local state
// ---------------------------------------------------------------------------

/** Account + media metrics for the CRM dashboard (F29, F36). */
export function buildSnapshotPayload(ctx, { days = 30 } = {}) {
  const accounts = listAccounts(ctx.db).map((a) => ({
    igUserId: a.ig_user_id,
    username: a.username,
    followersCount: a.followers_count,
    followsCount: a.follows_count,
    mediaCount: a.media_count,
    tokenExpiresAt: a.token_expires_at,
    status: a.status,
    series: accountTimeseries(a.ig_user_id, days, ctx.db).map((r) => ({
      date: r.date,
      followersCount: r.followers_count,
      reach: r.reach,
      views: r.views,
      accountsEngaged: r.accounts_engaged,
      totalInteractions: r.total_interactions,
    })),
  }));

  const media = [];
  for (const a of accounts) {
    for (const m of listMedia(a.igUserId, 200, ctx.db)) {
      media.push({
        mediaId: m.media_id,
        igUserId: m.ig_user_id,
        caption: m.caption,
        mediaType: m.media_type,
        mediaProductType: m.media_product_type,
        permalink: m.permalink,
        thumbnailUrl: m.thumbnail_url,
        publishedAt: m.published_at,
        views: m.views,
        reach: m.reach,
        likes: m.likes,
        comments: m.comments,
        saved: m.saved,
        shares: m.shares,
        totalInteractions: m.total_interactions,
        commentCount: m.comment_count,
        dmCount: m.dm_count,
        enquiryCount: m.enquiry_count,
      });
    }
  }

  return { accounts, media };
}

/** Thread-level stats only. Message BODIES never leave the laptop. */
export function buildThreadsPayload(ctx, { limit = BATCH_LIMIT } = {}) {
  return {
    threads: listConversations({ limit }, ctx.db).map((c) => ({
      conversationId: c.conversation_id,
      igUserId: c.ig_user_id,
      participantId: c.participant_id,
      participantUsername: c.participant_username,
      messageCount: c.message_count,
      lastInboundAt: c.last_inbound_at,
      lastOutboundAt: c.last_outbound_at,
      windowState: c.window_state,
      unanswered: Boolean(c.unanswered),
      firstSeenAt: c.first_seen_at,
      sourceMediaId: c.source_media_id,
    })),
  };
}

export function buildEnquiriesPayload(ctx, { limit = BATCH_LIMIT } = {}) {
  const rows = listEnquiriesPendingUpload(limit, ctx.db);
  return {
    ids: rows.map((r) => r.enquiry_id),
    payload: {
      enquiries: rows.map((r) => ({
        enquiryId: r.enquiry_id,
        igUserId: r.ig_user_id,
        conversationId: r.conversation_id,
        igSenderId: r.ig_sender_id,
        igUsername: r.ig_username,
        name: r.name,
        phone: r.phone,
        intent: r.intent,
        budgetMin: r.budget_min,
        budgetMax: r.budget_max,
        budgetBracket: r.budget_bracket,
        preferredArea: r.preferred_area,
        temperature: r.temperature,
        score: r.score,
        sourceMediaId: r.source_media_id,
        status: r.status,
        createdAt: r.created_at,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

export function queueSnapshot(ctx, opts = {}) {
  const payload = buildSnapshotPayload(ctx, opts);
  if (!payload.accounts.length) return null;
  return enqueueUpload({ endpoint: ENDPOINTS.snapshot, payload, idempotencyKey: `snapshot:${new Date().toISOString().slice(0, 10)}` }, ctx.db);
}

export function queueThreads(ctx, opts = {}) {
  const payload = buildThreadsPayload(ctx, opts);
  if (!payload.threads.length) return null;
  return enqueueUpload({ endpoint: ENDPOINTS.threads, payload }, ctx.db);
}

/**
 * Enqueue pending enquiries and mark them uploaded optimistically.
 *
 * Marking before the flush is deliberate: the queue row is durable in the same
 * SQLite file, so the work cannot be lost, and it stops the next tick from
 * enqueueing the same enquiries twice. The backend is idempotent on enquiryId,
 * so a genuine double-send is harmless anyway.
 */
export function queueEnquiries(ctx, opts = {}) {
  const { ids, payload } = buildEnquiriesPayload(ctx, opts);
  if (!ids.length) return null;
  const queued = [];
  for (const batch of chunk(payload.enquiries, 100)) {
    queued.push(enqueueUpload({ endpoint: ENDPOINTS.enquiries, payload: { enquiries: batch } }, ctx.db));
  }
  markEnquiriesUploaded(ids, ctx.db);
  return queued;
}

// ---------------------------------------------------------------------------
// Flush
// ---------------------------------------------------------------------------

/** Send everything due. Never throws on a transport error - that is the point. */
export async function flush(ctx, { limit = 20, client = null } = {}) {
  if (!isPaired()) {
    log.debug('not paired - nothing to flush');
    return { sent: 0, failed: 0, skipped: 'not_paired' };
  }

  const uplink = client ?? new UplinkClient({ config: ctx.config });
  const due = listDueUploads(limit, now(), ctx.db);
  let sent = 0;
  let failed = 0;

  for (const row of due) {
    // listDueUploads already parses the payload column, so this must NOT parse
    // again - JSON.parse on an object would stringify it to "[object Object]"
    // and throw, killing every queued upload as "corrupt".
    const { payload } = row;
    if (payload == null) {
      failUpload(row.id, { error: 'corrupt payload', statusCode: 0, dead: true }, ctx.db);
      failed += 1;
      continue;
    }

    try {
      await uplink.request(row.method ?? 'POST', row.endpoint, payload);
      completeUpload(row.id, 200, ctx.db);
      sent += 1;
    } catch (err) {
      const attempts = (row.attempts ?? 0) + 1;
      const status = err instanceof UplinkError ? err.status : 0;
      const retryable = err instanceof UplinkError ? err.retryable : true;
      // Give up after 8 tries (~2h of backoff) or on a non-retryable 4xx.
      const dead = !retryable || attempts >= 8;

      failUpload(row.id, {
        error: err.message,
        statusCode: status,
        nextAttemptAt: now() + backoffMs(attempts),
        dead,
      }, ctx.db);
      failed += 1;
      log.warn('upload failed', { id: row.id, endpoint: row.endpoint, status, attempts, dead });
    }
  }

  if (sent || failed) {
    audit({ scope: 'uplink', action: 'flush', outcome: failed ? 'error' : 'ok', detail: `sent=${sent} failed=${failed}` }, ctx.db);
  }
  return { sent, failed, depth: uploadQueueDepth(ctx.db) };
}

/** Heartbeat + rule pull. Sent live rather than queued - both are worthless stale. */
export async function heartbeat(ctx, { client = null, agentVersion = '0.1.0' } = {}) {
  if (!isPaired()) return { skipped: 'not_paired' };
  const uplink = client ?? new UplinkClient({ config: ctx.config });
  const accounts = listAccounts(ctx.db);
  const primary = accounts[0] ?? {};

  const res = await uplink.heartbeat({
    igUserId: primary.ig_user_id ?? null,
    igUsername: primary.username ?? null,
    agentVersion,
    tokenExpiresAt: primary.token_expires_at ?? null,
    counters: summary(ctx.db),
  });

  // The fleet-wide emergency brake: the server can tell every paired laptop to
  // stop, without anyone touching the laptops.
  if (res?.killSwitch) {
    log.warn('server engaged the kill switch');
  }
  return res;
}

export async function pullRules(ctx, { client = null } = {}) {
  if (!isPaired()) return { skipped: 'not_paired' };
  const uplink = client ?? new UplinkClient({ config: ctx.config });
  const res = await uplink.fetchRules();
  const rules = res?.rules ?? [];
  replaceRules(rules, 'cloud', ctx.db);
  log.info('rules pulled', { count: rules.length });
  return { count: rules.length };
}

export default {
  queueSnapshot, queueThreads, queueEnquiries, flush, heartbeat, pullRules,
  buildSnapshotPayload, buildThreadsPayload, buildEnquiriesPayload, BATCH_LIMIT,
};
