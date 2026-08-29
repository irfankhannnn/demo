/**
 * A1 - Token Keeper. The seam between "where a token comes from" and everything
 * that uses one.
 *
 * PLAN D1 fixes this shape:
 *
 *   TokenProvider
 *    |- DevModeProvider    (Phase 1) token from our own Meta app, account added as tester
 *    |- SharedAppProvider  (later)   token from RealtyFlow's App-Reviewed Meta app
 *    |- HostedProvider     (later)   token fetched from a RealtyFlow microservice
 *
 * Downstream code - collectors, engine, uplink - calls exactly one method:
 *
 *     const token = await provider.getToken(accountId);
 *
 * It must never read the `tokens` table, the vault, or config to find a token.
 * That single rule is what makes moving to a shared app a config swap instead of
 * a rewrite, so treat any new call site that reaches around this interface as a
 * bug.
 */
import { readToken, putToken, tokenHealth } from './vault.js';
import { getAccount, listAccounts, setAccountStatus, audit } from '../store/repos.js';
import { now, DAY_MS } from '../util/time.js';
import { logger } from '../util/logger.js';

const log = logger('auth/tokenProvider');

export class TokenProviderError extends Error {
  constructor(message, code = 'TOKEN_ERROR') {
    super(message);
    this.name = 'TokenProviderError';
    this.code = code;
  }
}

/**
 * The interface. Subclasses override `getToken`; the rest is shared behaviour
 * that all three implementations are expected to keep.
 */
export class TokenProvider {
  /** @param {object} config - the loaded agent config */
  constructor(config = {}) {
    this.config = config;
    this.kind = 'abstract';
  }

  /**
   * @param {string} accountId - the Instagram user id
   * @returns {Promise<string>} a usable access token
   */
  // eslint-disable-next-line no-unused-vars
  async getToken(accountId) {
    throw new TokenProviderError('TokenProvider.getToken must be implemented by a subclass', 'NOT_IMPLEMENTED');
  }

  /** Accounts this provider can serve. */
  async listAccounts() {
    return listAccounts();
  }

  /** Health for the console token panel (F64). */
  async health(accountId) {
    return tokenHealth(accountId);
  }

  /**
   * Refresh if the token is inside its refresh window. Default is a no-op so a
   * provider whose tokens are managed elsewhere (hosted) inherits sane
   * behaviour; DevModeProvider overrides it.
   */
  // eslint-disable-next-line no-unused-vars
  async refreshIfDue(accountId) {
    return { refreshed: false, reason: 'provider does not manage refresh' };
  }
}

/**
 * Phase 1. The token was obtained by `ig-agent connect` through Instagram
 * Business Login against our own Meta app in Development Mode, and is stored
 * encrypted on this laptop.
 *
 * Dev Mode does not restrict which endpoints work - only whose accounts we may
 * touch. Each account must be added as an Instagram tester on the app.
 */
export class DevModeProvider extends TokenProvider {
  constructor(config = {}, deps = {}) {
    super(config);
    this.kind = 'dev';
    // Injected so tests can exercise refresh without touching the network.
    this.refreshFn = deps.refreshFn ?? null;
  }

  async getToken(accountId) {
    const account = getAccount(accountId);
    if (!account) {
      throw new TokenProviderError(`Account ${accountId} is not connected. Run: ig-agent connect`, 'NO_ACCOUNT');
    }
    if (account.status === 'revoked') {
      throw new TokenProviderError(`Account ${accountId} was revoked. Run: ig-agent connect`, 'REVOKED');
    }
    const stored = readToken(accountId);
    if (!stored) {
      throw new TokenProviderError(`No token stored for ${accountId}. Run: ig-agent connect`, 'NO_TOKEN');
    }
    if (stored.expiresAt && stored.expiresAt <= now()) {
      setAccountStatus(accountId, 'reconnect_required', 'access token expired');
      throw new TokenProviderError(
        `Token for ${accountId} expired. Instagram long-lived tokens cannot be refreshed once ` +
        'expired - run: ig-agent connect', 'EXPIRED',
      );
    }
    return stored.accessToken;
  }

  /**
   * Refresh at day 50 of 60. Meta's `ig_refresh_token` grant needs a token that
   * is at least 24h old and not yet expired.
   */
  async refreshIfDue(accountId, at = now()) {
    const stored = readToken(accountId);
    if (!stored) return { refreshed: false, reason: 'no token' };
    if (!stored.refreshAfter || at < stored.refreshAfter) {
      return { refreshed: false, reason: 'not due', dueAt: stored.refreshAfter };
    }
    if (at - stored.issuedAt < DAY_MS) return { refreshed: false, reason: 'token younger than 24h' };
    if (!this.refreshFn) {
      const { refreshLongLivedToken } = await import('./oauth.js');
      this.refreshFn = refreshLongLivedToken;
    }
    try {
      const res = await this.refreshFn(stored.accessToken, this.config);
      putToken(accountId, res.access_token, {
        expiresInSec: res.expires_in,
        scopes: stored.scopes,
      });
      audit({ scope: 'auth', action: 'token.refresh', igUserId: accountId, outcome: 'ok' });
      log.info('token refreshed', { accountId, expiresInSec: res.expires_in });
      return { refreshed: true, expiresInSec: res.expires_in };
    } catch (err) {
      audit({ scope: 'auth', action: 'token.refresh', igUserId: accountId, outcome: 'error', detail: { error: err.message } });
      setAccountStatus(accountId, 'reconnect_required', `token refresh failed: ${err.message}`);
      throw new TokenProviderError(`Token refresh failed for ${accountId}: ${err.message}`, 'REFRESH_FAILED');
    }
  }
}

/**
 * Later phase. Same laptop flow, but the Meta app is RealtyFlow's App-Reviewed
 * production app, so any agency can connect without being added as a tester.
 *
 * Not implemented yet - see PLAN section 9, decision D1.
 */
export class SharedAppProvider extends TokenProvider {
  constructor(config = {}) {
    super(config);
    this.kind = 'shared';
  }

  async getToken() {
    throw new TokenProviderError(
      'SharedAppProvider is not implemented. It needs RealtyFlow\'s Meta app to clear App Review ' +
      '(PLAN section 9, D1). Set config.tokenProvider = "dev" until then.',
      'NOT_IMPLEMENTED',
    );
  }
}

/**
 * Later phase. The laptop holds no Instagram credential at all; it asks the
 * RealtyFlow backend for a short-lived token, authenticated with its HMAC device
 * key. Makes the cloud a hard dependency, which is why it is not the default.
 *
 * Not implemented yet - see PLAN section 9, decision D1.
 */
export class HostedProvider extends TokenProvider {
  constructor(config = {}) {
    super(config);
    this.kind = 'hosted';
  }

  async getToken() {
    throw new TokenProviderError(
      'HostedProvider is not implemented. It needs the backend token-broker endpoint ' +
      '(PLAN section 9, D1). Set config.tokenProvider = "dev" until then.',
      'NOT_IMPLEMENTED',
    );
  }
}

const REGISTRY = {
  dev: DevModeProvider,
  shared: SharedAppProvider,
  hosted: HostedProvider,
};

/** Build the provider named by `config.tokenProvider`. */
export function createTokenProvider(config = {}, deps = {}) {
  const name = config.tokenProvider ?? 'dev';
  const Impl = REGISTRY[name];
  if (!Impl) {
    throw new TokenProviderError(
      `Unknown tokenProvider "${name}". Valid values: ${Object.keys(REGISTRY).join(', ')}`,
      'UNKNOWN_PROVIDER',
    );
  }
  return new Impl(config, deps);
}

export const PROVIDER_NAMES = Object.keys(REGISTRY);
