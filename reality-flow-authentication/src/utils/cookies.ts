import { Request, Response } from 'express';

const COOKIE_NAME = 'refresh_token';
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Set the refresh token as an httpOnly cookie.
 * Secure flag is set when not in development.
 */
export function setRefreshTokenCookie(res: Response, token: string): void {
  const isDev = process.env.NODE_ENV === 'development' || process.env.ENV === 'dev';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'Path=/',
    'SameSite=Lax',
  ];
  if (!isDev) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

/**
 * Clear the refresh token cookie.
 */
export function clearRefreshTokenCookie(res: Response): void {
  const isDev = process.env.NODE_ENV === 'development' || process.env.ENV === 'dev';
  const parts = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'Max-Age=0',
    'Path=/',
    'SameSite=Lax',
  ];
  if (!isDev) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

/**
 * Read the refresh token from the request cookie header.
 */
export function getRefreshTokenFromCookie(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(';').find((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
  if (!match) return undefined;
  return decodeURIComponent(match.split('=').slice(1).join('='));
}
