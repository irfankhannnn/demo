// Meta's platform callbacks (open, verified by signed_request).
//
//   POST /meta/deauthorize            someone removed the app from Instagram
//   POST /meta/data-deletion          someone asked for their data to be deleted
//   GET  /meta/data-deletion/status   where that request's confirmation points
//
// Both URLs have to be registered in the Meta app before App Review, and both
// have to work: reviewers test them.

import express from 'express';
import { logger } from '../logger.js';
import * as defaultDb from '../services/dynamoService.js';
import { ServiceError } from '../services/instagramService.js';

const log = logger.child({ module: 'routes/meta' });

function signedRequestFrom(req) {
  return req.body?.signed_request || req.query?.signed_request || null;
}

export function createMetaRouter({ service, db = defaultDb }) {
  const router = express.Router();

  // Meta posts these as application/x-www-form-urlencoded.
  router.use(express.urlencoded({ extended: false, limit: '64kb' }));

  router.post('/deauthorize', async (req, res) => {
    try {
      const result = await service.deauthorize(signedRequestFrom(req));
      return res.json({ ok: true, found: result.found });
    } catch (err) {
      if (err instanceof ServiceError) return res.status(err.status).json({ error: err.error, details: err.details });
      log.error('meta.deauthorize.failed', { error: err.message });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Deauthorize failed' });
    }
  });

  router.post('/data-deletion', async (req, res) => {
    try {
      // The exact response shape Meta expects: { url, confirmation_code }.
      return res.json(await service.requestDataDeletion(signedRequestFrom(req)));
    } catch (err) {
      if (err instanceof ServiceError) return res.status(err.status).json({ error: err.error, details: err.details });
      log.error('meta.data_deletion.failed', { error: err.message });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Data deletion failed' });
    }
  });

  router.get('/data-deletion/status', async (req, res) => {
    const code = String(req.query.code || '');
    if (!/^[a-f0-9]{24}$/.test(code)) {
      return res.status(400).json({ error: 'Bad Request', details: 'A valid confirmation code is required' });
    }
    try {
      const record = await db.getDeletionRequest(code);
      if (!record) return res.status(404).json({ error: 'Not Found', details: 'Unknown confirmation code' });
      return res.json({ confirmationCode: code, status: record.status, completedAt: record.completedAt ?? null });
    } catch (err) {
      log.error('meta.data_deletion_status.failed', { error: err.message });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Could not read the request' });
    }
  });

  return router;
}

export default createMetaRouter;
