// Load .env BEFORE any imports that read process.env
import 'dotenv/config';

import { logger } from './logger.js';
import {
  PORT,
  RESTORE_ON_STARTUP,
  CLOUDWATCH_METRICS_ENABLED,
  MAX_SESSIONS_PER_TASK,
  NODE_ENV,
  LOCAL_STORAGE,
  USE_EVENTBRIDGE,
} from './config.js';
import { listSessions, restoreSessions, shutdownAllSessions } from './baileysClient.js';
import { publishSessionMetrics } from './observability/metrics.js';
import { apiKeyAuth } from './middleware/apiKeyAuth.js';
import healthRoutes from './routes/health.js';
import pairingRoutes from './routes/pairing.js';
import messagesRoutes from './routes/messages.js';

import express from 'express';
import rateLimit from 'express-rate-limit';

logger.info({
  port: PORT,
  nodeEnv: NODE_ENV,
  localStorage: LOCAL_STORAGE,
  useEventBridge: USE_EVENTBRIDGE,
  maxSessionsPerTask: MAX_SESSIONS_PER_TASK,
  cloudwatchMetrics: CLOUDWATCH_METRICS_ENABLED,
}, 'whatsapp-platform.starting');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));

// Health — no auth required (ALB health checks, Docker HEALTHCHECK)
app.use('/health', healthRoutes);
// ECS-style health alias
app.get('/v1/health', (_req, res) => {
  const sessions = listSessions();
  const active = sessions.filter(s => s.connected).length;
  res.json({ status: 'ok', activeSessions: active, maxSessionsPerTask: MAX_SESSIONS_PER_TASK, capacityRemaining: MAX_SESSIONS_PER_TASK - active });
});

// Rate limiter for authenticated API routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: NODE_ENV === 'production' ? 1000 : 10000,
  message: { error: 'too_many_requests' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/v1', limiter);

// Authenticated routes
app.use('/v1/pairing', apiKeyAuth, pairingRoutes);
app.use('/v1/messages', apiKeyAuth, messagesRoutes);
// ECS API aliases (whatsapp-platform contract)
app.use('/v1/sessions', apiKeyAuth, pairingRoutes);

// 404 / error handlers
app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
app.use((err, _req, res, _next) => {
  logger.error({ error: err.message, stack: err.stack }, 'express.error');
  res.status(500).json({ error: 'internal_error' });
});

async function bootstrap() {
  if (RESTORE_ON_STARTUP) {
    try {
      const result = await restoreSessions();
      logger.info(result, 'whatsapp-platform.sessions_restored');
    } catch (err) {
      logger.warn({ error: err.message }, 'whatsapp-platform.restore_failed');
    }
  }

  // CloudWatch metrics every 60s
  if (CLOUDWATCH_METRICS_ENABLED) {
    setInterval(() => {
      const sessions = listSessions();
      const activeSessions = sessions.filter(s => s.connected).length;
      publishSessionMetrics({ activeSessions, maxSessions: MAX_SESSIONS_PER_TASK }).catch(() => {});
    }, 60_000);
  }

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, health: `http://localhost:${PORT}/health` }, 'whatsapp-platform.started');
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info({ signal }, 'shutdown.initiated');
    const forceExit = setTimeout(() => {
      logger.error('shutdown.forced_exit');
      process.exit(1);
    }, 15000);
    try {
      await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
      logger.info('shutdown.http.closed');
      await shutdownAllSessions();
      logger.info('shutdown.sessions_closed');
    } catch (err) {
      logger.error({ error: err.message }, 'shutdown.error');
    } finally {
      clearTimeout(forceExit);
      logger.info('shutdown.complete');
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error({ error: err.message, stack: err.stack }, 'bootstrap.failed');
  process.exit(1);
});
