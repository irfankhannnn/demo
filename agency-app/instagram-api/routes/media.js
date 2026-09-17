// Reel leaderboard (JWT auth).

import express from 'express';
import { logger } from '../logger.js';
import * as defaultDb from '../services/dynamoService.js';

const log = logger.child({ module: 'routes/media' });

const SORTS = {
  // Default. The point of the product is "which reel produced leads", not
  // "which reel got views", so enquiries sorts first.
  enquiries: (a, b) => (b.enquiryCount || 0) - (a.enquiryCount || 0) || (b.metrics?.views || 0) - (a.metrics?.views || 0),
  views: (a, b) => (b.metrics?.views || 0) - (a.metrics?.views || 0),
};

/**
 * Enquiry, hot and DM counts per reel, derived from what is stored rather than
 * kept as counters that could drift. A thread is attributed to a reel when the
 * person commented on it before they messaged.
 */
async function attributionCounts(db, tenantId) {
  const [threads, enquiryPage] = await Promise.all([
    db.listThreads(tenantId, {}),
    db.listEnquiries(tenantId, { limit: 200 }),
  ]);
  const counts = new Map();
  const bump = (mediaId, field) => {
    if (!mediaId) return;
    const c = counts.get(mediaId) || { enquiryCount: 0, hotCount: 0, dmCount: 0 };
    c[field] += 1;
    counts.set(mediaId, c);
  };
  for (const t of threads) if ((t.messageCount || 0) > 0) bump(t.sourceMediaId, 'dmCount');
  for (const e of enquiryPage.items || []) {
    bump(e.sourceMediaId, 'enquiryCount');
    if (e.temperature === 'hot') bump(e.sourceMediaId, 'hotCount');
  }
  return counts;
}

export function createMediaRouter({ db = defaultDb } = {}) {
  const router = express.Router();

  // GET /media?sort=enquiries|views&limit=
  router.get('/', async (req, res) => {
    const sortKey = SORTS[req.query.sort] ? req.query.sort : 'enquiries';
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 25, 200);

    try {
      const [media, counts] = await Promise.all([db.listMedia(req.tenantId), attributionCounts(db, req.tenantId)]);
      const enriched = media.map((m) => ({ ...m, ...(counts.get(m.mediaId) || { enquiryCount: 0, hotCount: 0, dmCount: 0 }) }));
      const sorted = enriched.sort(SORTS[sortKey]).slice(0, limit);
      return res.json({ media: sorted, sort: sortKey, total: media.length });
    } catch (err) {
      log.error('media.list.failed', { error: err.message });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to list media' });
    }
  });

  // GET /media/:mediaId — one reel plus its dated snapshot series
  router.get('/:mediaId', async (req, res) => {
    const { mediaId } = req.params;
    try {
      const media = await db.getMedia(req.tenantId, mediaId);
      if (!media) {
        return res.status(404).json({ error: 'Not Found', details: 'Media not found' });
      }
      const snapshots = await db.listMediaSnapshots(req.tenantId, mediaId);
      snapshots.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return res.json({ media, snapshots });
    } catch (err) {
      log.error('media.get.failed', { error: err.message, mediaId });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to load media' });
    }
  });

  return router;
}

export default createMediaRouter;
