/**
 * Service-facing routes: the agency inbox (called by the CRM's
 * /api/crm/marketplace/* proxies) and account deletion (called by
 * marketplace-authentication).
 *
 * Tenant scoping is the whole security story here. The CRM derives
 * `x-tenant-id` from the agent's own JWT and forwards it; every thread-scoped
 * route checks that header against the thread's tenantId and answers 404 —
 * not 403 — on a mismatch, so one agency cannot even confirm that another
 * agency's thread id exists. The buyer's contact details appear only on
 * these routes, never on anything a browser session can reach.
 */

import express from 'express';
import * as threads from '../services/threadsRepo.js';
import * as users from '../services/usersRepo.js';
import { notifyBuyerOfReply } from '../services/buyerNotify.js';
import { internalAuth, requireTenantHeader } from '../middleware/internalAuth.js';
import { logger } from '../logger.js';

const router = express.Router();
router.use(internalAuth);

const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function guarded(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

/** Thread belonging to the header's tenant, or a 404 already sent. */
async function tenantThread(req, res) {
  if (!ID_RE.test(req.params.threadId)) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  const thread = await threads.getThread(req.params.threadId);
  if (!thread || thread.tenantId !== req.tenantId) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  return thread;
}

function agencyView(item) {
  return { ...threads.toThread(item), buyer: threads.toBuyer(item) };
}

// ── agency inbox ───────────────────────────────────────────────────────────

router.get('/tenants/:tenantId/threads', guarded(async (req, res) => {
  if (!ID_RE.test(req.params.tenantId)) return res.status(404).json({ error: 'Not found' });
  // The path tenant is authoritative; when the header is also present the
  // two must agree, or a mis-wired proxy would leak one agency's inbox to another.
  const header = req.headers['x-tenant-id'];
  if (header && header !== req.params.tenantId) return res.status(404).json({ error: 'Not found' });

  const status = typeof req.query.status === 'string' && threads.THREAD_STATUSES.includes(req.query.status) ? req.query.status : null;
  const page = await threads.listThreadsForTenant(req.params.tenantId, {
    status,
    limit: Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100),
    cursor: typeof req.query.cursor === 'string' ? req.query.cursor : null,
  });
  return res.json({ items: page.items.map(agencyView), nextCursor: page.nextCursor });
}));

router.get('/threads/:threadId', requireTenantHeader, guarded(async (req, res) => {
  const thread = await tenantThread(req, res);
  if (!thread) return undefined;
  const since = typeof req.query.since === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(req.query.since) ? req.query.since : null;
  const messages = await threads.listMessages(thread.threadId, { since });
  return res.json({ thread: threads.toThread(thread), buyer: threads.toBuyer(thread), messages });
}));

/** Agent reply → unreadBuyer++ and a best-effort email to the buyer. */
router.post('/threads/:threadId/messages', requireTenantHeader, guarded(async (req, res) => {
  const thread = await tenantThread(req, res);
  if (!thread) return undefined;
  const body = req.body || {};
  const text = str(body.text, 2000);
  if (!text) return res.status(400).json({ error: 'text is required' });
  const agentUserId = str(body.agentUserId, 80) || null;
  const agentName = str(body.agentName, 120) || thread.snapshot?.agencyName || 'Agent';

  const { message } = await threads.appendMessage(thread.threadId, {
    senderType: 'agency', senderId: agentUserId, senderName: agentName, text, kind: 'text',
  });

  if (!thread.buyerDeleted) {
    // Fire-and-forget would lose the outcome on Lambda freeze; await it but
    // never let it fail the reply.
    await notifyBuyerOfReply(
      { email: thread.buyerEmail, name: thread.buyerName },
      { threadId: thread.threadId, agencyName: thread.snapshot?.agencyName, propertyTitle: thread.snapshot?.title, text },
    );
  }

  return res.status(201).json({ message: threads.toMessage(message) });
}));

router.post('/threads/:threadId/read', requireTenantHeader, guarded(async (req, res) => {
  const thread = await tenantThread(req, res);
  if (!thread) return undefined;
  await threads.markRead(thread.threadId, 'agency');
  return res.json({ ok: true });
}));

/** The agency switched the marketplace off or churned: every open thread is closed. */
router.post('/tenants/:tenantId/closed', guarded(async (req, res) => {
  if (!ID_RE.test(req.params.tenantId)) return res.status(404).json({ error: 'Not found' });
  const header = req.headers['x-tenant-id'];
  if (header && header !== req.params.tenantId) return res.status(404).json({ error: 'Not found' });
  const updated = await threads.closeTenantThreads(req.params.tenantId);
  return res.json({ updated });
}));

/** The agency switched the marketplace back on: its agency_closed threads reopen. */
router.post('/tenants/:tenantId/reopened', guarded(async (req, res) => {
  if (!ID_RE.test(req.params.tenantId)) return res.status(404).json({ error: 'Not found' });
  const header = req.headers['x-tenant-id'];
  if (header && header !== req.params.tenantId) return res.status(404).json({ error: 'Not found' });
  const updated = await threads.reopenTenantThreads(req.params.tenantId);
  return res.json({ updated });
}));

// ── account deletion (marketplace-authentication) ──────────────────────────

/**
 * Profile, saved items and searches are deleted outright; threads are kept
 * and anonymised, because the agency's half of a conversation is the
 * agency's business record. Idempotent: a second call finds nothing and
 * still answers ok.
 */
router.delete('/users/:userId', guarded(async (req, res) => {
  if (!ID_RE.test(req.params.userId)) return res.status(404).json({ error: 'Not found' });
  const { deleted, threadIds } = await users.deleteUserData(req.params.userId);
  const anonymised = await threads.anonymiseBuyer(req.params.userId, threadIds);
  logger.info('internal.user_deleted', { userId: req.params.userId, deleted, ...anonymised, caller: req.caller });
  return res.json({ ok: true });
}));

export default router;
