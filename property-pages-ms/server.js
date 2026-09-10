/**
 * Express app for the public property pages.
 *
 * Exported as a factory so tests can build an app without starting a listener,
 * matching backend_insta_sol_ms.
 */

import express from 'express';
import crypto from 'crypto';
import { config, assertEnv, captchaEnabled } from './config/env.js';
import { resolveTenant } from './middleware/resolveTenant.js';
import pagesRouter from './routes/pages.js';
import { renderServerError } from './views/errors.js';
import { logger } from './logger.js';

export function createApp() {
  const app = express();

  // Behind CloudFront + API Gateway. We never call req.ip (abuseGuard parses
  // the header itself, deliberately), but req.protocol must reflect the
  // original scheme or every canonical URL and og:image we emit would say
  // http: and be wrong in a way crawlers and link unfurlers notice.
  app.set('trust proxy', true);
  app.disable('x-powered-by');
  app.set('etag', false);

  /**
   * Form posts only. The limit is small on purpose: this app accepts one
   * modest form and nothing else, so anything larger is either a bug or an
   * attempt to make us allocate memory.
   */
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));

  app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');

    const csp = [
      "default-src 'none'",
      `script-src 'self' 'nonce-${res.locals.cspNonce}'${captchaEnabled() ? ' https://js.hcaptcha.com https://newassets.hcaptcha.com' : ''}`,
      // Inline styles are allowed rather than nonced: hCaptcha and the Google
      // Fonts stylesheet both inject their own, and a nonce on style-src makes
      // the browser ignore 'unsafe-inline' entirely, breaking them. Style
      // injection is a far smaller risk than script injection, and every value
      // we interpolate is escaped regardless.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      'font-src https://fonts.gstatic.com',
      // Listing photos are presigned S3 URLs on a host that varies by region
      // and bucket, so this cannot be narrowed to a fixed origin without
      // breaking images.
      "img-src 'self' data: https:",
      `frame-src https://www.google.com${captchaEnabled() ? ' https://newassets.hcaptcha.com https://hcaptcha.com' : ''}`,
      `connect-src 'self'${captchaEnabled() ? ' https://hcaptcha.com https://*.hcaptcha.com' : ''}`,
      // The booking form must only ever post back to us.
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
    ].join('; ');

    res.set({
      'Content-Security-Policy': csp,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      // Cross-origin so listing pages still get referrer credit from links,
      // but a booking URL's query string never leaks to a third party.
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), interest-cohort=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    });
    next();
  });

  // Health checks answer before tenant resolution — they have no tenant, and
  // a CRM outage must not make the service look down to the load balancer.
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'property-pages-ms' }));
  app.get('/health/deep', (_req, res) => res.json({
    ok: true,
    service: 'property-pages-ms',
    crmConfigured: Boolean(config.crmInternalApiUrl && config.crmInternalApiKey),
    guardConfigured: Boolean(config.guardTableName),
    captcha: captchaEnabled() ? 'enabled' : 'disabled',
    maps: config.mapsEmbedApiKey ? 'enabled' : 'disabled',
    baseDomain: config.baseDomain || null,
    pathFallback: config.pathTenantFallback,
  }));

  app.use(resolveTenant);
  app.use(pagesRouter);

  app.use((req, res) => {
    res.status(404).type('html').send(renderServerError());
  });

  // eslint-disable-next-line no-unused-vars -- Express identifies the error
  // handler by arity; dropping `next` silently turns it into normal middleware.
  app.use((err, req, res, _next) => {
    logger.error('unhandled_error', {
      path: req.path,
      tenantId: req.tenantId || null,
      error: err.message,
      stack: err.stack,
    });
    if (res.headersSent) return;
    res.status(500).type('html').send(renderServerError());
  });

  return app;
}

// Direct `node server.js` for local development. Under Lambda the entry point
// is lambda.js, which never reaches this.
if (process.env.AWS_LAMBDA_FUNCTION_NAME === undefined && import.meta.url === `file://${process.argv[1]}`) {
  assertEnv();
  createApp().listen(config.port, () => {
    logger.info('server.listening', { port: config.port, env: config.nodeEnv });
  });
}
