/**
 * A2 - Account & Profile Sync.
 *
 * A nightly snapshot of the account: profile fields plus the account-level
 * insights Meta still exposes, written to `account_metrics` one row per day and
 * kept forever. Instagram itself keeps roughly 90 days; the whole value of F36
 * and F37 is that we do not throw it away.
 *
 * Pure read. About ten API calls a night.
 */
import { fetchInsights } from './insights.js';
import { upsertAccount, upsertAccountMetrics, saveSyncState, getSyncState, audit } from '../store/repos.js';
import { now, day } from '../util/time.js';
import { logger } from '../util/logger.js';

const log = logger('collectors/profile');
export const COLLECTOR = 'profile';

export const PROFILE_FIELDS = [
  'user_id', 'username', 'name', 'account_type', 'followers_count',
  'follows_count', 'media_count', 'biography', 'profile_picture_url',
];

/** ARCHITECTURE section 6. `profile_views` was removed in April 2025 - not here. */
export const ACCOUNT_METRICS = [
  'reach', 'views', 'accounts_engaged', 'total_interactions',
  'follows_and_unfollows', 'profile_links_taps',
];

/** Audience breakdowns (F37). Optional - degrade quietly when unavailable. */
export const DEMOGRAPHIC_METRICS = ['engaged_audience_demographics', 'follower_demographics'];

export async function syncProfile(ctx, accountId, { date = day() } = {}) {
  const started = now();
  saveSyncState(COLLECTOR, accountId, { lastRunAt: started });

  try {
    const me = await ctx.graph.get('/me', { accountId, params: { fields: PROFILE_FIELDS.join(',') } });

    upsertAccount({
      igUserId: accountId,
      username: me.username,
      name: me.name,
      biography: me.biography,
      profilePictureUrl: me.profile_picture_url,
      accountType: me.account_type,
      followersCount: me.followers_count,
      followsCount: me.follows_count,
      mediaCount: me.media_count,
      lastSyncAt: now(),
    });

    const insights = await fetchInsights(ctx.graph, accountId, '/me/insights', ACCOUNT_METRICS, {
      period: 'day',
      metric_type: 'total_value',
    });

    // Demographics live on a different period/breakdown and fail independently.
    let demographics = null;
    const demoMissing = [];
    for (const metric of DEMOGRAPHIC_METRICS) {
      try {
        const res = await fetchInsights(ctx.graph, accountId, '/me/insights', [metric], {
          period: 'lifetime',
          metric_type: 'total_value',
          breakdown: 'city,age,gender',
          timeframe: 'this_month',
        });
        if (res.breakdowns?.[metric]) {
          demographics = { ...(demographics ?? {}), [metric]: res.breakdowns[metric] };
        } else {
          demoMissing.push(metric);
        }
      } catch (err) {
        log.warn('demographics unavailable', { metric, error: err.message });
        demoMissing.push(metric);
      }
    }

    const missing = [...insights.missing, ...demoMissing];

    upsertAccountMetrics(accountId, {
      followers_count: me.followers_count,
      follows_count: me.follows_count,
      media_count: me.media_count,
      reach: insights.values.reach,
      views: insights.values.views,
      accounts_engaged: insights.values.accounts_engaged,
      total_interactions: insights.values.total_interactions,
      follows_and_unfollows: insights.values.follows_and_unfollows,
      profile_links_taps: insights.values.profile_links_taps,
      demographics,
    }, missing, date);

    saveSyncState(COLLECTOR, accountId, {
      lastSuccessAt: now(), lastError: null, consecutiveErrors: 0, cursorTime: now(),
    });
    audit({ scope: 'collector', action: 'profile.sync', igUserId: accountId, outcome: 'ok',
      detail: { date, missingMetrics: missing } });
    log.info('profile synced', { accountId, username: me.username, missing: missing.length });

    return { accountId, username: me.username, date, missing, metrics: insights.values };
  } catch (err) {
    const prior = getSyncState(COLLECTOR, accountId);
    saveSyncState(COLLECTOR, accountId, {
      lastError: err.message, consecutiveErrors: (prior.consecutive_errors ?? 0) + 1,
    });
    audit({ scope: 'collector', action: 'profile.sync', igUserId: accountId, outcome: 'error',
      errorCode: err.kind ?? 'ERROR', detail: { error: err.message } });
    throw err;
  }
}
