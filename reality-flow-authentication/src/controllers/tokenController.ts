import { Request, Response } from 'express';
import axios from 'axios';
import { getConfig } from '../config/config';
import { ok, badRequest, internalError } from '../utils/http';
import { GOOGLE_AUTH_ERRORS } from '../types/errors';
import { setRefreshTokenCookie, getRefreshTokenFromCookie, clearRefreshTokenCookie } from '../utils/cookies';
import { logger } from '../utils/logger';

/**
 * Origins the Capacitor WebView reports: capacitor://localhost on iOS,
 * https://localhost on Android.
 */
const NATIVE_ORIGINS = new Set(['capacitor://localhost', 'https://localhost']);

/**
 * Whether to return the refresh token in the response body.
 *
 * Native apps cannot use the httpOnly cookie: capacitor://localhost is not a
 * trustworthy origin for a Secure cookie, and WKWebView blocks it as a
 * third-party cookie against this domain. Public native clients are expected to
 * hold a refresh token in device secure storage (RFC 8252); the app keeps it in
 * the iOS Keychain / Android Keystore.
 *
 * Keyed on the Origin header, NOT on the X-Client-Platform hint. A browser
 * cannot forge Origin, so an XSS on the web app cannot ask for the refresh
 * token in a readable body and escalate a session-scoped compromise into 30 days
 * of stolen access. The header is accepted as an explicit signal but is never
 * sufficient on its own.
 */
function wantsRefreshTokenInBody(req: Request): boolean {
  const origin = String(req.headers.origin || '').trim();
  return NATIVE_ORIGINS.has(origin);
}

/**
 * POST /auth/token
 * Exchanges authorization code for tokens (server-side)
 * This keeps the client secret secure on the server
 */
export async function exchangeToken(req: Request, res: Response): Promise<void> {
  const { code, code_verifier, redirect_uri } = req.body;

  if (!code || !code_verifier || !redirect_uri) {
    badRequest(res, 'Missing required fields: code, code_verifier, redirect_uri');
    return;
  }

  try {
    const config = getConfig();
    const tokenUrl = `${config.COGNITO_HOSTED_UI_DOMAIN}/oauth2/token`;

    // Build params object, only include client_secret if it exists
    const params: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: config.COGNITO_CLIENT_ID,
      redirect_uri,
      code,
      code_verifier,
    };

    if (config.COGNITO_CLIENT_SECRET) {
      params.client_secret = config.COGNITO_CLIENT_SECRET;
    }

    // Exchange code for tokens with Cognito
    const response = await axios.post(
      tokenUrl,
      new URLSearchParams(params).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // Set refresh token as httpOnly cookie (not accessible to JS)
    if (response.data.refresh_token) {
      setRefreshTokenCookie(res, response.data.refresh_token);
    }

    // Return tokens to frontend. refresh_token is omitted for web clients, which
    // get it as an httpOnly cookie above, and included only for native clients.
    ok(res, {
      id_token: response.data.id_token,
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
      token_type: response.data.token_type,
      ...(wantsRefreshTokenInBody(req) && response.data.refresh_token
        ? { refresh_token: response.data.refresh_token }
        : {}),
    });
  } catch (error: any) {
    logger.error('token.exchange_failed', { error: error.response?.data || error.message });
    
    if (error.response) {
      const cognitoError = error.response.data;
      
      // Handle specific Google OAuth errors
      if (cognitoError.error === 'invalid_grant') {
        if (cognitoError.error_description?.includes('authorization code') || 
            cognitoError.error_description?.includes('expired')) {
          res.status(400).json({
            error: GOOGLE_AUTH_ERRORS.INVALID_AUTH_CODE.code,
            message: GOOGLE_AUTH_ERRORS.INVALID_AUTH_CODE.message,
            retryable: GOOGLE_AUTH_ERRORS.INVALID_AUTH_CODE.retryable,
            details: cognitoError.error_description,
          });
          return;
        }
      }
      
      if (cognitoError.error === 'access_denied') {
        res.status(403).json({
          error: GOOGLE_AUTH_ERRORS.ACCESS_DENIED.code,
          message: GOOGLE_AUTH_ERRORS.ACCESS_DENIED.message,
          retryable: GOOGLE_AUTH_ERRORS.ACCESS_DENIED.retryable,
          details: cognitoError.error_description,
        });
        return;
      }
      
      // Forward other Cognito errors with better formatting
      res.status(error.response.status).json({
        error: cognitoError.error || GOOGLE_AUTH_ERRORS.TOKEN_EXCHANGE_FAILED.code,
        message: cognitoError.error_description || GOOGLE_AUTH_ERRORS.TOKEN_EXCHANGE_FAILED.message,
        retryable: false,
        details: cognitoError,
      });
      return;
    }

    // Network or other errors
    res.status(500).json({
      error: GOOGLE_AUTH_ERRORS.NETWORK_ERROR.code,
      message: GOOGLE_AUTH_ERRORS.NETWORK_ERROR.message,
      retryable: GOOGLE_AUTH_ERRORS.NETWORK_ERROR.retryable,
    });
  }
}

/**
 * POST /auth/refresh
 * Refreshes access token using refresh token from httpOnly cookie
 */
export async function refreshToken(req: Request, res: Response): Promise<void> {
  const refresh_token = getRefreshTokenFromCookie(req) || req.body?.refresh_token;

  if (!refresh_token) {
    badRequest(res, 'Missing refresh_token');
    return;
  }

  try {
    const config = getConfig();
    const tokenUrl = `${config.COGNITO_HOSTED_UI_DOMAIN}/oauth2/token`;

    // Build params object, only include client_secret if it exists
    const params: Record<string, string> = {
      grant_type: 'refresh_token',
      client_id: config.COGNITO_CLIENT_ID,
      refresh_token,
    };

    if (config.COGNITO_CLIENT_SECRET) {
      params.client_secret = config.COGNITO_CLIENT_SECRET;
    }

    const response = await axios.post(
      tokenUrl,
      new URLSearchParams(params).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // Rotate refresh token: set new one as cookie if provided
    if (response.data.refresh_token) {
      setRefreshTokenCookie(res, response.data.refresh_token);
    }

    ok(res, {
      id_token: response.data.id_token,
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
      token_type: response.data.token_type,
      // Cognito rotates refresh tokens. A native client that never receives the
      // rotated value would fail its next refresh and be signed out silently.
      ...(wantsRefreshTokenInBody(req) && response.data.refresh_token
        ? { refresh_token: response.data.refresh_token }
        : {}),
    });
  } catch (error: any) {
    logger.error('token.refresh_failed', { error: error.response?.data || error.message });
    
    if (error.response) {
      res.status(error.response.status).json({
        error: error.response.data.error || 'token_refresh_failed',
        error_description: error.response.data.error_description || 'Failed to refresh token',
      });
      return;
    }

    internalError(res, 'Token refresh failed');
  }
}
