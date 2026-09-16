// Dashboard landing endpoint (JWT auth).
//
// One request, everything the first screen needs: headline counters plus a
// daily series. Assembling it server-side rather than letting the frontend
// fan out to five endpoints keeps the cold-start cost to one invocation.

import express from 'express';
import { toDateKey } from '../services/normalise.js';
import { logger } from '../logger.js';
import * as defaultDb from '../services/dynamoService.js';
import { publicAccount } from '../services/instagramService.js';

const log = logger.child({ module: 'routes/overview' });

const DEFAULT_DAYS = 30;

function daysAgoKey(days) {
  return toDateKey(Date.now() - days * 86400 * 1000);
}

export function createOverviewRouter({ db = defaultDb } = {}) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || DEFAULT_DAYS, 1), 90);
    const fromDate = daysAgoKey(days);

    try {
      const [accounts, enquiryPage, threads, media] = await Promise.all([
        db.listAccounts(req.tenantId),
        // 200 is the query cap; the counters are recent activity, not all-time.
        db.listEnquiries(req.tenantId, { limit: 200 }),
        db.listThreads(req.tenantId, {}),
        db.listMedia(req.tenantId),
      ]);

      const conversations = threads.filter((t) => (t.messageCount || 0) > 0);
      const enquiries = enquiryPage.items || [];
      const recentEnquiries = enquiries.filter((e) => String(e.createdAt || '').slice(0, 10) >= fromDate);

      const snapshotSets = await Promise.all(
        accounts.map((a) => db.listAccountSnapshots(req.tenantId, a.igUserId, { fromDate }))
      );
      const series = mergeSeries(snapshotSets.flat(), recentEnquiries);

      // Meta's own 30-day totals once a profile sync has stored them. Reach is
      // unique accounts, so summing the daily series would overcount it.
      const live = accounts.filter((a) => a.status !== 'disconnected');
      const measured = days === DEFAULT_DAYS ? live.filter((a) => a.insights30d) : [];
      const total = (key) =>
        measured.length > 0
          ? measured.reduce((sum, a) => sum + (a.insights30d[key] || 0), 0)
          : series.reduce((sum, p) => sum + (p[key] || 0), 0);

      return res.json({
        counters: {
          accounts: accounts.filter((a) => a.status === 'connected').length,
          accountsNeedingReconnect: accounts.filter((a) => a.status === 'reconnect_required').length,
          media: media.length,
          enquiries: recentEnquiries.length,
          hotEnquiries: recentEnquiries.filter((e) => e.temperature === 'hot').length,
          newEnquiries: recentEnquiries.filter((e) => e.status === 'new').length,
          threads: conversations.length,
          unansweredThreads: conversations.filter((t) => t.unanswered).length,
          followers: live.reduce((sum, a) => sum + (a.followersCount || 0), 0),
          reach: total('reach'),
          views: total('views'),
          accountsEngaged: total('accountsEngaged'),
          totalInteractions: total('totalInteractions'),
        },
        accounts: accounts.map((a) => publicAccount(a)),
        series,
        rangeDays: days,
        fromDate,
      });
    } catch (err) {
      log.error('overview.failed', { error: err.message });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to build overview' });
    }
  });

  return router;
}

/**
 * Collapses per-account daily snapshots and per-day enquiry counts into one
 * series. Followers are summed across accounts (two accounts, two audiences),
 * and so are the flow metrics.
 */
function mergeSeries(snapshots, enquiries = []) {
  const byDate = new Map();
  const row = (date) => {
    if (!byDate.has(date)) {
      byDate.set(date, { date, followers: 0, reach: 0, views: 0, accountsEngaged: 0, totalInteractions: 0, enquiries: 0 });
    }
    return byDate.get(date);
  };

  for (const s of snapshots) {
    const r = row(s.date);
    r.followers += s.followersCount || 0;
    r.reach += s.reach || 0;
    r.views += s.views || 0;
    r.accountsEngaged += s.accountsEngaged || 0;
    r.totalInteractions += s.totalInteractions || 0;
  }
  for (const e of enquiries) {
    const date = String(e.createdAt || '').slice(0, 10);
    if (date) row(date).enquiries += 1;
  }

  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export { mergeSeries };
export default createOverviewRouter;
