/**
 * The single door to Meta. Nothing else in the agent calls `fetch` against
 * Instagram.
 *
 * Every request passes, in order:
 *   1. the endpoint allowlist  - official Graph surface only (ARCHITECTURE s.6)
 *   2. the kill switch         - writes refuse when it is on (F61)
 *   3. the rate governor       - token bucket, over-cap throws (s.7, F60)
 *   4. the token provider      - provider.getToken(accountId), never the vault
 *   5. audit_log               - one row per call, success or failure (F62)
 *
 * On a rate error (4 / 613 / 80007 / 2018001) the bucket is halted until its
 * next window and the call is NOT retried.
 *
 * There is deliberately no method here for following, liking, hashtag search or
 * follower lists. Those have no official API, and the allowlist below is what
 * stops one being added by accident.
 */
import { loadConfig } from '../util/config.js';
import { audit } from '../store/repos.js';
import { logger } from '../util/logger.js';
import { sleep } from '../util/time.js';
import { getGovernor } from './governor.js';
import { classify, ERROR_KIND, backoffMs, MetaError } from './errors.js';
import { assertNotEngaged, isDryRun } from './killSwitch.js';

const log = logger('runtime/graph');

/**
 * The official endpoint surface, exactly ARCHITECTURE section 6. A path that
 * does not match one of these is refused before any network call.
 *
 * If you are adding a pattern here, check it against "What we deliberately will
 * not build" in FEATURES.md first.
 */
export const ALLOWED_PATHS = [
  { re: /^\/me$/,                              methods: ['GET'],  bucket: 'graph_read',    what: 'profile' },
  { re: /^\/me\/insights$/,                    methods: ['GET'],  bucket: 'graph_read',    what: 'account insights' },
  { re: /^\/me\/media$/,                       methods: ['GET'],  bucket: 'graph_read',    what: 'media list' },
  { re: /^\/me\/conversations$/,               methods: ['GET'],  bucket: 'graph_read',    what: 'conversations' },
  { re: /^\/[\w.]+\/insights$/,                methods: ['GET'],  bucket: 'graph_read',    what: 'media insights' },
  { re: /^\/[\w.]+\/comments$/,                methods: ['GET'],  bucket: 'graph_read',    what: 'comments' },
  { re: /^\/[\w.]+\/messages$/,                methods: ['GET'],  bucket: 'graph_read',    what: 'conversation messages' },
  { re: /^\/[\w.]+$/,                          methods: ['GET'],  bucket: 'graph_read',    what: 'node read' },
  { re: /^\/[\w.]+\/replies$/,                 methods: ['POST'], bucket: 'comment_reply', what: 'public comment reply' },
  { re: /^\/me\/messages$/,                    methods: ['POST'], bucket: 'dm_send',       what: 'send DM' },
  { re: /^\/[\w.]+\/messages$/,                methods: ['POST'], bucket: 'dm_send',       what: 'send DM / private reply' },
  { re: /^\/me\/media$/,                       methods: ['POST'], bucket: 'publish',       what: 'create media container' },
  { re: /^\/me\/media_publish$/,               methods: ['POST'], bucket: 'publish',       what: 'publish media' },
];

export class EndpointNotAllowedError extends Error {
  constructor(method, path) {
    super(
      `Refusing ${method} ${path}: not on the official Graph allowlist. ` +
      'This agent only calls documented Instagram Graph endpoints (ARCHITECTURE section 6). ' +
      'Private or unofficial endpoints, browser automation and scraping are out of scope by design.',
    );
    this.name = 'EndpointNotAllowedError';
    this.method = method;
    this.path = path;
  }
}

export function resolveEndpoint(method, path) {
  const m = method.toUpperCase();
  const hit = ALLOWED_PATHS.find((p) => p.re.test(path) && p.methods.includes(m));
  if (!hit) throw new EndpointNotAllowedError(m, path);
  return hit;
}

export class GraphClient {
  /**
   * @param {object} opts
   * @param {object} opts.provider - a TokenProvider; the ONLY token source
   * @param {object} [opts.config]
   * @param {object} [opts.governor]
   * @param {function} [opts.fetchImpl] - injected in tests; never hits the network there
   */
  constructor({ provider, config = loadConfig(), governor = null, fetchImpl = null } = {}) {
    if (!provider) throw new Error('GraphClient needs a TokenProvider (see src/auth/tokenProvider.js)');
    this.provider = provider;
    this.config = config;
    this.governor = governor ?? getGovernor(config);
    this.fetch = fetchImpl ?? globalThis.fetch;
    this.base = config.graphBase;
  }

  /**
   * @param {'GET'|'POST'} method
   * @param {string} path - e.g. '/me/media'
   * @param {object} opts
   * @param {string} opts.accountId
   * @param {object} [opts.params] - query string
   * @param {object} [opts.body]   - JSON body for POST
   * @param {number} [opts.retries] - only TRANSIENT failures are retried
   */
  async request(method, path, { accountId, params = {}, body = null, retries = 2 } = {}) {
    const endpoint = resolveEndpoint(method, path);
    const isWrite = method.toUpperCase() === 'POST';
    if (isWrite) assertNotEngaged(`${method} ${path}`);

    this.governor.spend(endpoint.bucket);

    if (isWrite && isDryRun()) {
      audit({ scope: 'graph', action: `${method} ${path}`, igUserId: accountId, outcome: 'dry_run',
        subjectType: 'endpoint', subjectId: endpoint.what, detail: { body, params } });
      log.info('dry run - not sending', { method, path, what: endpoint.what });
      return { dryRun: true, id: `dryrun_${Date.now()}` };
    }

    const token = await this.provider.getToken(accountId);
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    url.searchParams.set('access_token', token);

    let attempt = 0;
    for (;;) {
      let res;
      let payload;
      try {
        res = await this.fetch(url.toString(), {
          method,
          headers: body ? { 'content-type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        payload = await res.json().catch(() => ({}));
      } catch (netErr) {
        // Network-level failure: transient by definition.
        if (attempt < retries) {
          await sleep(backoffMs(attempt));
          attempt += 1;
          continue;
        }
        audit({ scope: 'graph', action: `${method} ${path}`, igUserId: accountId, outcome: 'error',
          errorCode: 'NETWORK', detail: { error: netErr.message } });
        throw new MetaError(`Network failure calling ${path}: ${netErr.message}`,
          { kind: ERROR_KIND.TRANSIENT, retryable: true });
      }

      if (res.ok && !payload.error) {
        audit({ scope: 'graph', action: `${method} ${path}`, igUserId: accountId, outcome: 'ok',
          httpStatus: res.status, subjectType: 'endpoint', subjectId: endpoint.what });
        return payload;
      }

      const err = classify(payload.error ?? {}, res.status);
      err.path = path;
      err.method = method;
      err.bucket = endpoint.bucket;

      audit({ scope: 'graph', action: `${method} ${path}`, igUserId: accountId, outcome: 'error',
        httpStatus: res.status, errorCode: `${err.kind}:${err.code}`,
        detail: { message: err.message, subcode: err.subcode } });

      if (err.haltsBucket) {
        // Hard stop for this bucket until the next window. No retry, ever.
        this.governor.halt(endpoint.bucket, `meta code ${err.code}`);
        throw err;
      }
      if (err.kind === ERROR_KIND.TRANSIENT && attempt < retries) {
        await sleep(backoffMs(attempt));
        attempt += 1;
        continue;
      }
      throw err;
    }
  }

  get(path, opts) {
    return this.request('GET', path, opts);
  }

  post(path, opts) {
    return this.request('POST', path, opts);
  }

  /**
   * Follow Graph paging up to `maxPages`, spending a token per page.
   * Returns the flattened `data` array plus the last cursor seen.
   */
  async paginate(path, { accountId, params = {}, maxPages = 10, after = null, pageDelayMs = null } = {}) {
    const out = [];
    let cursor = after;
    let pages = 0;
    let nextCursor = after;

    while (pages < maxPages) {
      const page = await this.get(path, { accountId, params: { ...params, ...(cursor ? { after: cursor } : {}) } });
      const data = Array.isArray(page.data) ? page.data : [];
      out.push(...data);
      pages += 1;
      const next = page.paging?.cursors?.after;
      const hasNext = Boolean(page.paging?.next && next);
      if (next) nextCursor = next;
      if (!hasNext || data.length === 0) break;
      cursor = next;
      await sleep(pageDelayMs ?? this.governor.pacing('graph_read'));
    }
    return { items: out, cursor: nextCursor, pages };
  }
}
