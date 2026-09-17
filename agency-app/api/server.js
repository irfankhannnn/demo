// Load .env BEFORE any other imports that read process.env at module load time.
// Side-effect imports are evaluated in order, so this runs before bailey.js, etc.
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureRequestId } from './requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './expressError.js';
import { getAllowedOrigins } from './utils/corsOrigins.js';
import { logger } from './logger.js';
import { deepHealthCheck } from './healthcheck.js';
import authRoutes from './routes/auth.js';
import crmRoutes from './routes/crm.js';
import aiCallingRoutes from './routes/aiCalling.js';
import agencyPoliciesRoutes from './routes/agencyPolicies.js';
import contactsRoutes from './routes/contacts.js';
import leadsRoutes from './routes/leads.js';
import buyersRoutes from './routes/buyers.js';
import callRecordingsRoutes from './routes/callRecordings.js';
import enquiriesRoutes from './routes/enquiries.js';
import b2bLeadsRoutes from './routes/b2bLeads.js';
import khataRoutes from './routes/khata.js';
import notificationsRoutes from './routes/notifications.js';

// === [LAUNCH ROUTES IMPORTS] ===
// PR-B
import grievanceRoutes from './routes/grievance.js';
// PR-F
import billingRoutes from './routes/billing.js';
import aiEmployeeStatusRoutes from './routes/aiEmployeeStatus.js';
// PR-H
import subscriptionsRoutes from './routes/subscriptions.js';
import creditAdminRoutes from './routes/creditAdmin.js';
import adminRoutes from './routes/admin.js';
// PR-K
import feedbackRoutes from './routes/feedback.js';
// AI Employee agent routes
import agentToolsRouter from './routes/agentTools.js';
import agentChatRouter from './routes/agentChat.js';
import agentActivityRouter from './routes/agentActivity.js';
import aiEmployeeConfigRouter from './routes/aiEmployeeConfig.js';
import whatsappConversationsRoutes from './routes/whatsappConversations.js';
import aiCallingInternalRoutes from './routes/aiCallingInternal.js';
import adapterIngestionInternalRoutes from './routes/adapterIngestionInternal.js';
import followupInternalRoutes from './routes/followupInternal.js';
import followupsRoutes from './routes/followups.js';
import publicPagesInternalRoutes from './routes/publicPagesInternal.js';
import publicPagesSettingsRoutes from './routes/publicPagesSettings.js';
import validateToken from './middleware/validateToken.js';
import phoneMaskingMiddleware from './middleware/phoneMasking.js';
import clickToCallRoutes from './routes/clickToCall.js';
// AI Integrations dashboard API (frontend uses this to list/disconnect OAuth clients)
import aiIntegrationsRoutes from './routes/aiIntegrations.js';
// Public OAuth callback — must NOT have validateToken (browser redirect, no auth header)
import aiIntegrationsPublicRoutes from './routes/aiIntegrationsPublic.js';
// === [/LAUNCH ROUTES IMPORTS] ===

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('etag', false); // prevent 304 empty-body responses breaking API clients
const PORT = process.env.PORT || 3001;
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

logger.info('server.startup', {
  port: PORT,
  isLambda,
  nodeEnv: process.env.NODE_ENV,
});

if (process.env.NODE_ENV === 'production' && process.env.BAILEY_ENABLED === 'true' && !process.env.BAILEY_WEBHOOK_SECRET) {
  throw new Error('BAILEY_WEBHOOK_SECRET is required in production when BAILEY_ENABLED=true');
}

// Middleware - Configure CORS with allowlist.
// Resolved per-request via the shared helper (which also permits the Capacitor
// WebView origins) so Express, the Lambda handler and the error responder
// cannot drift apart on what counts as an allowed origin.
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (getAllowedOrigins().includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-tenant-id', 'Cache-Control', 'Pragma'],
  credentials: true,
  maxAge: parseInt(process.env.CORS_MAX_AGE_SECONDS || '86400', 10)
}));
app.use(ensureRequestId);
app.use(requestLogger);

// Billing webhook MUST be before express.json() to preserve raw body for HMAC
import { webhookRateLimit } from './middleware/rateLimiter.js';
logger.info('routes.mount', { basePath: '/api/billing', router: 'billingRoutes' });
app.use('/api/billing', webhookRateLimit, billingRoutes);

// Webhooks (Bailey WhatsApp) — raw body before JSON parser
import webhooksRoutes from './routes/webhooks.js';
logger.info('routes.mount', { basePath: '/api/webhooks', router: 'webhooksRoutes' });
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRoutes);

app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.REQUEST_BODY_LIMIT || '1mb' }));

// CRM API responses must not be cached (ETag 304 breaks JSON clients)
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});

// Serve static public assets (e.g. /public/area/<city>_<area>.png)
app.use('/public', express.static(path.join(__dirname, 'public')));

// Rate limiting for API routes (billing webhook excluded — mounted earlier)
import rateLimit, { authRateLimit } from './middleware/rateLimiter.js';
app.use('/api', rateLimit);

// Security headers (CSP, X-Frame-Options, etc.)
import cspMiddleware from './middleware/csp.js';
app.use(cspMiddleware);

// Health check (public - no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.get('/api/health/deep', deepHealthCheck);

// Routes
logger.info('routes.mount', { basePath: '/api/auth', router: 'authRoutes' });
app.use('/api/auth', authRateLimit, authRoutes);

// AI Employee — agent tools (MCP JWT-auth), activity log (admin/manager), config (admin only)
// Phone masking for every /api/crm/* JSON response (docs/agency-app/followup-agent/CONTRACTS.md section 7).
// Must precede every /api/crm* router: it only wraps res.json and decides at
// send time from req.user, which the routes' own validateToken sets later.
app.use('/api/crm', phoneMaskingMiddleware());

logger.info('routes.mount', { basePath: '/api/crm/agent', router: 'agentToolsRouter' });
app.use('/api/crm/agent', agentToolsRouter);
// In-CRM AI chat (Phase 5) — SSE, authenticated CRM users only.
// Mounted BEFORE '/api/crm' so the catch-all crmRoutes cannot shadow it.
logger.info('routes.mount', { basePath: '/api/crm/agent-chat', router: 'agentChatRouter' });
app.use('/api/crm/agent-chat', agentChatRouter);
logger.info('routes.mount', { basePath: '/api/crm/agents', router: 'agentActivityRouter' });
app.use('/api/crm/agents', agentActivityRouter);
logger.info('routes.mount', { basePath: '/api/crm/config', router: 'aiEmployeeConfigRouter' });
app.use('/api/crm/config', aiEmployeeConfigRouter);
logger.info('routes.mount', { basePath: '/api/whatsapp', router: 'whatsappConversationsRoutes' });
app.use('/api/whatsapp', whatsappConversationsRoutes);
// PR-F — AI Employee status (after auth)
logger.info('routes.mount', { basePath: '/api/ai-employee', router: 'aiEmployeeStatusRoutes' });
app.use('/api/ai-employee', aiEmployeeStatusRoutes);

// Internal lead-adapter intake (x-api-key + x-tenant-id). MUST be mounted
// before the '/api/internal' router below: that one applies its own API-key
// check via router.use to every request passing through it, so a broader mount
// first would reject adapter traffic with the AI-calling key before it ever
// reached this route.
logger.info('routes.mount', { basePath: '/api/internal/adapters', router: 'adapterIngestionInternalRoutes' });
app.use('/api/internal/adapters', adapterIngestionInternalRoutes);

// Internal API for followup-agent-service (x-api-key = FOLLOWUP_INTERNAL_API_KEY
// + x-tenant-id): lead snapshot, escalations, notes. Same mount-order
// requirement as the adapter route above.
logger.info('routes.mount', { basePath: '/api/internal/followups', router: 'followupInternalRoutes' });
app.use('/api/internal/followups', followupInternalRoutes);

// Internal read/write API for property-pages-ms (x-api-key + x-tenant-id).
// Same mount-order requirement as the adapter route above.
logger.info('routes.mount', { basePath: '/api/internal/public-pages', router: 'publicPagesInternalRoutes' });
app.use('/api/internal/public-pages', publicPagesInternalRoutes);

// Agency-facing settings for the public pages (authenticated, admin only).
logger.info('routes.mount', { basePath: '/api/crm/public-pages', router: 'publicPagesSettingsRoutes' });
app.use('/api/crm/public-pages', publicPagesSettingsRoutes);

// Internal, service-to-service only (x-api-key + x-tenant-id, no user JWT) —
// called by ai-calling-service, never by the frontend. Re-enabled as part of
// the Lead Temperature migration; see DISABLED_FEATURES.md for history.
logger.info('routes.mount', { basePath: '/api/internal', router: 'aiCallingInternalRoutes' });
app.use('/api/internal', aiCallingInternalRoutes);
// AI Integrations — public OAuth callback (no auth required, browser redirect from MCP)
logger.info('routes.mount', { basePath: '/api/ai-integrations/callback', router: 'aiIntegrationsPublicRoutes' });
app.use('/api/ai-integrations', aiIntegrationsPublicRoutes);
// AI Integrations — auth-protected routes (list, connect, disconnect, desktop-session)
logger.info('routes.mount', { basePath: '/api/ai-integrations', router: 'aiIntegrationsRoutes' });
app.use('/api/ai-integrations', validateToken, aiIntegrationsRoutes);

logger.info('routes.mount', { basePath: '/api', router: 'b2bLeadsRoutes' });
app.use('/api', b2bLeadsRoutes);
logger.info('routes.mount', { basePath: '/api/enquiries', router: 'enquiriesRoutes' });
app.use('/api/enquiries', enquiriesRoutes);
// Mounted before crmRoutes so the sub-path is never swallowed by a param route.
logger.info('routes.mount', { basePath: '/api/crm/call-recordings', router: 'callRecordingsRoutes' });
app.use('/api/crm/call-recordings', callRecordingsRoutes);
// Mounted before crmRoutes so the sub-path is never swallowed by a param route.
logger.info('routes.mount', { basePath: '/api/crm/ai-calling', router: 'aiCallingRoutes' });
app.use('/api/crm/ai-calling', aiCallingRoutes);

// Exotel click-to-call. Mounted before crmRoutes so the sub-path is never swallowed.
logger.info('routes.mount', { basePath: '/api/crm/calls', router: 'clickToCallRoutes' });
app.use('/api/crm/calls', clickToCallRoutes);

// Mounted before the generic /api/crm router so this specific path wins.
logger.info('routes.mount', { basePath: '/api/crm/agency-policies', router: 'agencyPoliciesRoutes' });
app.use('/api/crm/agency-policies', agencyPoliciesRoutes);
// AI follow-up jobs by id (cancel) — proxied to followup-agent-service. The
// per-lead follow-up routes live under /api/crm/leads. Mounted before the
// generic /api/crm router for the same reason as agency-policies.
logger.info('routes.mount', { basePath: '/api/crm/followups', router: 'followupsRoutes' });
app.use('/api/crm/followups', followupsRoutes);
logger.info('routes.mount', { basePath: '/api/crm', router: 'crmRoutes' });
app.use('/api/crm', crmRoutes);
logger.info('routes.mount', { basePath: '/api/crm/contacts', router: 'contactsRoutes' });
app.use('/api/crm/contacts', contactsRoutes);
logger.info('routes.mount', { basePath: '/api/crm/leads', router: 'leadsRoutes' });
app.use('/api/crm/leads', leadsRoutes);
logger.info('routes.mount', { basePath: '/api/crm/buyers', router: 'buyersRoutes' });
app.use('/api/crm/buyers', buyersRoutes);
logger.info('routes.mount', { basePath: '/api/khata', router: 'khataRoutes' });
app.use('/api/khata', khataRoutes);
logger.info('routes.mount', { basePath: '/api/notifications', router: 'notificationsRoutes' });
app.use('/api/notifications', notificationsRoutes);

// === [LAUNCH ROUTES MOUNTS] ===
// PR-B
logger.info('routes.mount', { basePath: '/api', router: 'grievanceRoutes' });
app.use('/api', grievanceRoutes);
// PR-H
logger.info('routes.mount', { basePath: '/api/subscriptions', router: 'subscriptionsRoutes' });
app.use('/api/subscriptions', subscriptionsRoutes);
logger.info('routes.mount', { basePath: '/api/credit-config', router: 'creditAdminRoutes' });
app.use('/api/credit-config', creditAdminRoutes);
logger.info('routes.mount', { basePath: '/api/admin', router: 'adminRoutes' });
app.use('/api/admin', adminRoutes);
// PR-K
logger.info('routes.mount', { basePath: '/api/feedback', router: 'feedbackRoutes' });
app.use('/api/feedback', feedbackRoutes);
// === [/LAUNCH ROUTES MOUNTS] ===

// JSON 404 for unknown API paths
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

// Error handling middleware
app.use(errorHandler);

// Start server
let server;
if (!isLambda) {
  server = app.listen(PORT, () => {
    logger.info('server.listening', {
      port: PORT,
      healthCheck: `http://localhost:${PORT}/api/health`,
    });
  });

  // 30s timeout for idle/slow connections
  server.timeout = 30000;

  // Graceful shutdown for SIGTERM/SIGINT (ECS, Docker, local)
  const shutdown = (signal) => {
    logger.info('server.shutdown', { signal });
    server.close(() => {
      logger.info('server.closed');
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export default app;