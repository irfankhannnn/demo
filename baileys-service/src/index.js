// Load .env BEFORE any other imports that read process.env.
// Side-effect imports are evaluated in order, so this runs before config.js.
import 'dotenv/config';

import fs from 'fs/promises';
import { AUTH_STATE_DIR, PORT, NODE_ENV } from './config.js';
import { logger } from './logger.js';

async function main() {
  const { default: express } = await import('express');
  const { default: rateLimit } = await import('express-rate-limit');
  const { restoreSessions, listSessions, shutdownAllSessions } = await import('./baileysClient.js');
  const { default: healthRoutes } = await import('./routes/health.js');
  const { default: pairingRoutes } = await import('./routes/pairing.js');
  const { default: messagesRoutes } = await import('./routes/messages.js');
  const { requireApiKey } = await import('./middleware/auth.js');

  // Ensure auth state directory exists
  try {
    await fs.mkdir(AUTH_STATE_DIR, { recursive: true });
  } catch (err) {
    logger.error('startup.mkdir.failed', { dir: AUTH_STATE_DIR, error: err.message });
    process.exit(1);
  }

  const app = express();
  app.set('trust proxy', 1); // For rate limiting behind proxy/docker

  app.use(express.json({ limit: '5mb' }));

  app.use('/health', healthRoutes);

  // Rate limiting applies to authenticated API routes only (not health checks).
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: NODE_ENV === 'production' ? 1000 : 10000,
    message: { error: 'too_many_requests' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/v1', limiter);

  app.use('/v1/pairing', requireApiKey, pairingRoutes);
  app.use('/v1/messages', requireApiKey, messagesRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  app.use((err, _req, res, _next) => {
    logger.error('express.error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'internal_error' });
  });

  await restoreSessions();

  const server = app.listen(PORT, () => {
    logger.info('server.started', { 
      port: PORT, 
      health: `http://localhost:${PORT}/health`,
      node_env: NODE_ENV
    });
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info('server.shutdown.initiated', { signal });

    const forceExit = setTimeout(() => {
      logger.error('server.shutdown.forced_exit');
      process.exit(1);
    }, 15000);

    try {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info('server.http.closed');

      const sessions = listSessions();
      logger.info('server.shutdown.sessions_cleanup', { count: sessions.length });

      await shutdownAllSessions();
      logger.info('server.shutdown.sessions_closed');
    } catch (err) {
      logger.error('server.shutdown.error', { error: err.message });
    } finally {
      clearTimeout(forceExit);
      logger.info('server.shutdown.complete');
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(err => {
  console.error('server.start.failed', err);
  process.exit(1);
});
