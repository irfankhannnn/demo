/**
 * A3 - Media & Reel Sync.
 *
 * Two passes:
 *   1. Discovery. Page /me/media newest-first and stop at the cursor time we
 *      already have. First run backfills everything, later runs fetch only what
 *      is new.
 *   2. Metrics. Refresh per-media insights for anything published in the last
 *      `refreshDays` (default 30) plus anything we have never measured.
 *
 * A missing metric is recorded, not thrown - see collectors/insights.js.
 */
import { fetchInsights } from './insights.js';
import {
  upsertMedia, upsertMediaMetrics, listRecentMedia, getSyncState, saveSyncState,
  recomputeMediaCounters, audit,
} from '../store/repos.js';
import { now, day, parseMetaTime, sleep } from '../util/time.js';
import { logger } from '../util/logger.js';

const log = logger('collectors/media');
export const COLLECTOR = 'media';

export const MEDIA_FIELDS = [
  'id', 'caption', 'media_type', 'media_product_type', 'permalink', 'thumbnail_url', 'timestamp',
];

/** ARCHITECTURE section 6. `impressions` and `plays` were removed April 2025. */
export const MEDIA_METRICS = ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions'];
/** Reels only; asked for separately so a feed post does not fail the batch. */
export const REEL_METRICS = ['ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'];

const isReel = (m) => (m.media_product_type ?? m.mediaProductType) === 'REELS';

export async function syncMedia(ctx, accountId, {
  maxPages = 10, refreshDays = 30, date = day(), fullBackfill = false,
} = {}) {
  const started = now();
  const state = getSyncState(COLLECTOR, accountId);
  saveSyncState(COLLECTOR, accountId, { lastRunAt: started });

  try {
    // ---- pass 1: discovery -------------------------------------------------
    const since = fullBackfill || !state.backfill_complete ? 0 : (state.cursor_time ?? 0);
    const { items, cursor } = await ctx.graph.paginate('/me/media', {
      accountId,
      params: { fields: MEDIA_FIELDS.join(','), limit: 50 },
      maxPages,
    });

    let newest = state.cursor_time ?? 0;
    let discovered = 0;
    for (const m of items) {
      const publishedAt = parseMetaTime(m.timestamp);
      if (publishedAt && publishedAt <= since && !fullBackfill) continue;
      upsertMedia({
        mediaId: String(m.id),
        igUserId: accountId,
        caption: m.caption ?? null,
        mediaType: m.media_type ?? null,
        mediaProductType: m.media_product_type ?? null,
        permalink: m.permalink ?? null,
        thumbnailUrl: m.thumbnail_url ?? null,
        publishedAt,
      });
      discovered += 1;
      if (publishedAt && publishedAt > newest) newest = publishedAt;
    }

    // ---- pass 2: metrics for the recent window -----------------------------
    const recent = listRecentMedia(accountId, refreshDays);
    const missingAll = new Set();
    let measured = 0;

    for (const row of recent) {
      try {
        const res = await fetchInsights(ctx.graph, accountId, `/${row.media_id}/insights`, MEDIA_METRICS);
        const values = { ...res.values };
        res.missing.forEach((m) => missingAll.add(m));

        if (isReel(row)) {
          const reels = await fetchInsights(ctx.graph, accountId, `/${row.media_id}/insights`, REEL_METRICS);
          reels.missing.forEach((m) => missingAll.add(m));
          if (reels.values.ig_reels_avg_watch_time != null) {
            values.avg_watch_time_ms = reels.values.ig_reels_avg_watch_time;
          }
          if (reels.values.ig_reels_video_view_total_time != null) {
            values.total_watch_time_ms = reels.values.ig_reels_video_view_total_time;
          }
        }

        upsertMediaMetrics(row.media_id, values, res.missing, date);
        measured += 1;
      } catch (err) {
        // One media failing must not abort the sync of the other 200.
        log.warn('media insights failed, continuing', { mediaId: row.media_id, error: err.message });
        audit({ scope: 'collector', action: 'media.insights', igUserId: accountId, outcome: 'error',
          subjectType: 'media', subjectId: row.media_id, detail: { error: err.message } });
      }
      await sleep(ctx.governor.pacing('graph_read'));
    }

    recomputeMediaCounters();
    saveSyncState(COLLECTOR, accountId, {
      cursor, cursorTime: newest || state.cursor_time, lastSuccessAt: now(), lastError: null,
      consecutiveErrors: 0, itemsSeen: (state.items_seen ?? 0) + discovered, backfillComplete: true,
    });
    audit({ scope: 'collector', action: 'media.sync', igUserId: accountId, outcome: 'ok',
      detail: { discovered, measured, missingMetrics: [...missingAll] } });
    log.info('media synced', { accountId, discovered, measured });

    return { accountId, discovered, measured, missing: [...missingAll] };
  } catch (err) {
    saveSyncState(COLLECTOR, accountId, {
      lastError: err.message, consecutiveErrors: (state.consecutive_errors ?? 0) + 1,
    });
    audit({ scope: 'collector', action: 'media.sync', igUserId: accountId, outcome: 'error',
      errorCode: err.kind ?? 'ERROR', detail: { error: err.message } });
    throw err;
  }
}
