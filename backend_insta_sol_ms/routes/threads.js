// DM thread inbox, contract section 4 (JWT auth).

import express from 'express';
import { WINDOW_STATES } from '../services/normalise.js';
import { logger } from '../logger.js';
import * as defaultDb from '../services/dynamoService.js';

const log = logger.child({ module: 'routes/threads' });

export function createThreadsRouter({ db = defaultDb } = {}) {
  const router = express.Router();

  // GET /threads?windowState=&unanswered=
  router.get('/', async (req, res) => {
    const { windowState, unanswered, limit } = req.query;

    if (windowState && !WINDOW_STATES.has(windowState)) {
      return res.status(400).json({ error: 'Bad Request', details: `Unknown windowState: ${windowState}` });
    }

    // Tri-state on purpose: absent means "no filter", which is different from
    // unanswered=false meaning "only the answered ones".
    let unansweredFilter;
    if (unanswered !== undefined) unansweredFilter = unanswered === 'true' || unanswered === '1';

    try {
      const threads = await db.listThreads(req.tenantId, {
        windowState,
        unanswered: unansweredFilter,
        limit: Math.min(Number.parseInt(limit, 10) || 200, 500),
      });

      // Most recent inbound first — the inbox is worked newest-down.
      threads.sort((a, b) => String(b.lastInboundAt || '').localeCompare(String(a.lastInboundAt || '')));

      return res.json({
        threads,
        counts: {
          total: threads.length,
          unanswered: threads.filter((t) => t.unanswered).length,
        },
      });
    } catch (err) {
      log.error('threads.list.failed', { message: err.message });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to list threads' });
    }
  });

  return router;
}

export default createThreadsRouter;
