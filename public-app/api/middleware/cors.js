/**
 * CORS for the browser SPA.
 *
 * The allowlist is MARKETPLACE_WEB_ORIGIN (comma-separated if the web app is
 * served from more than one host, e.g. a preview and production). The
 * marketplace domain is not chosen yet, so the variable may be empty:
 *
 *   empty + development  → reflect whatever Origin asks (any localhost port
 *                          works without editing .env)
 *   empty + production   → no CORS headers at all. A browser on another
 *                          origin gets opaque failures, which is the correct
 *                          state for an API whose web front-end does not
 *                          exist yet.
 *
 * Credentials are never allowed: the access token travels in the
 * Authorization header, not a cookie, so there is nothing to send.
 */

import { config } from '../config/env.js';

const ALLOW_METHODS = 'GET,POST,PUT,DELETE,OPTIONS';
const ALLOW_HEADERS = 'Authorization,Content-Type';

function allowedOrigin(origin) {
  if (!origin) return null;
  const clean = String(origin).replace(/\/+$/, '');
  if (config.webOrigins.length > 0) {
    return config.webOrigins.includes(clean) ? clean : null;
  }
  return config.nodeEnv === 'production' ? null : clean;
}

export function cors(req, res, next) {
  // Vary on Origin even when nothing is allowed, so a shared cache never
  // serves one origin's (header-less) response to another that is allowed.
  res.append('Vary', 'Origin');

  const origin = allowedOrigin(req.headers.origin);
  if (origin) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': ALLOW_METHODS,
      'Access-Control-Allow-Headers': ALLOW_HEADERS,
      'Access-Control-Max-Age': '600',
    });
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  return next();
}
