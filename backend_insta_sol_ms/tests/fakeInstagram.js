// A fake Instagram that implements the same interface as
// services/instagramApi.js, holding conversations, media and comments in
// memory. Lets the flow tests drive "someone DMs the agency", "someone
// comments PRICE", "the token was revoked" without Meta.

import { MetaApiError, ERROR_KIND } from '../services/metaErrors.js';

export const BUSINESS_IG_ID = '17841400000000001';
export const BUSINESS_APP_SCOPED_ID = '9000000000000001';
export const BUSINESS_USERNAME = 'happy.properties.test';

export function createFakeInstagram({ now = () => Date.now() } = {}) {
  const state = {
    validTokens: new Set(),
    tokenCounter: 0,
    conversations: new Map(),
    media: [],
    comments: new Map(),
    sent: [],
    publicReplies: [],
    subscriptions: [],
    failSubscribe: null,
    windowBlocked: false,
    messageCounter: 0,
  };

  const business = { id: BUSINESS_IG_ID, username: BUSINESS_USERNAME };
  const iso = (ms) => new Date(ms).toISOString().replace('Z', '+0000');

  function requireToken(token) {
    if (!state.validTokens.has(token)) {
      throw new MetaApiError('Error validating access token: The session has been invalidated', { kind: ERROR_KIND.AUTH, code: 190 });
    }
  }

  function mintToken(prefix) {
    state.tokenCounter += 1;
    const token = `${prefix}-token-${state.tokenCounter}`;
    state.validTokens.add(token);
    return token;
  }

  function conversationFor(participant) {
    const id = `conv_${participant.id}`;
    if (!state.conversations.has(id)) {
      state.conversations.set(id, { id, participant, messages: [], updatedAt: now() });
    }
    return state.conversations.get(id);
  }

  const api = {
    buildAuthorizeUrl(stateParam) {
      return `https://www.instagram.test/oauth/authorize?client_id=test-app-id&state=${encodeURIComponent(stateParam)}`;
    },

    async exchangeCode(code) {
      if (code === 'bad-code') throw new MetaApiError('Invalid authorization code', { kind: ERROR_KIND.VALIDATION, code: 100 });
      return {
        accessToken: mintToken('short'),
        userId: BUSINESS_IG_ID,
        permissions: ['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments'],
      };
    },

    async exchangeForLongLived(shortToken) {
      requireToken(shortToken);
      return { accessToken: mintToken('long'), expiresIn: 60 * 24 * 60 * 60 };
    },

    async refreshLongLived(token) {
      requireToken(token);
      return { accessToken: mintToken('refreshed'), expiresIn: 60 * 24 * 60 * 60 };
    },

    async getProfile(token) {
      requireToken(token);
      return {
        id: BUSINESS_APP_SCOPED_ID,
        user_id: BUSINESS_IG_ID,
        username: BUSINESS_USERNAME,
        name: 'Happy Properties',
        account_type: 'BUSINESS',
        followers_count: 1520,
        follows_count: 80,
        media_count: state.media.length,
      };
    },

    async subscribeWebhooks(token, fields) {
      requireToken(token);
      if (state.failSubscribe && fields.some((f) => state.failSubscribe.includes(f))) {
        throw new MetaApiError('Advanced Access is required for this field', { kind: ERROR_KIND.PERMISSION, code: 10 });
      }
      state.subscriptions.push(fields);
      return { success: true };
    },

    async listConversations(token) {
      requireToken(token);
      const data = [...state.conversations.values()]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((c) => ({ id: c.id, updated_time: iso(c.updatedAt), participants: { data: [business, c.participant] } }));
      return { data, paging: {} };
    },

    async getConversationMessages(token, conversationId) {
      requireToken(token);
      const conv = state.conversations.get(conversationId);
      // Meta returns only the 20 most recent messages, newest first.
      return (conv?.messages ?? []).slice(-20).reverse();
    },

    async getMessagingUser(token, igsid) {
      requireToken(token);
      const known = [...state.conversations.values()].find((c) => c.participant.id === igsid);
      return { id: igsid, username: known?.participant.username ?? `user_${igsid}` };
    },

    async sendMessage(token, { recipientId, commentId, text }) {
      requireToken(token);
      if (state.windowBlocked && !commentId) {
        throw new MetaApiError('This message is sent outside of allowed window.', { kind: ERROR_KIND.WINDOW_BLOCKED, code: 10, subcode: 2534022 });
      }
      state.messageCounter += 1;
      const messageId = `m_sent_${state.messageCounter}`;
      state.sent.push({ recipientId, commentId, text, messageId });
      if (recipientId) {
        const conv = [...state.conversations.values()].find((c) => c.participant.id === recipientId);
        if (conv) {
          conv.messages.push({ id: messageId, from: business, message: text, created_time: iso(now()) });
          conv.updatedAt = now();
        }
      }
      return { recipient_id: recipientId ?? null, message_id: messageId };
    },

    async replyToComment(token, commentId, text) {
      requireToken(token);
      state.publicReplies.push({ commentId, text });
      return { id: `reply_${commentId}` };
    },

    async listMedia(token) {
      requireToken(token);
      return { data: state.media };
    },

    async listComments(token, mediaId) {
      requireToken(token);
      return { data: state.comments.get(mediaId) ?? [] };
    },

    async getMediaInsights(token) {
      requireToken(token);
      return { values: { views: 1200, reach: 900, likes: 40, comments: 6, saved: 3, shares: 2, total_interactions: 51 }, missing: [] };
    },

    async getAccountInsights(token) {
      requireToken(token);
      return { values: { reach: 5000, views: 9000, accounts_engaged: 300, total_interactions: 420, profile_links_taps: 12 }, missing: [] };
    },
  };

  return {
    api,
    state,
    /** Someone messages the business. Returns the Meta message id. */
    receiveMessage(participant, text, at = now()) {
      const conv = conversationFor(participant);
      state.messageCounter += 1;
      const id = `m_in_${state.messageCounter}`;
      conv.messages.push({ id, from: participant, message: text, created_time: iso(at) });
      conv.updatedAt = Math.max(conv.updatedAt, at);
      return id;
    },
    addMedia(media) {
      state.media.push(media);
    },
    addComment(mediaId, comment) {
      if (!state.comments.has(mediaId)) state.comments.set(mediaId, []);
      state.comments.get(mediaId).push(comment);
    },
    revokeAllTokens() {
      state.validTokens.clear();
    },
  };
}

export default createFakeInstagram;
