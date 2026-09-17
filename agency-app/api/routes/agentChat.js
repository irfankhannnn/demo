/**
 * In-CRM AI chat — POST /api/crm/agent-chat  (Phase 5)
 *
 * The web channel's transport. Speaks Server-Sent Events so the UI can show
 * tool activity while a multi-step turn runs, instead of a spinner.
 *
 * ON STREAMING, HONESTLY
 *
 * The Lambda entry point is `@vendia/serverless-express`, which buffers the
 * whole response before returning it, and the plan's assumed API Gateway REST
 * `ResponseTransferMode: STREAM` is recorded as unverified in
 * `03-implementation-plan.md`. So in the current deployment these events do
 * NOT arrive incrementally — the client receives the full event sequence at
 * once, at the end.
 *
 * That is deliberate rather than a compromise: the wire format is SSE either
 * way, so the client is written once. Putting this route behind a Lambda
 * Function URL with `awslambda.streamifyResponse` (the fallback the plan names)
 * makes it stream for real with **no client change and no server change**.
 * Locally, under plain Express, it already streams today.
 *
 * The alternative — shipping a buffered JSON endpoint now and rewriting both
 * sides later — would mean building the client twice.
 */

import express from 'express';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireCrmMemberOrAbove } from '../middleware/requireRole.js';
import { runWebTurn, MAX_WEB_MESSAGE_CHARS } from '../agents/channels/webChannel.js';
import { logger } from '../logger.js';

const router = express.Router();

router.use(validateToken);
router.use(extractTenantId);
// Any CRM user may use the assistant. What they can *do* through it is decided
// per-tool by their RBAC category, derived from this same role.
router.use(requireCrmMemberOrAbove);

function actingUser(req) {
  return {
    userId: req.user?.userId || req.user?.id || req.user?.sub || null,
    role: req.user?.role || null,
  };
}

/**
 * Write one SSE frame.
 *
 * `event:` names the frame so the client can use addEventListener per type
 * rather than switching on a payload field. Data is always one line — JSON
 * never contains a raw newline, so no multi-line continuation is needed.
 */
function sendEvent(res, type, payload) {
  res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
  // Present when compression middleware is active; absent on a plain socket.
  res.flush?.();
}

router.post('/', async (req, res) => {
  const tenantId = req.tenantId;
  const { userId, role } = actingUser(req);
  const { message, history } = req.body || {};

  if (!userId) {
    return res.status(401).json({ error: 'Could not identify the signed-in user' });
  }
  if (typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.length > MAX_WEB_MESSAGE_CHARS) {
    return res.status(413).json({
      error: `Message exceeds the ${MAX_WEB_MESSAGE_CHARS} character limit`,
    });
  }

  // Headers must go out before any event. After this point the status code is
  // committed, so downstream failures are reported as an `error` EVENT rather
  // than an HTTP status — the client handles both.
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Tells nginx and friends not to buffer, which would defeat streaming
    // wherever a proxy sits in front of this.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  let clientGone = false;
  req.on('close', () => { clientGone = true; });

  try {
    const result = await runWebTurn({
      tenantId,
      userId,
      role,
      text: message,
      history,
      onEvent: (event) => {
        if (clientGone) return;
        sendEvent(res, event.type, event);
      },
    });

    if (clientGone) return res.end();

    if (!result.ok) {
      sendEvent(res, 'error', { error: result.error });
      return res.end();
    }

    sendEvent(res, 'message', {
      text: result.text,
      // Entity cards render from these. Only the tool name and its result are
      // sent — the arguments can contain the user's raw phrasing and add
      // nothing the client needs.
      toolResults: (result.toolResults || []).map((t) => ({
        tool: t.tool,
        result: t.result,
      })),
      durationMs: result.durationMs,
    });
    sendEvent(res, 'done', { ok: true });
    return res.end();
  } catch (err) {
    logger.error('agentChat.failed', { tenantId, userId, error: err.message });
    if (!clientGone) {
      sendEvent(res, 'error', { error: 'Something went wrong. Please try again.' });
    }
    return res.end();
  }
});

export default router;
