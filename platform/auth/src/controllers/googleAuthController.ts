import { Request, Response } from 'express';
import { getConfig } from '../config/config';
import { ok, badRequest } from '../utils/http';
import { generateCodeVerifier, generateCodeChallenge } from '../utils/pkce';
import { logger } from '../utils/logger';

/**
 * GET /auth/google/url
 * Generate Google OAuth authorization URL with PKCE
 */
export async function getGoogleAuthUrl(req: Request, res: Response): Promise<void> {
  try {
    const { redirect_uri, state } = req.query;
    
    if (!redirect_uri || typeof redirect_uri !== 'string') {
      badRequest(res, 'redirect_uri query parameter is required');
      return;
    }

    const config = getConfig();
    const authUrl = new URL(`${config.COGNITO_HOSTED_UI_DOMAIN}/oauth2/authorize`);
    
    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    // Set OAuth parameters
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', config.COGNITO_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirect_uri);
    authUrl.searchParams.set('scope', 'openid email profile phone');
    authUrl.searchParams.set('identity_provider', 'Google');
    // Show Google's account chooser instead of silently reusing the browser's
    // signed-in account (forwarded by Cognito on managed login only).
    authUrl.searchParams.set('prompt', 'select_account');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    
    if (state && typeof state === 'string') {
      authUrl.searchParams.set('state', state);
    }
    
    logger.info('[GOOGLE_AUTH_URL] Generated auth URL for redirect_uri', { redirect_uri });
    
    ok(res, {
      authUrl: authUrl.toString(),
      codeVerifier,  // Frontend must store this for token exchange
      state: state || null,
    });
  } catch (error) {
    logger.error('[GOOGLE_AUTH_URL] Error', { error });
    badRequest(res, 'Failed to generate Google auth URL');
  }
}

