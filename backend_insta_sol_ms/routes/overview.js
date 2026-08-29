// Dashboard landing endpoint, contract section 4 (JWT auth).
//
// One request, everything the first screen needs: headline counters plus a
// 30-day series. Assembling it server-side rather than letting the frontend
// fan out to five endpoints keeps the cold-start cost to a single Lambda
// invocation.

import express from 'express';
import { toDateKey } from '../services/normalise.js';
import { logger } from '../logger.js';
import * as defaultDb from '../services/dynamoService.js';

const log = logger.child({ module: 'routes/overview' });

const DEFAULT_DAYS = 30;

function daysAgoKey(days) {
  return toDateKey(Date.now() - days * 86400 * 1000);
}

export function createOverviewRouter({ db = defaultDb } = {}) {
  const router = express.Router();

  // GET /overview
  router.get('/', async (req, res) => {
    const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || DEFAULT_DAYS, 1), 90);
    const fromDate = daysAgoKey(days);

    try {
      const [devices, enquiryPage, threads, media] = await Promise.all([
        db.listDevices(req.tenantId),
        // 200 is the query cap; the counters below are "recent activity", not
        // an all-time total, and the contract's dashboard only shows 30 days.
        db.listEnquiries(req.tenantId, { limit: 200 }),
        db.listThreads(req.tenantId, {}),
        db.listMedia(req.tenantId),
      ]);

      const enquiries = enquiryPage.items || [];
      const recentEnquiries = enquiries.filter((e) => String(e.createdAt || '').slice(0, 10) >= fromDate);

      // The account series comes from whichever device actually holds an IG
      // account. Multiple laptops for one account is normal (owner + manager),
      // so dedupe by igUserId before querying.
      const igUserIds = [...new Set(devices.map((d) => d.igUserId).filter(Boolean))];
      const snapshotSets = await Promise.all(
        igUserIds.map((id) => db.listAccountSnapshots(req.tenantId, id, { fromDate }))
      );

      const series = mergeAccountSeries(snapshotSets.flat());

      return res.json({
        counters: {
          devices: devices.length,
          activeDevices: devices.filter((d) => d.status === 'active').length,
          accounts: igUserIds.length,
          media: media.length,
          enquiries: recentEnquiries.length,
          hotEnquiries: recentEnquiries.filter((e) => e.temperature === 'hot').length,
          newEnquiries: recentEnquiries.filter((e) => e.status === 'new').length,
          threads: threads.length,
          unansweredThreads: threads.filter((t) => t.unanswered).length,
        },
        series,
        rangeDays: days,
        fromDate,
      });
    } catch (err) {
      log.error('overview.failed', { message: err.message });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to build overview' });
    }
  });

  return router;
}

/**
 * Collapses per-account daily snapshots into one series.
 *
 * Followers are summed across accounts (two accounts, two audiences), and so
 * are the flow metrics. A tenant with a single account — the overwhelming
 * majority — gets its numbers back unchanged.
 */
function mergeAccountSeries(snapshots) {
  const byDate = new Map();

  for (const s of snapshots) {
    const row = byDate.get(s.date) || {
      date: s.date,
      followersCount: 0,
      reach: 0,
      views: 0,
      accountsEngaged: 0,
      totalInteractions: 0,
      profileLinksTaps: 0,
    };
    row.followersCount += s.followersCount || 0;
    row.reach += s.reach || 0;
    row.views += s.views || 0;
    row.accountsEngaged += s.accountsEngaged || 0;
    row.totalInteractions += s.totalInteractions || 0;
    row.profileLinksTaps += s.profileLinksTaps || 0;
    byDate.set(s.date, row);
  }

  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export { mergeAccountSeries };
export default createOverviewRouter;
