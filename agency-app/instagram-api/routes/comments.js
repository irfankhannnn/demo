// Comments on the connected accounts' posts (JWT auth).
//
//   GET  /comments?mediaId=&limit=     newest first, with the post each is on
//   POST /comments/:commentId/reply    { text, mode: 'public' | 'private' }

import express from 'express';
import { logger } from '../logger.js';
import * as defaultDb from '../services/dynamoService.js';
import { canSend } from '../services/windowPolicy.js';
import { ServiceError } from '../services/instagramService.js';

const log = logger.child({ module: 'routes/comments' });

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function fail(res, err, fallback) {
  if (err instanceof ServiceError) return res.status(err.status).json({ error: err.error, details: err.details });
  log.error('comments.failed', { error: err?.message });
  return res.status(500).json({ error: 'Internal Server Error', details: fallback });
}

/** The API shape of a stored comment, with whether a private reply is still possible. */
function shape(comment, media, now = Date.now()) {
  const alreadyReplied = Boolean(comment.privateReplyAt || comment.privateReply === 'sent');
  const verdict = alreadyReplied
    ? { allowed: false, reason: 'this comment already has its one private reply' }
    : canSend({ kind: 'private_reply', commentCreatedAt: comment.commentCreatedAt }, now);
  return {
    commentId: comment.commentId,
    igUserId: comment.igUserId ?? null,
    mediaId: comment.mediaId ?? null,
    text: comment.text ?? '',
    fromId: comment.fromId ?? null,
    fromUsername: comment.fromUsername ?? null,
    createdAt: comment.commentCreatedAt ?? null,
    status: comment.status ?? null,
    ruleId: comment.ruleId ?? null,
    lastReply: comment.lastReply ?? null,
    privateReplyAllowed: verdict.allowed,
    privateReplyReason: verdict.reason,
    media: media
      ? { caption: media.caption ?? null, permalink: media.permalink ?? null, thumbnailUrl: media.thumbnailUrl ?? null }
      : null,
  };
}

export function createCommentsRouter({ db = defaultDb, service }) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    try {
      const [comments, media] = await Promise.all([db.listComments(req.tenantId), db.listMedia(req.tenantId)]);
      const mediaById = new Map(media.map((m) => [m.mediaId, m]));
      const now = Date.now();
      const items = comments
        .filter((c) => !req.query.mediaId || c.mediaId === req.query.mediaId)
        .sort((a, b) => String(b.commentCreatedAt || '').localeCompare(String(a.commentCreatedAt || '')))
        .slice(0, limit)
        .map((c) => shape(c, mediaById.get(c.mediaId), now));
      return res.json({ comments: items });
    } catch (err) {
      return fail(res, err, 'Failed to list comments');
    }
  });

  router.post('/:commentId/reply', async (req, res) => {
    const { text, mode = 'public' } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Bad Request', details: 'text is required' });
    }
    try {
      const result = await service.replyToComment({
        tenantId: req.tenantId,
        userId: req.user?.userId || req.user?.email || null,
        commentId: req.params.commentId,
        text,
        mode,
      });
      const media = result.comment.mediaId ? await db.getMedia(req.tenantId, result.comment.mediaId) : null;
      return res.status(201).json({ comment: shape(result.comment, media), status: result.status });
    } catch (err) {
      return fail(res, err, 'Failed to reply to the comment');
    }
  });

  return router;
}

export default createCommentsRouter;
