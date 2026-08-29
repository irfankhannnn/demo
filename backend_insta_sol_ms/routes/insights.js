// Time-series endpoint, contract section 4 (JWT auth).

import express from 'express';
import { toDateKey } from '../services/normalise.js';
import { logger } from '../logger.js';
import * as defaultDb from '../services/dynamoService.js';

const log = logger.child({ module: 'routes/insights' });

// Contract fixes the metric vocabulary. `followers` maps onto the stored
// attribute name, which differs — keeping the mapping explicit means the API
// surface does not have to leak the table's column naming.
const METRICS = {
  followers: 'followersCount',
  reach: 'reach',
  views: 'views',
};

export function createInsightsRouter({ db = defaultDb } = {}) {
  const router = express.Router();

  // GET /insights/timeseries?metric=followers|reach|views&days=
  router.get('/timeseries', async (req, res) => {
    const metric = req.query.metric || 'followers';
    const attribute = METRICS[metric];
    if (!attribute) {
      return res.status(400).json({
        error: 'Bad Request',
        details: `Unknown metric: ${metric}. Expected one of ${Object.keys(METRICS).join(', ')}`,
      });
    }

    const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 30, 1), 365);
    const fromDate = toDateKey(Date.now() - days * 86400 * 1000);

    try {
      const devices = await db.listDevices(req.tenantId);
      const igUserIds = [...new Set(devices.map((d) => d.igUserId).filter(Boolean))];

      // An explicit igUserId narrows a multi-account tenant to one account, but
      // it is validated against the tenant's own devices first — otherwise it
      // would be a caller-supplied key reaching the table.
      const requested = req.query.igUserId;
      const targets = requested
        ? igUserIds.filter((id) => id === requested)
        : igUserIds;

      if (requested && targets.length === 0) {
        return res.status(404).json({ error: 'Not Found', details: 'Unknown Instagram account for this tenant' });
      }

      const sets = await Promise.all(
        targets.map((id) => db.listAccountSnapshots(req.tenantId, id, { fromDate }))
      );

      const byDate = new Map();
      for (const s of sets.flat()) {
        const value = s[attribute];
        if (value === null || value === undefined) continue;
        byDate.set(s.date, (byDate.get(s.date) || 0) + value);
      }

      const points = [...byDate.entries()]
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return res.json({ metric, days, fromDate, points });
    } catch (err) {
      log.error('insights.timeseries.failed', { message: err.message, metric });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to build time series' });
    }
  });

  return router;
}

export default createInsightsRouter;
