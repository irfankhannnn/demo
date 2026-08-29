// Reel leaderboard, contract section 4 (JWT auth).

import express from 'express';
import { logger } from '../logger.js';
import * as defaultDb from '../services/dynamoService.js';

const log = logger.child({ module: 'routes/media' });

const SORTS = {
  // Default. The whole point of the product is "which reel produced leads",
  // not "which reel got views", so enquiries sorts first.
  enquiries: (a, b) => (b.enquiryCount || 0) - (a.enquiryCount || 0),
  views: (a, b) => (b.metrics?.views || 0) - (a.metrics?.views || 0),
};

export function createMediaRouter({ db = defaultDb } = {}) {
  const router = express.Router();

  // GET /media?sort=enquiries|views&limit=
  router.get('/', async (req, res) => {
    const sortKey = SORTS[req.query.sort] ? req.query.sort : 'enquiries';
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 25, 200);

    try {
      // Sorted in memory: the leaderboard's ordering is by an attribute, not a
      // key, so no index would help without duplicating every metric into a
      // sort key on every snapshot write.
      const media = await db.listMedia(req.tenantId);
      const sorted = [...media].sort(SORTS[sortKey]).slice(0, limit);

      return res.json({ media: sorted, sort: sortKey, total: media.length });
    } catch (err) {
      log.error('media.list.failed', { message: err.message });
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
      // Snapshot sort keys already sort by date, but the client charts them
      // directly so the guarantee is made explicit here.
      snapshots.sort((a, b) => String(a.date).localeCompare(String(b.date)));

      return res.json({ media, snapshots });
    } catch (err) {
      log.error('media.get.failed', { message: err.message, mediaId });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to load media' });
    }
  });

  return router;
}

export default createMediaRouter;
