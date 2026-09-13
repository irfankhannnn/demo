// Express app factory + local listener.
//
// Mount order mirrors the CRM's server/server.js: CORS, then the body parser,
// then routers grouped by auth scheme, then a JSON 404 and a JSON error
// handler so no client ever gets an HTML error page from this API.
//
// createApp takes its dependencies as arguments so the test suite can stand
// the whole router tree up against a fake dynamoService and fake auth, with no
// AWS and no auth microservice in the loop.

import express from 'express';
import cors from 'cors';

import { getConfig, assertEnv } from './config/env.js';
import { logger } from './logger.js';
import validateToken from './middleware/validateToken.js';
import { createDeviceAuth } from './middleware/deviceAuth.js';
import * as defaultDb from './services/dynamoService.js';

import { createHealthRouter } from './routes/health.js';
import { createAgentRouter } from './routes/agent.js';
import { createDevicesRouter } from './routes/devices.js';
import { createMediaRouter } from './routes/media.js';
import { createEnquiriesRouter } from './routes/enquiries.js';
import { createThreadsRouter } from './routes/threads.js';
import { createRulesRouter } from './routes/rules.js';
import { createOverviewRouter } from './routes/overview.js';
import { createInsightsRouter } from './routes/insights.js';

const BASE = '/api/insta';

export function createApp({ db = defaultDb, crm, authMiddleware, deviceAuthMiddleware } = {}) {
  const cfg = getConfig();
  const app = express();

  // ETags produce 304s with empty bodies, which every JSON client in this repo
  // mishandles. Same decision as the CRM.
  app.set('etag', false);

  app.use(
    cors({
      origin: (origin, callback) => {
        // No Origin header means a non-browser caller — the laptop agent, curl,
        // an ALB health probe. Those are authenticated by HMAC or not at all,
        // so CORS has nothing to say about them.
        if (!origin) return callback(null, true);
        callback(null, cfg.allowedOrigins.includes(origin));
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'x-request-id',
        'x-insta-device-id',
        'x-insta-timestamp',
        'x-insta-nonce',
        'x-insta-signature',
      ],
      credentials: true,
      maxAge: 86400,
    })
  );

  // Terminate every preflight here, before any auth middleware. cors answers an
  // allowed-origin preflight itself (204 + Access-Control-Allow-* headers), but
  // for a disallowed origin its callback(null, false) path just calls next()
  // without responding — the OPTIONS then fell through to the JWT middleware
  // and came back as a 401 with no CORS headers, which the browser reports as a
  // CORS failure and hides the real cause. A disallowed origin now gets a bare
  // 204 with no Access-Control-Allow-Origin, so the browser still blocks the
  // real request, and no preflight ever reaches auth.
  app.use((req, res, next) => {
    if (req.method !== 'OPTIONS') return next();
    res.vary('Origin');
    res.status(204).end();
  });

  // The raw body is captured here, not re-derived later: the agent's HMAC
  // covers sha256(rawBody), and re-serialising req.body would change key order
  // and unicode escaping, breaking every signature.
  app.use(
    express.json({
      limit: cfg.bodyLimit,
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // Dashboard reads must never come from a browser or CloudFront cache — a
  // stale lead count is worse than a slow one.
  app.use(BASE, (_req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    next();
  });

  const auth = authMiddleware || validateToken;
  const deviceAuth = deviceAuthMiddleware || createDeviceAuth({ db });

  // 1. Open.
  app.use(BASE, createHealthRouter());

  // 2. HMAC device auth. Applied inside the router rather than at the mount
  // point because /agent/register is authenticated by the pairing code instead
  // — contract section 2b.
  app.use(`${BASE}/agent`, createAgentRouter({ db, crm, deviceAuth }));

  // 3. Everything else: browser JWT. Grouped under one sub-router so the token
  // is validated exactly once per request rather than once per mount point.
  const jwtScope = express.Router();
  jwtScope.use(auth);
  jwtScope.use(createDevicesRouter({ db })); // /devices*, /accounts
  jwtScope.use('/overview', createOverviewRouter({ db }));
  jwtScope.use('/media', createMediaRouter({ db }));
  jwtScope.use('/enquiries', createEnquiriesRouter({ db }));
  jwtScope.use('/threads', createThreadsRouter({ db }));
  jwtScope.use('/rules', createRulesRouter({ db }));
  jwtScope.use('/insights', createInsightsRouter({ db }));
  app.use(BASE, jwtScope);

  app.use(BASE, (req, res) => {
    res.status(404).json({ error: 'Not Found', details: req.originalUrl });
  });

  // Terminal handler. Four arguments is what marks it as an error handler to
  // Express; the unused `next` cannot be removed.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    // A body that fails to parse arrives here, and its message can quote the
    // payload — which for this service may contain an enquiry. Only the type
    // is logged.
    logger.error('unhandled_error', { name: err?.name, status: err?.status, path: req.path });
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(status).json({
      error: status === 400 ? 'Bad Request' : 'Internal Server Error',
      details: status === 400 ? 'Malformed request body' : 'Unexpected server error',
    });
  });

  return app;
}

// Only start listening when this file is the entry point. Under Lambda,
// lambda.js imports createApp and serverless-http owns the request loop.
const isEntryPoint =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href;

if (isEntryPoint) {
  assertEnv();
  const cfg = getConfig();
  const app = createApp();
  app.listen(cfg.port, () => {
    logger.info('server.listening', { port: cfg.port, env: cfg.nodeEnv, basePath: BASE });
  });
}

export default createApp;
