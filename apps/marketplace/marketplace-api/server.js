/**
 * Express app for the consumer marketplace API.
 *
 * Exported as a factory so tests can build an app without starting a
 * listener, matching property-pages-ms and backend_insta_sol_ms.
 *
 * Route groups, in order:
 *   /health, /health/deep    liveness; answer before anything can fail
 *   /internal/*              service callers (x-api-key)
 *   /me/*                    consumer, bearer token required
 *   /listings/:slug/:id/*    consumer actions on one listing (ping/visit)
 *   everything else          public catalogue, AI search, assets, share, SEO
 */

import express from 'express';
import { config, assertEnv, modelConfigured } from './config/env.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { cors } from './middleware/cors.js';
import publicRouter from './routes/public.js';
import { meRouter, listingActionsRouter } from './routes/me.js';
import internalRouter from './routes/internal.js';
import { buyerNotifyEnabled } from './services/buyerNotify.js';
import { providerName } from './services/modelGateway/index.js';
import { logger } from './logger.js';

export function createApp() {
  const app = express();

  // Behind CloudFront + API Gateway. abuseGuard parses X-Forwarded-For
  // itself, but req.protocol must reflect the original scheme so the share
  // page's absolute og:image URL says https.
  app.set('trust proxy', true);
  app.disable('x-powered-by');
  app.set('etag', false);

  app.use(securityHeaders);
  app.use(cors);

  // JSON bodies only, and small: the largest legitimate body is a 2000-char
  // message. Anything bigger is a bug or someone making us allocate memory.
  app.use(express.json({ limit: '32kb' }));
  app.use((err, _req, res, next) => {
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    return next(err);
  });

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'marketplace-api', version: config.version }));
  app.get('/health/deep', (_req, res) => res.json({
    ok: true,
    service: 'marketplace-api',
    version: config.version,
    crmConfigured: Boolean(config.crmInternalApiUrl && config.crmInternalApiKey),
    tableConfigured: Boolean(config.tableName),
    cognitoConfigured: Boolean(config.cognito.userPoolId),
    model: { provider: providerName(), configured: modelConfigured() },
    email: buyerNotifyEnabled() ? 'enabled' : 'disabled',
    webOrigin: config.webOrigin || null,
  }));

  app.use('/internal', internalRouter);
  app.use('/me', meRouter);
  app.use('/listings/:slug/:propertyId', listingActionsRouter);
  app.use(publicRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line no-unused-vars -- Express identifies the error
  // handler by arity; dropping `next` silently turns it into normal middleware.
  app.use((err, req, res, _next) => {
    logger.error('unhandled_error', {
      path: req.path,
      userId: req.user?.userId || null,
      error: err.message,
      stack: err.stack,
    });
    if (res.headersSent) return;
    res.status(500).json({ error: 'Internal error' });
  });

  return app;
}

// Direct `node server.js` for local development. Under Lambda the entry point
// is lambda.js, which never reaches this.
if (process.env.AWS_LAMBDA_FUNCTION_NAME === undefined && import.meta.url === `file://${process.argv[1]}`) {
  assertEnv();
  createApp().listen(config.port, () => {
    logger.info('server.listening', { port: config.port, env: config.nodeEnv, model: providerName() });
  });
}
