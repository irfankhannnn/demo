// The single door to Instagram. Nothing else in this service calls Meta.
//
// Only documented Instagram API with Instagram Login endpoints live here:
// OAuth, profile, conversations, messages, media, insights, comments, webhook
// subscription. There is deliberately no method for following, liking,
// hashtag search or follower lists - none of those have an official API, and
// their absence here is what stops one being added by accident.
//
// Access tokens travel as the `access_token` query parameter, so a URL built
// here must never be logged. Errors carry Meta's message, never the URL.

import { getConfig } from '../config/env.js';
import { classifyMetaError, MetaApiError, ERROR_KIND, extractBadMetrics } from './metaErrors.js';

export const PROFILE_FIELDS = [
  'user_id',
  'username',
  'name',
  'account_type',
  'profile_picture_url',
  'followers_count',
  'follows_count',
  'media_count',
];
export const MEDIA_FIELDS = [
  'id',
  'caption',
  'media_type',
  'media_product_type',
  'permalink',
  'thumbnail_url',
  'media_url',
  'timestamp',
  'comments_count',
  'like_count',
];
/** `impressions` and `plays` were removed by Meta in April 2025. */
export const MEDIA_METRICS = ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions'];
export const ACCOUNT_METRICS = ['reach', 'views', 'accounts_engaged', 'total_interactions', 'profile_links_taps'];
export const WEBHOOK_FIELDS = ['messages', 'comments'];

/** Node ids reach this module from webhooks, so they are validated before they become a path. */
function assertId(id, label = 'id') {
  if (typeof id !== 'string' && typeof id !== 'number') throw new Error(`${label} is required`);
  const value = String(id);
  if (!/^[A-Za-z0-9_.:=-]{1,200}$/.test(value)) throw new Error(`${label} has an unexpected format`);
  return value;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: 'Instagram returned a response that is not JSON' } };
  }
}

export function createInstagramApi({ fetchImpl } = {}) {
  const doFetch = (...args) => (fetchImpl || globalThis.fetch)(...args);
  const meta = () => getConfig().meta;

  async function call(url, { method = 'GET', json, form } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), meta().timeoutMs);
    let res;
    let payload;
    try {
      const headers = {};
      let body;
      if (json !== undefined) {
        headers['content-type'] = 'application/json';
        body = JSON.stringify(json);
      } else if (form !== undefined) {
        headers['content-type'] = 'application/x-www-form-urlencoded';
        body = new URLSearchParams(form).toString();
      }
      res = await doFetch(url, { method, headers, body, signal: controller.signal });
      const text = await res.text();
      payload = text ? safeJson(text) : {};
    } catch (err) {
      throw new MetaApiError(
        err?.name === 'AbortError' ? 'Instagram did not answer in time' : 'Could not reach Instagram',
        { kind: ERROR_KIND.TRANSIENT, code: 0, httpStatus: 0 }
      );
    } finally {
      clearTimeout(timer);
    }

    // Graph errors arrive as { error: {...} }; the OAuth token endpoint uses a
    // flat { error_type, code, error_message }.
    if (!res.ok || payload?.error || payload?.error_type) {
      const errorPayload = payload?.error && typeof payload.error === 'object' ? payload.error : payload || {};
      throw classifyMetaError(errorPayload, res.status);
    }
    return payload;
  }

  function graphUrl(path, params = {}, { versioned = true } = {}) {
    const m = meta();
    const url = new URL(`${m.graphBase}${versioned ? `/${m.graphVersion}` : ''}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  return {
    // ---------------------------------------------------------------- OAuth

    buildAuthorizeUrl(state) {
      const m = meta();
      const url = new URL(m.authorizeUrl);
      url.searchParams.set('client_id', m.appId);
      url.searchParams.set('redirect_uri', m.redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', m.scopes.join(','));
      url.searchParams.set('state', state);
      return url.toString();
    },

    /** Authorization code -> short-lived (1 hour) token. */
    async exchangeCode(code) {
      const m = meta();
      const payload = await call(m.tokenUrl, {
        method: 'POST',
        form: {
          client_id: m.appId,
          client_secret: m.appSecret,
          grant_type: 'authorization_code',
          redirect_uri: m.redirectUri,
          code,
        },
      });
      // Meta has returned both a flat object and a { data: [ ... ] } envelope.
      const row = Array.isArray(payload?.data) ? payload.data[0] : payload;
      if (!row?.access_token) throw new MetaApiError('Instagram did not return an access token', { kind: ERROR_KIND.AUTH });
      return {
        accessToken: row.access_token,
        userId: row.user_id !== undefined ? String(row.user_id) : null,
        permissions: typeof row.permissions === 'string' ? row.permissions.split(',') : row.permissions || [],
      };
    },

    /** Short-lived -> long-lived (60 day) token. */
    async exchangeForLongLived(shortToken) {
      const payload = await call(
        graphUrl('/access_token', { grant_type: 'ig_exchange_token', client_secret: meta().appSecret, access_token: shortToken }, { versioned: false })
      );
      return { accessToken: payload.access_token, expiresIn: Number(payload.expires_in) || null };
    },

    /** Needs a long-lived token that is at least 24 hours old and not yet expired. */
    async refreshLongLived(token) {
      const payload = await call(
        graphUrl('/refresh_access_token', { grant_type: 'ig_refresh_token', access_token: token }, { versioned: false })
      );
      return { accessToken: payload.access_token, expiresIn: Number(payload.expires_in) || null };
    },

    // -------------------------------------------------------------- Account

    getProfile(token) {
      return call(graphUrl('/me', { fields: PROFILE_FIELDS.join(','), access_token: token }));
    },

    subscribeWebhooks(token, fields = WEBHOOK_FIELDS) {
      return call(graphUrl('/me/subscribed_apps', { subscribed_fields: fields.join(','), access_token: token }), {
        method: 'POST',
      });
    },

    // ------------------------------------------------------------ Messaging

    listConversations(token, { limit = 25, after } = {}) {
      return call(
        graphUrl('/me/conversations', {
          platform: 'instagram',
          fields: 'id,updated_time,participants',
          limit,
          after,
          access_token: token,
        })
      );
    },

    /** Meta returns message details for only the 20 most recent messages of a conversation. */
    async getConversationMessages(token, conversationId) {
      const payload = await call(
        graphUrl(`/${assertId(conversationId, 'conversationId')}`, {
          fields: 'messages{id,from,to,message,created_time}',
          access_token: token,
        })
      );
      return payload?.messages?.data ?? [];
    },

    // Async so a malformed id surfaces as a rejection, like every other failure.

    /** User Profile API: the handle of someone who has messaged the account. */
    async getMessagingUser(token, igsid) {
      return call(graphUrl(`/${assertId(igsid, 'igsid')}`, { fields: 'name,username', access_token: token }));
    },

    /** A DM to a person (recipientId) or a private reply to a comment (commentId). */
    async sendMessage(token, { recipientId, commentId, text }) {
      const recipient = commentId
        ? { comment_id: assertId(commentId, 'commentId') }
        : { id: assertId(recipientId, 'recipientId') };
      return call(graphUrl('/me/messages', { access_token: token }), {
        method: 'POST',
        json: { recipient, message: { text } },
      });
    },

    async replyToComment(token, commentId, text) {
      return call(graphUrl(`/${assertId(commentId, 'commentId')}/replies`, { access_token: token }), {
        method: 'POST',
        form: { message: text },
      });
    },

    // ---------------------------------------------------------------- Media

    listMedia(token, { limit = 25 } = {}) {
      return call(graphUrl('/me/media', { fields: MEDIA_FIELDS.join(','), limit, access_token: token }));
    },

    async listComments(token, mediaId, { limit = 50 } = {}) {
      return call(
        graphUrl(`/${assertId(mediaId, 'mediaId')}/comments`, {
          fields: 'id,text,timestamp,username,from,parent_id',
          limit,
          access_token: token,
        })
      );
    },

    /**
     * Insights with graceful degradation: Meta removes metrics without notice
     * and reports it as a parameter error. The named metrics are dropped and
     * the rest asked for again, so one retired metric costs one number, not
     * the whole sync.
     *
     * @returns {Promise<{values: Record<string, number>, missing: string[]}>}
     */
    async getInsights(token, nodePath, metrics, extraParams = {}) {
      let remaining = [...metrics];
      const missing = [];
      while (remaining.length > 0) {
        try {
          const payload = await call(graphUrl(nodePath, { metric: remaining.join(','), ...extraParams, access_token: token }));
          const values = {};
          for (const row of payload?.data ?? []) {
            if (typeof row?.total_value?.value === 'number') values[row.name] = row.total_value.value;
            else if (Array.isArray(row?.values) && typeof row.values.at(-1)?.value === 'number') values[row.name] = row.values.at(-1).value;
          }
          for (const metric of remaining) if (!(metric in values)) missing.push(metric);
          return { values, missing };
        } catch (err) {
          const degradable = err.kind === ERROR_KIND.METRIC_UNAVAILABLE || err.kind === ERROR_KIND.VALIDATION;
          if (!degradable) throw err;
          const bad = extractBadMetrics(err.message, remaining);
          if (bad.length === 0) return { values: {}, missing: [...missing, ...remaining] };
          missing.push(...bad);
          remaining = remaining.filter((metric) => !bad.includes(metric));
        }
      }
      return { values: {}, missing };
    },

    getMediaInsights(token, mediaId) {
      return this.getInsights(token, `/${assertId(mediaId, 'mediaId')}/insights`, MEDIA_METRICS);
    },

    // No window returns the last day; since/until (unix seconds) return a total
    // over that range, which Meta caps at 30 days.
    getAccountInsights(token, { since, until } = {}) {
      return this.getInsights(token, '/me/insights', ACCOUNT_METRICS, { period: 'day', metric_type: 'total_value', since, until });
    },
  };
}

export default createInstagramApi;
