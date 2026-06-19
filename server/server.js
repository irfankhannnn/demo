import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureRequestId } from './requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './expressError.js';
import { logger } from './logger.js';
import { deepHealthCheck } from './healthcheck.js';
import authRoutes from './routes/auth.js';
import crmRoutes from './routes/crm.js';
import contactsRoutes from './routes/contacts.js';
import leadsRoutes from './routes/leads.js';
import buyersRoutes from './routes/buyers.js';
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
// === [/LAUNCH ROUTES IMPORTS] ===

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

logger.info('server.startup', {
  port: PORT,
  isLambda,
  nodeEnv: process.env.NODE_ENV,
});

// Middleware - Configure CORS with allowlist
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-tenant-id'],
  credentials: true,
  maxAge: 86400
}));
app.use(ensureRequestId);
app.use(requestLogger);

// Billing webhook MUST be before express.json() to preserve raw body for HMAC
logger.info('routes.mount', { basePath: '/api/billing', router: 'billingRoutes' });
app.use('/api/billing', billingRoutes);

// Webhooks (Bailey WhatsApp) — raw body before JSON parser
import webhooksRoutes from './routes/webhooks.js';
logger.info('routes.mount', { basePath: '/api/webhooks', router: 'webhooksRoutes' });
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRoutes);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve static public assets (e.g. /public/area/<city>_<area>.png)
app.use('/public', express.static(path.join(__dirname, 'public')));

// Rate limiting for API routes (billing webhook excluded — mounted earlier)
import rateLimit from './middleware/rateLimiter.js';
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
app.use('/api/auth', authRoutes);
logger.info('routes.mount', { basePath: '/api', router: 'b2bLeadsRoutes' });
app.use('/api', b2bLeadsRoutes);
logger.info('routes.mount', { basePath: '/api/enquiries', router: 'enquiriesRoutes' });
app.use('/api/enquiries', enquiriesRoutes);
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
// PR-F — AI Employee status (after auth)
logger.info('routes.mount', { basePath: '/api/ai-employee', router: 'aiEmployeeStatusRoutes' });
app.use('/api/ai-employee', aiEmployeeStatusRoutes);
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