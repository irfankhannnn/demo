// DM inbox (JWT auth).
//
//   GET  /threads                      list, with the live Meta window per thread
//   GET  /threads/:threadId            messages, analysis, enquiry, can-reply verdict
//   POST /threads/:threadId/reply      a person sends; the window policy decides
//   POST /threads/:threadId/analyse    re-run the lead analysis now

import express from 'express';
import { logger } from '../logger.js';
import * as defaultDb from '../services/dynamoService.js';
import { WINDOW_STATES } from '../services/normalise.js';
import { canSend } from '../services/windowPolicy.js';
import { ServiceError } from '../services/instagramService.js';

const log = logger.child({ module: 'routes/threads' });

function fail(res, err, fallback) {
  if (err instanceof ServiceError) return res.status(err.status).json({ error: err.error, details: err.details });
  log.error('threads.failed', { error: err?.message });
  return res.status(500).json({ error: 'Internal Server Error', details: fallback });
}

export function createThreadsRouter({ db = defaultDb, service }) {
  const router = express.Router();

  // GET /threads?windowState=&unanswered=&igUserId=
  router.get('/', async (req, res) => {
    const { windowState, unanswered, igUserId, limit } = req.query;

    if (windowState && !WINDOW_STATES.has(windowState)) {
      return res.status(400).json({ error: 'Bad Request', details: `Unknown windowState: ${windowState}` });
    }

    // Tri-state on purpose: absent means "no filter", which is different from
    // unanswered=false meaning "only the answered ones".
    let unansweredFilter;
    if (unanswered !== undefined) unansweredFilter = unanswered === 'true' || unanswered === '1';

    try {
      const all = await db.listThreads(req.tenantId, { windowState, unanswered: unansweredFilter, igUserId });
      // A thread seeded only by a comment has no conversation to show yet.
      const threads = all
        .filter((t) => (t.messageCount || 0) > 0)
        .sort((a, b) => String(b.lastMessageAt || '').localeCompare(String(a.lastMessageAt || '')))
        .slice(0, Math.min(Number.parseInt(limit, 10) || 200, 500));

      return res.json({
        threads,
        counts: { total: threads.length, unanswered: threads.filter((t) => t.unanswered).length },
      });
    } catch (err) {
      return fail(res, err, 'Failed to list threads');
    }
  });

  router.get('/:threadId', async (req, res) => {
    try {
      const thread = await db.getThread(req.tenantId, req.params.threadId);
      if (!thread) return res.status(404).json({ error: 'Not Found', details: 'Thread not found' });

      const [messages, enquiry] = await Promise.all([
        db.listMessages(req.tenantId, thread.threadId),
        thread.enquiryId ? db.getEnquiry(req.tenantId, thread.enquiryId) : null,
      ]);
      const verdict = canSend({ kind: 'dm', thread });

      return res.json({
        thread: db.withWindow(thread),
        messages: messages.slice(-200).map((m) => ({
          messageId: m.messageId,
          direction: m.direction,
          text: m.text,
          createdAt: m.createdAt,
          source: m.source ?? null,
          status: m.status ?? null,
        })),
        enquiry: enquiry || null,
        canReply: { allowed: verdict.allowed, reason: verdict.reason },
      });
    } catch (err) {
      return fail(res, err, 'Failed to load thread');
    }
  });

  router.post('/:threadId/reply', async (req, res) => {
    const text = req.body?.text;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Bad Request', details: 'text is required' });
    }
    try {
      const result = await service.sendReply({
        tenantId: req.tenantId,
        userId: req.user?.userId || req.user?.email || null,
        threadId: req.params.threadId,
        text,
      });
      return res.status(201).json(result);
    } catch (err) {
      return fail(res, err, 'Failed to send the reply');
    }
  });

  router.post('/:threadId/analyse', async (req, res) => {
    try {
      const thread = await db.getThread(req.tenantId, req.params.threadId);
      if (!thread) return res.status(404).json({ error: 'Not Found', details: 'Thread not found' });
      const account = await db.getAccount(req.tenantId, thread.igUserId);
      if (!account) return res.status(404).json({ error: 'Not Found', details: 'Instagram account not found' });

      const result = await service.analyseThread({ ...account, tenantId: req.tenantId }, thread);
      const fresh = await db.getThread(req.tenantId, thread.threadId);
      return res.json({ thread: db.withWindow(fresh), enquiry: result.enquiry });
    } catch (err) {
      return fail(res, err, 'Analysis failed');
    }
  });

  return router;
}

export default createThreadsRouter;
