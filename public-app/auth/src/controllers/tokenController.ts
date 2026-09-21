/**
 * Token endpoints.
 *
 *   POST /auth/token    { code, codeVerifier, redirectUri } → session (same shape as phone confirm)
 *   POST /auth/refresh  cookie mp_refresh                   → { accessToken, idToken, expiresIn }
 *   POST /auth/logout   cookie mp_refresh                   → { ok } (cookie cleared, token revoked)
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { InitiateAuthCommand, RevokeTokenCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getConfig } from '../config/config';
import { getCognito } from '../utils/aws';
import { ok, badRequest, unauthorized, internalError } from '../utils/http';
import { clearRefreshTokenCookie, getRefreshTokenFromCookie, setRefreshTokenCookie } from '../utils/cookies';
import { logger } from '../utils/logger';
import { buildSessionResponse, readIdTokenClaims, resolveUser } from '../services/sessionService';

const exchangeSchema = z.object({
  code: z.string({ required_error: 'code is required' }).min(1, 'code is required'),
  codeVerifier: z.string({ required_error: 'codeVerifier is required' }).min(1, 'codeVerifier is required'),
  redirectUri: z.string({ required_error: 'redirectUri is required' }).url('redirectUri must be an absolute URL'),
});

interface CognitoTokenResponse {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export type Fetcher = typeof fetch;
let fetcher: Fetcher = (...args) => fetch(...args);

/** Test-only: swap the HTTP implementation used for the Cognito token endpoint. */
export function __setTokenFetchForTests(f: Fetcher | null): void {
  fetcher = f ?? ((...args) => fetch(...args));
}

/** POST /auth/token — server-side authorization-code + PKCE exchange. */
export async function exchangeToken(req: Request, res: Response): Promise<void> {
  const parsed = exchangeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? 'Invalid request body', 'validation_error');
    return;
  }
  const { code, codeVerifier, redirectUri } = parsed.data;
  const config = getConfig();

  const params: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: config.COGNITO_CLIENT_ID,
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier,
  };
  if (config.COGNITO_CLIENT_SECRET) params.client_secret = config.COGNITO_CLIENT_SECRET;

  let data: CognitoTokenResponse;
  let status: number;
  try {
    const response = await fetcher(`${config.COGNITO_HOSTED_UI_DOMAIN.replace(/\/+$/, '')}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    status = response.status;
    data = (await response.json().catch(() => ({}))) as CognitoTokenResponse;
  } catch (error) {
    logger.error('token.exchange.network_error', { error });
    internalError(res, 'Could not reach the identity provider', 'network_error');
    return;
  }

  if (status >= 400 || !data.id_token || !data.access_token) {
    logger.warn('token.exchange.rejected', { status, error: data.error, description: data.error_description });
    if (data.error === 'invalid_grant') {
      badRequest(res, 'Authorization code expired or already used. Sign in again.', 'invalid_grant');
    } else if (data.error === 'access_denied') {
      res.status(403).json({ error: 'access_denied', details: 'Sign-in was cancelled or denied' });
    } else {
      badRequest(res, data.error_description ?? 'Token exchange failed', data.error ?? 'token_exchange_failed');
    }
    return;
  }

  const claims = readIdTokenClaims(data.id_token);
  if (!claims) {
    internalError(res, 'Could not read identity from token');
    return;
  }

  try {
    const { user, isNew } = await resolveUser(claims, 'google');
    logger.info('token.exchange.ok', { userId: user.UserId, isNew });
    ok(
      res,
      buildSessionResponse(
        res,
        {
          accessToken: data.access_token,
          idToken: data.id_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in ?? 3600,
        },
        user,
        isNew
      )
    );
  } catch (error) {
    logger.error('token.exchange.resolve_failed', { error });
    internalError(res, 'Could not establish session');
  }
}

/** POST /auth/refresh — refresh token from the httpOnly cookie only. */
export async function refreshToken(req: Request, res: Response): Promise<void> {
  const refresh = getRefreshTokenFromCookie(req);
  if (!refresh) {
    unauthorized(res, 'No refresh token', 'no_refresh_token');
    return;
  }

  try {
    const { COGNITO_CLIENT_ID } = getConfig();
    const result = await getCognito().send(
      new InitiateAuthCommand({
        ClientId: COGNITO_CLIENT_ID,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: { REFRESH_TOKEN: refresh },
      })
    );
    const tokens = result.AuthenticationResult;
    if (!tokens?.AccessToken || !tokens.IdToken) {
      internalError(res, 'Refresh produced no tokens');
      return;
    }
    // Cognito only returns a refresh token here when rotation is on; keep
    // the cookie current either way.
    if (tokens.RefreshToken) setRefreshTokenCookie(res, tokens.RefreshToken);
    ok(res, { accessToken: tokens.AccessToken, idToken: tokens.IdToken, expiresIn: tokens.ExpiresIn ?? 3600 });
  } catch (err) {
    const name = (err as { name?: string })?.name ?? '';
    logger.warn('token.refresh.failed', { error: name || String(err) });
    if (name === 'NotAuthorizedException' || name === 'UserNotFoundException' || name === 'InvalidParameterException') {
      clearRefreshTokenCookie(res);
      unauthorized(res, 'Refresh token invalid or expired. Sign in again.', 'invalid_refresh_token');
      return;
    }
    internalError(res, 'Token refresh failed');
  }
}

/** POST /auth/logout — revoke the refresh token (best-effort) and clear the cookie. */
export async function logout(req: Request, res: Response): Promise<void> {
  const refresh = getRefreshTokenFromCookie(req);
  if (refresh) {
    try {
      await getCognito().send(new RevokeTokenCommand({ ClientId: getConfig().COGNITO_CLIENT_ID, Token: refresh }));
    } catch (error) {
      logger.warn('token.logout.revoke_failed', { error });
    }
  }
  clearRefreshTokenCookie(res);
  ok(res, { ok: true });
}
