// Instagram Business Login.
//
//   POST /oauth/start     (JWT)  -> { authorizeUrl } for the signed-in agency
//   GET  /oauth/callback  (open) <- Instagram redirects the browser here
//
// The start endpoint returns the URL instead of redirecting because the
// browser app authenticates with a bearer header, which a plain navigation
// cannot carry. The tenant travels through Instagram inside the signed state.

import express from 'express';
import { getConfig } from '../config/env.js';
import { logger } from '../logger.js';
import { OAuthStateError } from '../services/metaSecurity.js';
import { ServiceError } from '../services/instagramService.js';

const log = logger.child({ module: 'routes/oauth' });

function sendServiceError(res, err, fallback) {
  if (err instanceof ServiceError) return res.status(err.status).json({ error: err.error, details: err.details });
  log.error('oauth.failed', { name: err?.name, kind: err?.kind, code: err?.code });
  return res.status(500).json({ error: 'Internal Server Error', details: fallback });
}

export function createOAuthStartRouter({ service }) {
  const router = express.Router();

  router.post('/oauth/start', (req, res) => {
    try {
      const { authorizeUrl } = service.startConnect({
        tenantId: req.tenantId,
        userId: req.user?.userId || req.user?.email || null,
      });
      return res.json({ authorizeUrl });
    } catch (err) {
      return sendServiceError(res, err, 'Could not start the Instagram connection');
    }
  });

  return router;
}

function landingUrl(params) {
  const base = getConfig().consoleUrl;
  const query = new URLSearchParams(params).toString();
  return base ? `${base}/accounts?${query}` : null;
}

function finish(res, params) {
  const url = landingUrl(params);
  if (url) return res.redirect(302, url);
  // No console URL configured (local API-only testing): say what happened.
  const ok = Boolean(params.connected);
  const text = ok ? `Instagram account @${params.connected} connected.` : `Instagram connection failed: ${params.error}`;
  return res
    .status(ok ? 200 : 400)
    .type('html')
    .send(`<!doctype html><meta charset="utf-8"><title>Instagram</title><p style="font-family:system-ui;padding:2rem">${text.replace(/[<>&"]/g, '')}</p>`);
}

export function createOAuthCallbackRouter({ service }) {
  const router = express.Router();

  router.get('/oauth/callback', async (req, res) => {
    const { code, state, error, error_reason: reason, error_description: description } = req.query;

    if (error) {
      // The person clicked "Not now" on Instagram's consent screen, or Meta
      // refused (for example an account that is not an app tester yet).
      log.warn('oauth.callback.denied', { error, reason });
      return finish(res, { error: String(description || reason || error).slice(0, 200) });
    }
    if (!code || !state) {
      return finish(res, { error: 'Instagram did not return an authorization code' });
    }

    try {
      // Instagram appends "#_" to the code in some clients.
      const cleanCode = String(code).replace(/#_$/, '');
      const { account } = await service.completeConnect({ code: cleanCode, state: String(state) });
      return finish(res, { connected: account.username || account.igUserId });
    } catch (err) {
      if (err instanceof OAuthStateError) return finish(res, { error: err.message });
      if (err instanceof ServiceError) return finish(res, { error: err.details || err.error });
      log.error('oauth.callback.failed', { name: err?.name, kind: err?.kind, code: err?.code, error: err?.message });
      return finish(res, { error: `Instagram connection failed: ${err?.message || 'unexpected error'}`.slice(0, 200) });
    }
  });

  return router;
}

export default { createOAuthStartRouter, createOAuthCallbackRouter };
