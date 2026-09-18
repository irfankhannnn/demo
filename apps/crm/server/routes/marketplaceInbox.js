/**
 * Agent-facing Marketplace Inbox — the CRM side of buyer chat.
 *
 * Threads and messages live in marketplace-api's own table (they are consumer
 * data, not CRM data). These routes are thin JWT-authenticated proxies to that
 * service's /internal/* routes, presenting the CRM's own caller key and the
 * tenant id derived from the user's token — never a client-supplied header.
 *
 * Any CRM member may read and reply: the inbox is the day-to-day surface for
 * whoever is working the lead.
 */

import express from 'express';
import { z } from 'zod';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireCrmMemberOrAbove } from '../middleware/requireRole.js';
import validateBody from '../middleware/validateBody.js';
import { getMarketplaceApiBaseUrl, ServiceUrlConfigError } from '../config/serviceUrls.js';
import { logger } from '../logger.js';

const router = express.Router();
const TIMEOUT_MS = 8000;

async function marketplaceFetch(tenantId, path, { method = 'GET', body = null } = {}) {
  const base = getMarketplaceApiBaseUrl();
  if (!base) return { status: 503, data: { error: 'Marketplace not configured' } };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        'x-api-key': process.env.MARKETPLACE_CALLER_API_KEY || '',
        'x-tenant-id': tenantId,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    return { status: response.status, data };
  } catch (err) {
    logger.error('marketplaceInbox.upstream_failed', { tenantId, path, error: err.message });
    return { status: err.name === 'AbortError' ? 504 : 502, data: { error: 'Marketplace unavailable' } };
  } finally {
    clearTimeout(timeout);
  }
}

router.use(validateToken, extractTenantId, requireCrmMemberOrAbove);

/** GET /api/crm/marketplace/status — is the marketplace wired for this deployment? */
router.get('/status', (req, res) => {
  try {
    return res.json({ configured: Boolean(getMarketplaceApiBaseUrl()) });
  } catch (err) {
    if (err instanceof ServiceUrlConfigError) return res.json({ configured: false, error: err.message });
    throw err;
  }
});

/** GET /threads?status&limit&cursor */
router.get('/threads', async (req, res) => {
  const qs = new URLSearchParams();
  for (const k of ['status', 'limit', 'cursor']) if (req.query[k]) qs.set(k, String(req.query[k]));
  const { status, data } = await marketplaceFetch(req.tenantId, `/internal/tenants/${encodeURIComponent(req.tenantId)}/threads?${qs}`);
  return res.status(status).json(data);
});

/** GET /threads/:threadId?since */
router.get('/threads/:threadId', async (req, res) => {
  const qs = req.query.since ? `?since=${encodeURIComponent(String(req.query.since))}` : '';
  const { status, data } = await marketplaceFetch(req.tenantId, `/internal/threads/${encodeURIComponent(req.params.threadId)}${qs}`);
  return res.status(status).json(data);
});

const replySchema = z.object({ text: z.string().min(1).max(2000) }).strict();

/** POST /threads/:threadId/messages — agent reply. */
router.post('/threads/:threadId/messages', validateBody(replySchema), async (req, res) => {
  const { status, data } = await marketplaceFetch(req.tenantId, `/internal/threads/${encodeURIComponent(req.params.threadId)}/messages`, {
    method: 'POST',
    body: {
      text: req.body.text,
      agentUserId: req.user?.userId || req.user?.sub || null,
      agentName: req.user?.name || req.user?.displayName || req.user?.email || 'Agent',
    },
  });
  return res.status(status).json(data);
});

/** POST /threads/:threadId/read */
router.post('/threads/:threadId/read', async (req, res) => {
  const { status, data } = await marketplaceFetch(req.tenantId, `/internal/threads/${encodeURIComponent(req.params.threadId)}/read`, { method: 'POST', body: {} });
  return res.status(status).json(data);
});

export default router;
