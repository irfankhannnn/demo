// Express app factory + local listener.
//
// Mount order: CORS, the body parser, then routers grouped by auth scheme,
// then a JSON 404 and a JSON error handler so no client ever gets an HTML
// error page from this API.
//
// createApp takes its dependencies as arguments so the test suite can stand
// the whole router tree up against the local DynamoDB stand-in, a fake
// Instagram and fake auth, with no AWS and no auth microservice in the loop.

import express from 'express';
import cors from 'cors';

import { getConfig, assertEnv } from './config/env.js';
import { logger } from './logger.js';
import validateToken from './middleware/validateToken.js';
import * as defaultDb from './services/dynamoService.js';
import { createInstagramService } from './services/instagramService.js';
import { runScheduledJobs } from './services/worker.js';

import { createHealthRouter } from './routes/health.js';
import { createWebhooksRouter } from './routes/webhooks.js';
import { createMetaRouter } from './routes/meta.js';
import { createOAuthStartRouter, createOAuthCallbackRouter } from './routes/oauth.js';
import { createAccountsRouter } from './routes/accounts.js';
import { createMediaRouter } from './routes/media.js';
import { createEnquiriesRouter } from './routes/enquiries.js';
import { createThreadsRouter } from './routes/threads.js';
import { createRulesRouter } from './routes/rules.js';
import { createCommentsRouter } from './routes/comments.js';
import { createOverviewRouter } from './routes/overview.js';
import { createInsightsRouter } from './routes/insights.js';

const BASE = '/api/insta';

/**
 * Local development only: every request acts as this tenant, with no login.
 * assertEnv refuses INSTA_DEV_AUTH_TENANT_ID under Lambda or NODE_ENV=production.
 */
function devAuth(tenantId) {
  logger.warn('auth.dev_bypass_enabled', { tenantId });
  return (req, _res, next) => {
    req.tenantId = tenantId;
    req.user = { userId: 'local-dev', email: 'local-dev@localhost', tenantId };
    next();
  };
}

export function createApp({ db = defaultDb, service, authMiddleware } = {}) {
  const cfg = getConfig();
  const app = express();
  const instagram = service || createInstagramService({ db });

  // ETags produce 304s with empty bodies, which every JSON client in this repo
  // mishandles. Same decision as the CRM.
  app.set('etag', false);

  app.use(
    cors({
      origin: (origin, callback) => {
        // No Origin header means a non-browser caller — Meta's webhooks, curl,
        // a health probe. Those are authenticated by signature or not at all.
        if (!origin) return callback(null, true);
        callback(null, cfg.allowedOrigins.includes(origin));
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-request-id'],
      credentials: true,
      maxAge: 86400,
    })
  );

  // Terminate every preflight here, before any auth middleware. For a
  // disallowed origin cors just calls next() without responding, so the
  // OPTIONS would otherwise reach the JWT check and come back a 401 with no
  // CORS headers — which the browser reports as a CORS failure and hides the
  // real cause.
  app.use((req, res, next) => {
    if (req.method !== 'OPTIONS') return next();
    res.vary('Origin');
    res.status(204).end();
  });

  // The raw body is captured here: Meta's X-Hub-Signature-256 covers the exact
  // bytes, and re-serialising req.body would change them.
  app.use(
    express.json({
      limit: cfg.bodyLimit,
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // Dashboard reads must never come from a browser or CDN cache.
  app.use(BASE, (_req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    next();
  });

  const auth = authMiddleware || (cfg.devAuthTenantId ? devAuth(cfg.devAuthTenantId) : validateToken);

  // 1. Open: health, and the three callers that authenticate some other way —
  // Meta's webhooks (signature), Meta's platform callbacks (signed_request),
  // and the OAuth redirect (signed state).
  app.use(BASE, createHealthRouter());
  app.use(`${BASE}/webhooks`, createWebhooksRouter({ service: instagram }));
  app.use(`${BASE}/meta`, createMetaRouter({ service: instagram, db }));
  app.use(BASE, createOAuthCallbackRouter({ service: instagram }));

  // 2. Everything else: browser JWT, validated once per request.
  const jwtScope = express.Router();
  jwtScope.use(auth);
  jwtScope.use(createOAuthStartRouter({ service: instagram }));
  jwtScope.use(createAccountsRouter({ db, service: instagram }));
  jwtScope.use('/overview', createOverviewRouter({ db }));
  jwtScope.use('/media', createMediaRouter({ db }));
  jwtScope.use('/enquiries', createEnquiriesRouter({ db, service: instagram }));
  jwtScope.use('/threads', createThreadsRouter({ db, service: instagram }));
  jwtScope.use('/rules', createRulesRouter({ db }));
  jwtScope.use('/comments', createCommentsRouter({ db, service: instagram }));
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
    // payload — which for this service may contain a DM. Only the type is logged.
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
    logger.info('server.listening', { port: cfg.port, env: cfg.nodeEnv, basePath: BASE, store: cfg.store });
  });

  // Locally there is no EventBridge, so the same worker runs on a timer inside
  // this process (it has to share the in-memory store anyway).
  const everySeconds = Number.parseInt(process.env.INSTA_LOCAL_WORKER_SECONDS || '0', 10);
  if (everySeconds > 0) {
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        await runScheduledJobs();
      } catch (err) {
        logger.error('local_worker.failed', { message: err.message });
      } finally {
        running = false;
      }
    };
    setInterval(tick, everySeconds * 1000);
    setTimeout(tick, 2000);
    logger.info('local_worker.enabled', { everySeconds });
  }
}

export default createApp;
