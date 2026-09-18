import { getConfig } from '../config/config';
import { logger } from './logger';

/**
 * Outbound calls to marketplace-api's /internal/* routes, authenticated
 * with AUTH_CALLER_API_KEY (contract §2 — the key marketplace-api accepts
 * from this service). Everything here is best-effort: the caller logs and
 * continues, because a hiccup in marketplace-api must never block the
 * account operation that triggered it.
 */
export function marketplaceApiBaseUrl(): string | null {
  const { MARKETPLACE_API_DOMAIN_NAME, MARKETPLACE_API_BASE_PATH } = getConfig();
  const host = MARKETPLACE_API_DOMAIN_NAME.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!host) return null;
  const base = MARKETPLACE_API_BASE_PATH.trim().replace(/^\/+|\/+$/g, '');
  return base ? `https://${host}/${base}` : `https://${host}`;
}

export type Fetcher = typeof fetch;
let fetcher: Fetcher = (...args) => fetch(...args);

/** Test-only: swap the HTTP implementation. Pass null to restore global fetch. */
export function __setFetchForTests(f: Fetcher | null): void {
  fetcher = f ?? ((...args) => fetch(...args));
}

/**
 * DELETE /internal/users/:userId on marketplace-api. Returns true when the
 * API acknowledged (2xx), false otherwise (already logged).
 */
export async function deleteMarketplaceUser(userId: string): Promise<boolean> {
  const base = marketplaceApiBaseUrl();
  const { AUTH_CALLER_API_KEY } = getConfig();

  if (!base || !AUTH_CALLER_API_KEY) {
    logger.warn('marketplaceApi.delete_user.skipped', {
      userId,
      reason: !base ? 'MARKETPLACE_API_DOMAIN_NAME not configured' : 'AUTH_CALLER_API_KEY not configured',
    });
    return false;
  }

  const url = `${base}/internal/users/${encodeURIComponent(userId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetcher(url, {
      method: 'DELETE',
      headers: { 'x-api-key': AUTH_CALLER_API_KEY, accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error('marketplaceApi.delete_user.failed', { userId, status: res.status, body: body.slice(0, 500) });
      return false;
    }
    logger.info('marketplaceApi.delete_user.ok', { userId });
    return true;
  } catch (error) {
    logger.error('marketplaceApi.delete_user.error', { userId, error });
    return false;
  } finally {
    clearTimeout(timer);
  }
}
