// GET /api/insta/health — unauthenticated liveness (contract section 4).
//
// Deliberately does not touch DynamoDB: this endpoint answers "is the Lambda
// warm and routing", and a table-dependent health check would flap the whole
// service on a throttled read.

import express from 'express';
import { getConfig } from '../config/env.js';

export function createHealthRouter() {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    const cfg = getConfig();
    res.json({
      status: 'ok',
      service: 'insta-sol-ms',
      env: cfg.nodeEnv,
      serverTime: new Date().toISOString(),
    });
  });

  return router;
}

export default createHealthRouter;
