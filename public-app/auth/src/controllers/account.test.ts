import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { applyTestEnv, FakeCognito, FakeDynamo, startTestServer, TestServer, TEST_ENV, unsignedJwt } from '../testing/fakes';
import { __setAwsClientsForTests } from '../utils/aws';
import { __setTokenVerifierForTests, AuthContext } from '../middleware/authMiddleware';
import { __setFetchForTests } from '../utils/marketplaceApi';
import { __setTokenFetchForTests } from '../controllers/tokenController';
import { resetConfigForTests } from '../config/config';
import { createUser } from '../models/usersModel';

let server: TestServer;
let cognito: FakeCognito;
let dynamo: FakeDynamo;

/** Verifier stand-in: any "Bearer sub:<sub>" token is accepted; anything else rejected. */
const fakeVerifier = async (token: string): Promise<AuthContext> => {
  if (!token.startsWith('sub:')) throw new Error('bad token');
  return { sub: token.slice(4), tokenUse: 'access' };
};

before(async () => {
  applyTestEnv();
  resetConfigForTests();
  __setTokenVerifierForTests(fakeVerifier);
  const { createApp } = await import('../app');
  server = await startTestServer(createApp());
});

after(async () => {
  await server.close();
  __setAwsClientsForTests(null);
  __setTokenVerifierForTests(null);
  __setFetchForTests(null);
  __setTokenFetchForTests(null);
});

beforeEach(() => {
  cognito = new FakeCognito();
  dynamo = new FakeDynamo();
  __setAwsClientsForTests({ cognito, dynamo });
});

async function seedUser(overrides: Partial<{ sub: string; phone: string; email: string; name: string }> = {}) {
  const sub = overrides.sub ?? 'sub-1';
  cognito.seedUser(overrides.phone ?? '+919876543210', { phone_number: overrides.phone ?? '+919876543210' });
  return createUser({
    sub,
    cognitoUsername: overrides.phone ?? '+919876543210',
    provider: 'phone',
    phone: overrides.phone ?? '+919876543210',
    email: overrides.email,
    name: overrides.name,
  });
}

// --- /health -----------------------------------------------------------------

test('GET /health', async () => {
  const r = await server.request('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});

// --- /auth/me ----------------------------------------------------------------

test('GET /auth/me requires a bearer token', async () => {
  let r = await server.request('GET', '/auth/me');
  assert.equal(r.status, 401);
  assert.equal(r.body.error, 'unauthorized');

  r = await server.request('GET', '/auth/me', { headers: { authorization: 'Bearer garbage' } });
  assert.equal(r.status, 401);
});

test('GET /auth/me returns the contract user shape', async () => {
  await seedUser({ email: 'Buyer@Example.com', name: 'Asha' });
  const r = await server.request('GET', '/auth/me', { headers: { authorization: 'Bearer sub:sub-1' } });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body), ['user']);
  assert.deepEqual(Object.keys(r.body.user).sort(), ['createdAt', 'email', 'name', 'phone', 'userId']);
  assert.equal(r.body.user.userId, 'sub-1');
  assert.equal(r.body.user.email, 'buyer@example.com');
  assert.equal(r.body.user.name, 'Asha');
});

test('GET /auth/me is 404 for a valid token with no user row', async () => {
  const r = await server.request('GET', '/auth/me', { headers: { authorization: 'Bearer sub:nobody' } });
  assert.equal(r.status, 404);
  assert.equal(r.body.error, 'user_not_found');
});

// --- PATCH /auth/profile -----------------------------------------------------

test('PATCH /auth/profile validates the body', async () => {
  await seedUser();
  const auth = { authorization: 'Bearer sub:sub-1' };

  let r = await server.request('PATCH', '/auth/profile', { headers: auth, body: {} });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'validation_error');

  r = await server.request('PATCH', '/auth/profile', { headers: auth, body: { email: 'not-an-email' } });
  assert.equal(r.status, 400);
  assert.match(r.body.details, /valid address/);

  r = await server.request('PATCH', '/auth/profile', { headers: auth, body: { name: 'x'.repeat(81) } });
  assert.equal(r.status, 400);

  r = await server.request('PATCH', '/auth/profile', { headers: auth, body: { name: 'ok', phone: '+911111111111' } });
  assert.equal(r.status, 400, 'phone is not patchable');
});

test('PATCH /auth/profile updates the row and mirrors to Cognito best-effort', async () => {
  await seedUser();
  const r = await server.request('PATCH', '/auth/profile', {
    headers: { authorization: 'Bearer sub:sub-1' },
    body: { name: '  Asha Rao ', email: 'Asha@Example.com' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.name, 'Asha Rao');
  assert.equal(r.body.user.email, 'asha@example.com');
  assert.equal(r.body.user.phone, '+919876543210');

  const sync = cognito.calls.find((c) => c.name === 'AdminUpdateUserAttributesCommand');
  assert.ok(sync);
  assert.equal(sync!.input.Username, '+919876543210');
  assert.deepEqual(
    sync!.input.UserAttributes.map((a: { Name: string }) => a.Name).sort(),
    ['email', 'name']
  );

  // Cognito failure must not fail the request.
  cognito.users.clear();
  const r2 = await server.request('PATCH', '/auth/profile', {
    headers: { authorization: 'Bearer sub:sub-1' },
    body: { name: 'Second' },
  });
  assert.equal(r2.status, 200);
  assert.equal(r2.body.user.name, 'Second');
});

// --- DELETE /auth/me ---------------------------------------------------------

test('DELETE /auth/me purges marketplace-api, disables Cognito, soft-deletes the row and clears the cookie', async () => {
  await seedUser();
  const outbound: { url: string; init: RequestInit }[] = [];
  __setFetchForTests(async (url, init) => {
    outbound.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });

  const r = await server.request('DELETE', '/auth/me', { headers: { authorization: 'Bearer sub:sub-1' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.match(r.headers.get('set-cookie') ?? '', /^mp_refresh=;.*Max-Age=0/);

  assert.equal(outbound.length, 1);
  assert.equal(outbound[0].url, 'https://marketplace-api.example.test/devmarketplaceapi/internal/users/sub-1');
  assert.equal(outbound[0].init.method, 'DELETE');
  assert.equal((outbound[0].init.headers as Record<string, string>)['x-api-key'], 'auth-caller-key');

  const names = cognito.calls.map((c) => c.name);
  assert.ok(names.includes('AdminUserGlobalSignOutCommand'));
  assert.ok(names.includes('AdminDisableUserCommand'));
  assert.equal(cognito.users.get('+919876543210')!.enabled, false);

  const row = dynamo.items(TEST_ENV.USERS_TABLE)[0];
  assert.equal(row.status, 'DELETED');
  assert.ok(row.deletedAt);
  assert.equal(row.phone, '+919876543210', 'phone is kept so a re-signup can reactivate');

  // Token still verifies, but the account is gone.
  const me = await server.request('GET', '/auth/me', { headers: { authorization: 'Bearer sub:sub-1' } });
  assert.equal(me.status, 404);
});

test('DELETE /auth/me still succeeds when marketplace-api is down', async () => {
  await seedUser();
  __setFetchForTests(async () => {
    throw new Error('ECONNREFUSED');
  });
  const r = await server.request('DELETE', '/auth/me', { headers: { authorization: 'Bearer sub:sub-1' } });
  assert.equal(r.status, 200);
  assert.equal(cognito.users.get('+919876543210')!.enabled, false);
});

// --- /internal/users/:userId -------------------------------------------------

test('GET /internal/users/:userId requires the internal key (constant-time)', async () => {
  await seedUser();
  let r = await server.request('GET', '/internal/users/sub-1');
  assert.equal(r.status, 401);
  r = await server.request('GET', '/internal/users/sub-1', { headers: { 'x-internal-api-key': 'wrong' } });
  assert.equal(r.status, 401);
  r = await server.request('GET', '/internal/users/sub-1', { headers: { 'x-internal-api-key': 'internal-secret-key' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.userId, 'sub-1');
  assert.deepEqual(Object.keys(r.body.user).sort(), ['createdAt', 'email', 'name', 'phone', 'userId']);
  r = await server.request('GET', '/internal/users/missing', { headers: { 'x-internal-api-key': 'internal-secret-key' } });
  assert.equal(r.status, 404);
});

// --- /auth/google/url --------------------------------------------------------

test('GET /auth/google/url requires an absolute http(s) redirectUri', async () => {
  let r = await server.request('GET', '/auth/google/url');
  assert.equal(r.status, 400);
  r = await server.request('GET', '/auth/google/url?redirectUri=/relative');
  assert.equal(r.status, 400);
  r = await server.request('GET', '/auth/google/url?redirectUri=javascript:alert(1)');
  assert.equal(r.status, 400);
});

test('GET /auth/google/url builds a PKCE authorize URL', async () => {
  const r = await server.request('GET', '/auth/google/url?redirectUri=' + encodeURIComponent('http://localhost:5173/auth/callback') + '&state=abc');
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body).sort(), ['codeVerifier', 'state', 'url']);
  assert.equal(r.body.state, 'abc');
  const url = new URL(r.body.url);
  assert.equal(url.origin, TEST_ENV.COGNITO_HOSTED_UI_DOMAIN);
  assert.equal(url.pathname, '/oauth2/authorize');
  assert.equal(url.searchParams.get('identity_provider'), 'Google');
  assert.equal(url.searchParams.get('client_id'), TEST_ENV.COGNITO_CLIENT_ID);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:5173/auth/callback');
  assert.ok(url.searchParams.get('code_challenge'));
  assert.equal(r.body.codeVerifier.length, 43);

  const r2 = await server.request('GET', '/auth/google/url?redirectUri=' + encodeURIComponent('https://app.example/cb'));
  assert.ok(r2.body.state.length >= 16, 'state is generated when not supplied');
});

// --- /auth/token -------------------------------------------------------------

test('POST /auth/token validates its body', async () => {
  let r = await server.request('POST', '/auth/token', { body: { code: 'c' } });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'validation_error');
  r = await server.request('POST', '/auth/token', { body: { code: 'c', codeVerifier: 'v', redirectUri: 'nope' } });
  assert.equal(r.status, 400);
});

test('POST /auth/token exchanges the code, creates a google user and sets the cookie', async () => {
  const idToken = unsignedJwt({
    sub: 'google-sub-1',
    'cognito:username': 'google_1234',
    email: 'Buyer@Gmail.com',
    name: 'Buyer One',
    token_use: 'id',
  });
  const seen: { url: string; body: string }[] = [];
  __setTokenFetchForTests(async (url, init) => {
    seen.push({ url: String(url), body: String(init?.body) });
    return new Response(
      JSON.stringify({ id_token: idToken, access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'Bearer' }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  });

  const r = await server.request('POST', '/auth/token', {
    body: { code: 'the-code', codeVerifier: 'the-verifier', redirectUri: 'http://localhost:5173/auth/callback' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(seen[0].url, `${TEST_ENV.COGNITO_HOSTED_UI_DOMAIN}/oauth2/token`);
  const sent = new URLSearchParams(seen[0].body);
  assert.equal(sent.get('grant_type'), 'authorization_code');
  assert.equal(sent.get('code_verifier'), 'the-verifier');
  assert.equal(sent.get('redirect_uri'), 'http://localhost:5173/auth/callback');

  assert.equal(r.body.accessToken, 'at');
  assert.equal(r.body.user.isNew, true);
  assert.equal(r.body.user.userId, 'google-sub-1');
  assert.equal(r.body.user.email, 'buyer@gmail.com');
  assert.equal(r.body.user.name, 'Buyer One');
  assert.equal(r.body.user.phone, null);
  assert.match(r.headers.get('set-cookie') ?? '', /^mp_refresh=rt;/);

  const row = dynamo.items(TEST_ENV.USERS_TABLE)[0];
  assert.equal(row.provider, 'google');
  assert.equal(row.cognitoUsername, 'google_1234');
});

test('POST /auth/token maps invalid_grant to 400', async () => {
  __setTokenFetchForTests(
    async () =>
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400, headers: { 'content-type': 'application/json' } })
  );
  const r = await server.request('POST', '/auth/token', {
    body: { code: 'stale', codeVerifier: 'v', redirectUri: 'http://localhost:5173/cb' },
  });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'invalid_grant');
});

// --- /auth/refresh, /auth/logout ---------------------------------------------

test('POST /auth/refresh needs the cookie and rejects unknown tokens', async () => {
  let r = await server.request('POST', '/auth/refresh');
  assert.equal(r.status, 401);
  assert.equal(r.body.error, 'no_refresh_token');

  r = await server.request('POST', '/auth/refresh', { headers: { cookie: 'mp_refresh=bogus' } });
  assert.equal(r.status, 401);
  assert.equal(r.body.error, 'invalid_refresh_token');
  assert.match(r.headers.get('set-cookie') ?? '', /Max-Age=0/);
});

test('POST /auth/refresh returns fresh tokens for a valid cookie; logout revokes it', async () => {
  const user = cognito.seedUser('+919876543210', { phone_number: '+919876543210' });
  const refresh = `refresh-${user.sub}-seed`;
  cognito.refreshTokens.add(refresh);

  const r = await server.request('POST', '/auth/refresh', { headers: { cookie: `mp_refresh=${refresh}` } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(Object.keys(r.body).sort(), ['accessToken', 'expiresIn', 'idToken']);
  assert.equal(cognito.calls.at(-1)!.input.AuthFlow, 'REFRESH_TOKEN_AUTH');

  const out = await server.request('POST', '/auth/logout', { headers: { cookie: `mp_refresh=${refresh}` } });
  assert.equal(out.status, 200);
  assert.deepEqual(out.body, { ok: true });
  assert.match(out.headers.get('set-cookie') ?? '', /^mp_refresh=;.*Max-Age=0/);
  assert.equal(cognito.refreshTokens.has(refresh), false);

  const again = await server.request('POST', '/auth/refresh', { headers: { cookie: `mp_refresh=${refresh}` } });
  assert.equal(again.status, 401);
});

test('POST /auth/logout without a cookie is still ok', async () => {
  const r = await server.request('POST', '/auth/logout');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
});

// --- misc --------------------------------------------------------------------

test('unknown routes are 404 with the contract error envelope', async () => {
  const r = await server.request('GET', '/nope');
  assert.equal(r.status, 404);
  assert.equal(r.body.error, 'not_found');
});
