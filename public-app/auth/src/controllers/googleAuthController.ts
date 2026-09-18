import { Request, Response } from 'express';
import { getConfig } from '../config/config';
import { ok, badRequest } from '../utils/http';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../utils/pkce';
import { logger } from '../utils/logger';

/**
 * GET /auth/google/url?redirectUri=<marketplace-web callback>[&state=…]
 *
 * Builds the Cognito managed-login authorize URL for the Google IdP with
 * PKCE (S256). The SPA stores `codeVerifier` + `state`, sends the user to
 * `url`, and on return calls POST /auth/token with the code.
 *
 * Response: { url, state, codeVerifier }
 */
export async function getGoogleAuthUrl(req: Request, res: Response): Promise<void> {
  const redirectUri = typeof req.query.redirectUri === 'string' ? req.query.redirectUri.trim() : '';
  if (!redirectUri) {
    badRequest(res, 'redirectUri query parameter is required', 'validation_error');
    return;
  }
  let parsedRedirect: URL;
  try {
    parsedRedirect = new URL(redirectUri);
  } catch {
    badRequest(res, 'redirectUri must be an absolute URL', 'validation_error');
    return;
  }
  if (parsedRedirect.protocol !== 'https:' && parsedRedirect.protocol !== 'http:') {
    badRequest(res, 'redirectUri must be an http(s) URL', 'validation_error');
    return;
  }

  const state =
    typeof req.query.state === 'string' && req.query.state.trim() ? req.query.state.trim() : generateState();

  const config = getConfig();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const url = new URL(`${config.COGNITO_HOSTED_UI_DOMAIN.replace(/\/+$/, '')}/oauth2/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.COGNITO_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'openid email profile phone');
  url.searchParams.set('identity_provider', 'Google');
  // Managed login forwards this to Google so the account chooser appears
  // instead of silently reusing the browser's signed-in account.
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);

  logger.debug('google.url.generated', { redirectUri });
  ok(res, { url: url.toString(), state, codeVerifier });
}
