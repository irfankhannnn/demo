import { Request, Response } from 'express';

const COOKIE_NAME = 'refresh_token';
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Set the refresh token as an httpOnly cookie.
 *
 * Cookie strategy:
 * - SameSite=None is required because the frontend (localhost:3000 or prod domain)
 *   is cross-site relative to the API Gateway domain (*.amazonaws.com).
 * - SameSite=None REQUIRES the Secure flag per Chrome/browser spec.
 * - The Secure flag is safe to set even in dev because the API is served over HTTPS
 *   (API Gateway is always HTTPS). The flag only means the cookie is sent back over
 *   HTTPS, which our API already is.
 */
export function setRefreshTokenCookie(res: Response, token: string): void {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'Path=/',
    'SameSite=None',
    'Secure',  // Required with SameSite=None; safe since API Gateway is always HTTPS
  ];

  res.setHeader('Set-Cookie', parts.join('; '));
}

/**
 * Clear the refresh token cookie.
 */
export function clearRefreshTokenCookie(res: Response): void {
  const parts = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'Max-Age=0',
    'Path=/',
    'SameSite=None',
    'Secure',
  ];
  res.setHeader('Set-Cookie', parts.join('; '));
}

/**
 * Read the refresh token from the request cookies.
 * Works with both cookie-parser middleware (req.cookies) and raw headers.
 */
export function getRefreshTokenFromCookie(req: Request): string | undefined {
  // First try cookie-parser (preferred)
  if ((req as any).cookies && (req as any).cookies[COOKIE_NAME]) {
    return (req as any).cookies[COOKIE_NAME];
  }
  
  // Fallback to manual parsing from headers
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(';').find((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
  if (!match) return undefined;
  return decodeURIComponent(match.split('=').slice(1).join('='));
}
