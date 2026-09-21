import { Request, Response } from 'express';

/**
 * Refresh-token cookie. marketplace-web keeps the access token in memory
 * and calls POST /auth/refresh with `credentials: 'include'`, so the
 * refresh token itself never touches JavaScript.
 *
 * SameSite=None + Secure: the SPA origin and this API's domain are
 * cross-site, and browsers require Secure alongside SameSite=None. API
 * Gateway is always HTTPS, so Secure is safe in every environment.
 */
export const REFRESH_COOKIE_NAME = 'mp_refresh';
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // matches RefreshTokenValidity (30 days)

export function setRefreshTokenCookie(res: Response, token: string): void {
  const parts = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'Path=/',
    'SameSite=None',
    'Secure',
  ];
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearRefreshTokenCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    [`${REFRESH_COOKIE_NAME}=`, 'HttpOnly', 'Max-Age=0', 'Path=/', 'SameSite=None', 'Secure'].join('; ')
  );
}

export function getRefreshTokenFromCookie(req: Request): string | undefined {
  const parsed = (req as unknown as { cookies?: Record<string, string> }).cookies;
  if (parsed && parsed[REFRESH_COOKIE_NAME]) return parsed[REFRESH_COOKIE_NAME];

  const header = req.headers.cookie;
  if (!header) return undefined;
  const match = header.split(';').find((c) => c.trim().startsWith(`${REFRESH_COOKIE_NAME}=`));
  if (!match) return undefined;
  return decodeURIComponent(match.split('=').slice(1).join('='));
}
