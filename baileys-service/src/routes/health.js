import { Router } from 'express';
import { listSessions } from '../baileysClient.js';

const router = Router();

function getSessionSummary() {
  const sessions = listSessions();
  const total = sessions.length;
  const connected = sessions.filter(s => s.connected).length;
  const failed = sessions.filter(s => s.state === 'close' && s.error).length;
  const connecting = sessions.filter(s => s.state === 'connecting').length;

  return { total, connected, connecting, failed };
}

router.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'realtyflow-baileys' });
});

router.get('/sessions', (_req, res) => {
  res.json({ sessions: getSessionSummary() });
});

router.get('/deep', (_req, res) => {
  const sessions = getSessionSummary();

  const health = {
    status: sessions.connected > 0 ? 'healthy' : 'degraded',
    service: 'realtyflow-baileys',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
    },
    sessions,
    checks: {
      memoryHealthy: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal < 0.9,
      hasConnectedSessions: sessions.connected > 0,
      noHighFailureRate: sessions.failed / Math.max(1, sessions.total) < 0.5,
    },
  };

  const allChecksPassed = Object.values(health.checks).every(v => v === true);
  res.status(allChecksPassed ? 200 : 503).json(health);
});

export default router;
