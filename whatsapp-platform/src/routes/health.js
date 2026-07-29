import { Router } from 'express';
import { listSessions } from '../baileysClient.js';
import { MAX_SESSIONS_PER_TASK } from '../config.js';
import { getInboundDeliveryStats } from '../inbound-deliveries.js';
import { getOutboundDeliveryStats } from '../outbound-deliveries.js';

const router = Router();

function getSnapshot() {
  const sessions = listSessions();
  const total = sessions.length;
  const connected = sessions.filter(s => s.connected).length;
  const failed = sessions.filter(s => s.state === 'close' && s.error).length;
  const connecting = sessions.filter(s => !s.connected && !s.error).length;
  const utilization = MAX_SESSIONS_PER_TASK > 0
    ? Math.round((connected / MAX_SESSIONS_PER_TASK) * 100)
    : 0;
  return { total, connected, connecting, failed, maxSessions: MAX_SESSIONS_PER_TASK, utilization };
}

// Basic liveness — used by ALB and Docker HEALTHCHECK
router.get('/', (_req, res) => {
  const snap = getSnapshot();
  res.json({
    status: 'ok',
    service: 'whatsapp-platform',
    activeSessions: snap.connected,
    maxSessionsPerTask: snap.maxSessions,
    capacityRemaining: snap.maxSessions - snap.connected,
  });
});

// Session list (compatible with baileys-service /health/sessions)
router.get('/sessions', (_req, res) => {
  res.json({ sessions: getSnapshot() });
});

// Deep health check
router.get('/deep', async (_req, res) => {
  const snap = getSnapshot();
  const mem = process.memoryUsage();
  const [inbound, outbound] = await Promise.all([
    getInboundDeliveryStats(),
    getOutboundDeliveryStats(),
  ]);
  const health = {
    status: snap.connected > 0 ? 'healthy' : 'degraded',
    service: 'whatsapp-platform',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      externalMb: Math.round(mem.external / 1024 / 1024),
    },
    sessions: snap,
    deliveries: { inbound, outbound },
    checks: {
      memoryHealthy: mem.heapUsed / mem.heapTotal < 0.9,
      hasConnectedSessions: snap.connected > 0,
      belowCapacity: snap.utilization < 95,
    },
  };
  const ok = Object.values(health.checks).every(Boolean);
  res.status(ok ? 200 : 503).json(health);
});

// ECS /v1/health alias (matches whatsapp-platform API contract)
router.get('/v1/health', (_req, res) => {
  const snap = getSnapshot();
  res.json({
    status: 'ok',
    activeSessions: snap.connected,
    maxSessionsPerTask: snap.maxSessions,
    capacityRemaining: snap.maxSessions - snap.connected,
  });
});

export default router;
