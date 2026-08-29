/**
 * Shared insights fetcher with graceful metric degradation.
 *
 * Meta removed `impressions`, `plays` and `profile_views` in April 2025 and will
 * remove more. A metric disappearing must cost us that one number, never the
 * whole nightly sync - so when Graph rejects the request we drop the metrics it
 * named, record them in `missing_metrics`, and ask again for the rest.
 *
 * Returns { values, missing, attempts }.
 */
import { ERROR_KIND, extractBadMetrics } from '../runtime/errors.js';
import { logger } from '../util/logger.js';

const log = logger('collectors/insights');

/**
 * Flatten Graph's insights response into { metricName: number }.
 * Handles both the `total_value` shape and the older `values[]` timeseries.
 */
export function flattenInsights(payload) {
  const out = {};
  const breakdowns = {};
  for (const row of payload?.data ?? []) {
    const name = row.name;
    if (row.total_value && typeof row.total_value.value === 'number') {
      out[name] = row.total_value.value;
    } else if (Array.isArray(row.values) && row.values.length) {
      const last = row.values[row.values.length - 1];
      if (typeof last?.value === 'number') out[name] = last.value;
      else if (last?.value && typeof last.value === 'object') breakdowns[name] = last.value;
    }
    if (row.total_value?.breakdowns) breakdowns[name] = row.total_value.breakdowns;
  }
  return { values: out, breakdowns };
}

/**
 * @param {GraphClient} graph
 * @param {string} accountId
 * @param {string} path - '/me/insights' or '/<media-id>/insights'
 * @param {string[]} metrics
 * @param {object} extraParams
 */
export async function fetchInsights(graph, accountId, path, metrics, extraParams = {}) {
  let remaining = [...metrics];
  const missing = [];
  let attempts = 0;

  while (remaining.length > 0) {
    attempts += 1;
    try {
      const payload = await graph.get(path, {
        accountId,
        params: { metric: remaining.join(','), ...extraParams },
      });
      const { values, breakdowns } = flattenInsights(payload);
      // A metric that was accepted but came back empty still counts as missing
      // for reporting purposes - the console shows a gap, not a zero.
      for (const m of remaining) if (!(m in values) && !(m in breakdowns)) missing.push(m);
      return { values, breakdowns, missing, attempts };
    } catch (err) {
      const bad = err.kind === ERROR_KIND.METRIC_UNAVAILABLE || err.kind === ERROR_KIND.VALIDATION
        ? extractBadMetrics(err.message, remaining)
        : [];
      if (bad.length === 0) {
        if (err.kind === ERROR_KIND.METRIC_UNAVAILABLE || err.kind === ERROR_KIND.VALIDATION) {
          // Graph refused the set but did not name a culprit. Give up on this
          // group rather than fail the sync.
          log.warn('insights request refused, skipping the whole metric group', {
            path, metrics: remaining, error: err.message,
          });
          missing.push(...remaining);
          return { values: {}, breakdowns: {}, missing, attempts };
        }
        throw err;
      }
      log.warn('dropping metrics Meta no longer supports', { path, dropped: bad });
      missing.push(...bad);
      remaining = remaining.filter((m) => !bad.includes(m));
    }
  }
  return { values: {}, breakdowns: {}, missing, attempts };
}
