/**
 * A1 - Instagram Business Login (OAuth).
 *
 * The flow, all of it on the owner's own machine:
 *   1. Start a loopback listener on 127.0.0.1:<oauthRedirectPort>.
 *   2. Open Instagram's consent screen in the default browser.
 *   3. Catch `?code=` on the redirect, exchange it for a short-lived token.
 *   4. Exchange short-lived -> long-lived (60 days).
 *   5. Read /me to learn the account, store both in the vault.
 *   6. A daily check refreshes at day 50 (see DevModeProvider.refreshIfDue).
 *
 * Endpoints are exactly ARCHITECTURE section 6. Scopes are the post-Jan-2025
 * `instagram_business_*` names; the retired `instagram_manage_*` names are gone.
 */
import crypto from 'node:crypto';
import http from 'node:http';
import { URL } from 'node:url';
import { loadConfig } from '../util/config.js';
import { putToken } from './vault.js';
import { upsertAccount, audit } from '../store/repos.js';
import { logger } from '../util/logger.js';
import { now } from '../util/time.js';

const log = logger('auth/oauth');

/** App credentials come from the environment, never from config.json. */
export function appCredentials() {
  const appId = process.env.IG_APP_ID;
  const appSecret = process.env.IG_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      'IG_APP_ID and IG_APP_SECRET must be set (a .env file next to the agent works). ' +
      'These come from your Meta app -> Instagram -> API setup with Instagram login.',
    );
  }
  return { appId, appSecret };
}

export function redirectUri(cfg = loadConfig()) {
  return process.env.IG_REDIRECT_URI || `http://localhost:${cfg.oauthRedirectPort}/callback`;
}

export function buildAuthorizeUrl(cfg = loadConfig(), state = crypto.randomBytes(16).toString('hex')) {
  const { appId } = appCredentials();
  const url = new URL(cfg.oauthAuthorizeUrl);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri(cfg));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', cfg.scopes.join(','));
  url.searchParams.set('state', state);
  return { url: url.toString(), state };
}

/**
 * Loopback listener. Resolves with the authorization code.
 * Binds 127.0.0.1 only - the agent never opens an inbound port to the network.
 */
export function waitForCallback(cfg = loadConfig(), expectedState, timeoutMs = 5 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${cfg.oauthRedirectPort}`);
      if (u.pathname !== '/callback') {
        res.writeHead(404).end('not found');
        return;
      }
      const code = u.searchParams.get('code');
      const state = u.searchParams.get('state');
      const error = u.searchParams.get('error_description') || u.searchParams.get('error');

      const done = (ok, msg) => {
        res.writeHead(ok ? 200 : 400, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><meta charset="utf-8"><title>ig-agent</title>
<body style="font-family:system-ui;padding:3rem;max-width:34rem">
<h2>${ok ? 'Instagram connected' : 'Connection failed'}</h2>
<p>${msg}</p><p>You can close this tab and go back to the terminal.</p></body>`);
        server.close();
      };

      if (error) { done(false, String(error)); reject(new Error(`Instagram returned: ${error}`)); return; }
      if (!code) { done(false, 'No authorization code in the redirect.'); reject(new Error('no code in callback')); return; }
      if (expectedState && state !== expectedState) {
        done(false, 'State mismatch - the request did not originate here.');
        reject(new Error('OAuth state mismatch'));
        return;
      }
      done(true, 'Token exchange is running in the terminal.');
      resolve(code);
    });

    server.on('error', reject);
    server.listen(cfg.oauthRedirectPort, '127.0.0.1', () => {
      log.info('waiting for the Instagram redirect', { port: cfg.oauthRedirectPort });
    });

    setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for the Instagram redirect.'));
    }, timeoutMs).unref?.();
  });
}

async function postForm(url, form) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error_message || body?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Instagram token endpoint: ${msg}`);
  }
  return body;
}

async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Instagram Graph: ${msg}`);
  }
  return body;
}

/** Step 3: authorization code -> short-lived token (1 hour). */
export async function exchangeCode(code, cfg = loadConfig()) {
  const { appId, appSecret } = appCredentials();
  return postForm(cfg.oauthTokenUrl, {
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(cfg),
    code,
  });
}

/** Step 4: short-lived -> long-lived (60 days). */
export async function exchangeForLongLived(shortToken, cfg = loadConfig()) {
  const { appSecret } = appCredentials();
  const url = new URL(`${cfg.graphBase.replace(/\/v[\d.]+$/, '')}/access_token`);
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('access_token', shortToken);
  return getJson(url.toString());
}

/** Day-50 refresh. Requires a token 24h+ old and not yet expired. */
export async function refreshLongLivedToken(longToken, cfg = loadConfig()) {
  const url = new URL(`${cfg.graphBase.replace(/\/v[\d.]+$/, '')}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', longToken);
  return getJson(url.toString());
}

/** Step 5: who did we just connect? */
export async function fetchMe(accessToken, cfg = loadConfig()) {
  const url = new URL(`${cfg.graphBase}/me`);
  url.searchParams.set(
    'fields',
    'user_id,username,name,account_type,followers_count,follows_count,media_count,biography,profile_picture_url',
  );
  url.searchParams.set('access_token', accessToken);
  return getJson(url.toString());
}

/**
 * The whole `ig-agent connect` flow.
 * `openBrowser` is injectable so tests and headless runs can print the URL instead.
 */
export async function connectAccount({ cfg = loadConfig(), openBrowser = null } = {}) {
  const { url, state } = buildAuthorizeUrl(cfg);
  const waiter = waitForCallback(cfg, state);

  if (openBrowser) {
    await openBrowser(url);
  } else {
    try {
      const { default: open } = await import('open');
      await open(url);
    } catch {
      log.warn('could not open a browser automatically');
    }
  }
  process.stdout.write(`\nIf a browser did not open, paste this into one:\n\n${url}\n\n`);

  const code = await waiter;
  const short = await exchangeCode(code, cfg);
  const long = await exchangeForLongLived(short.access_token, cfg);
  const me = await fetchMe(long.access_token, cfg);

  const igUserId = String(me.user_id ?? me.id);
  const expiresAt = long.expires_in ? now() + long.expires_in * 1000 : null;

  upsertAccount({
    igUserId,
    username: me.username,
    name: me.name,
    biography: me.biography,
    profilePictureUrl: me.profile_picture_url,
    accountType: me.account_type,
    followersCount: me.followers_count,
    followsCount: me.follows_count,
    mediaCount: me.media_count,
    tokenExpiresAt: expiresAt,
    status: 'connected',
    connectedAt: now(),
  });
  putToken(igUserId, long.access_token, { expiresInSec: long.expires_in, scopes: cfg.scopes });

  audit({ scope: 'auth', action: 'account.connect', igUserId, subjectType: 'account', subjectId: igUserId,
    outcome: 'ok', detail: { username: me.username, scopes: cfg.scopes } });

  return { igUserId, username: me.username, expiresAt };
}
