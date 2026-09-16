// The Instagram Graph client at the HTTP level: the exact URLs and bodies Meta
// documents, error classification, and metric degradation.

import test from 'node:test';
import assert from 'node:assert/strict';
import './support.js';
import { createInstagramApi } from '../services/instagramApi.js';
import { ERROR_KIND } from '../services/metaErrors.js';

function stub(responses) {
  const calls = [];
  const queue = [...responses];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: new URL(url), options });
    const next = queue.shift() ?? { status: 200, body: {} };
    return { ok: next.status < 400, status: next.status, text: async () => JSON.stringify(next.body) };
  };
  return { calls, fetchImpl };
}

test('the authorize URL carries the app id, the exact redirect URI, the three scopes and the state', () => {
  const api = createInstagramApi();
  const url = new URL(api.buildAuthorizeUrl('STATE123'));
  assert.equal(url.origin + url.pathname, 'https://www.instagram.com/oauth/authorize');
  assert.equal(url.searchParams.get('client_id'), 'test-app-id');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://insta.test/api/insta/oauth/callback');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('scope'), 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_manage_insights');
  assert.equal(url.searchParams.get('state'), 'STATE123');
});

test('code exchange posts the form to the token endpoint and accepts both response shapes', async () => {
  const { calls, fetchImpl } = stub([
    { status: 200, body: { data: [{ access_token: 'short', user_id: 1784, permissions: 'instagram_business_basic' }] } },
    { status: 200, body: { access_token: 'short2', user_id: '1784', permissions: ['a', 'b'] } },
  ]);
  const api = createInstagramApi({ fetchImpl });

  const first = await api.exchangeCode('CODE');
  assert.deepEqual(first, { accessToken: 'short', userId: '1784', permissions: ['instagram_business_basic'] });
  assert.equal(calls[0].url.href, 'https://api.instagram.com/oauth/access_token');
  const form = new URLSearchParams(calls[0].options.body);
  assert.equal(form.get('client_secret'), 'test-app-secret');
  assert.equal(form.get('grant_type'), 'authorization_code');
  assert.equal(form.get('redirect_uri'), 'http://insta.test/api/insta/oauth/callback');
  assert.equal(form.get('code'), 'CODE');

  assert.deepEqual((await api.exchangeCode('CODE2')).permissions, ['a', 'b']);
});

test('long-lived exchange and refresh use the unversioned graph endpoints', async () => {
  const { calls, fetchImpl } = stub([
    { status: 200, body: { access_token: 'long', expires_in: 5183944 } },
    { status: 200, body: { access_token: 'long2', expires_in: 5183944 } },
  ]);
  const api = createInstagramApi({ fetchImpl });
  assert.deepEqual(await api.exchangeForLongLived('short'), { accessToken: 'long', expiresIn: 5183944 });
  assert.equal(calls[0].url.pathname, '/access_token');
  assert.equal(calls[0].url.searchParams.get('grant_type'), 'ig_exchange_token');
  await api.refreshLongLived('long');
  assert.equal(calls[1].url.pathname, '/refresh_access_token');
  assert.equal(calls[1].url.searchParams.get('grant_type'), 'ig_refresh_token');
});

test('messages go to /me/messages as JSON, private replies address the comment', async () => {
  const { calls, fetchImpl } = stub([{ status: 200, body: { message_id: 'm1' } }, { status: 200, body: { message_id: 'm2' } }]);
  const api = createInstagramApi({ fetchImpl });
  await api.sendMessage('tok', { recipientId: '12345', text: 'hello' });
  assert.equal(calls[0].url.pathname, '/v23.0/me/messages');
  assert.deepEqual(JSON.parse(calls[0].options.body), { recipient: { id: '12345' }, message: { text: 'hello' } });

  await api.sendMessage('tok', { commentId: '1799', text: 'hi' });
  assert.deepEqual(JSON.parse(calls[1].options.body).recipient, { comment_id: '1799' });
});

test('an id that could change the request path is refused before any call', async () => {
  const { calls, fetchImpl } = stub([]);
  const api = createInstagramApi({ fetchImpl });
  await assert.rejects(() => api.sendMessage('tok', { recipientId: '../me/subscribed_apps', text: 'x' }), /unexpected format/);
  await assert.rejects(() => api.getConversationMessages('tok', 'a/b'), /unexpected format/);
  assert.equal(calls.length, 0);
});

test('Graph errors are classified and never echo the token', async () => {
  const { fetchImpl } = stub([
    { status: 400, body: { error: { message: 'Error validating access token', code: 190 } } },
    { status: 400, body: { error: { message: 'Rate limit', code: 4 } } },
    { status: 400, body: { error_type: 'OAuthException', code: 400, error_message: 'Invalid redirect_uri' } },
  ]);
  const api = createInstagramApi({ fetchImpl });

  const auth = await api.getProfile('SECRET-TOKEN').catch((e) => e);
  assert.equal(auth.kind, ERROR_KIND.AUTH);
  assert.ok(!auth.message.includes('SECRET-TOKEN'));
  assert.equal((await api.getProfile('t').catch((e) => e)).kind, ERROR_KIND.RATE_LIMIT);
  const oauth = await api.exchangeCode('x').catch((e) => e);
  assert.equal(oauth.message, 'Invalid redirect_uri');
});

test('a network failure is a transient error with no URL in it', async () => {
  const api = createInstagramApi({
    fetchImpl: async () => {
      throw new Error('getaddrinfo ENOTFOUND graph.instagram.com?access_token=SECRET');
    },
  });
  const err = await api.getProfile('SECRET').catch((e) => e);
  assert.equal(err.kind, ERROR_KIND.TRANSIENT);
  assert.ok(!err.message.includes('SECRET'));
});

test('a retired metric is dropped and the rest are asked for again', async () => {
  const { calls, fetchImpl } = stub([
    { status: 400, body: { error: { message: '(#100) The Media Insights API does not support the metric shares', code: 100 } } },
    { status: 200, body: { data: [{ name: 'views', values: [{ value: 10 }] }, { name: 'reach', total_value: { value: 7 } }] } },
  ]);
  const api = createInstagramApi({ fetchImpl });
  const res = await api.getInsights('tok', '/m1/insights', ['views', 'reach', 'shares']);
  assert.deepEqual(res.values, { views: 10, reach: 7 });
  assert.deepEqual(res.missing, ['shares']);
  assert.equal(calls[1].url.searchParams.get('metric'), 'views,reach');
});
