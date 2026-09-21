import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { applyTestEnv, FakeCognito, FakeDynamo, startTestServer, TestServer, TEST_ENV } from '../testing/fakes';
import { __setAwsClientsForTests } from '../utils/aws';
import { resetConfigForTests } from '../config/config';

let server: TestServer;
let cognito: FakeCognito;
let dynamo: FakeDynamo;

before(async () => {
  applyTestEnv();
  resetConfigForTests();
  const { createApp } = await import('../app');
  server = await startTestServer(createApp());
});

after(async () => {
  await server.close();
  __setAwsClientsForTests(null);
});

beforeEach(() => {
  cognito = new FakeCognito();
  dynamo = new FakeDynamo();
  __setAwsClientsForTests({ cognito, dynamo });
});

test('POST /auth/phone/start rejects a missing phone', async () => {
  const r = await server.request('POST', '/auth/phone/start', { body: {} });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'validation_error');
  assert.match(r.body.details, /phone is required/);
});

test('POST /auth/phone/start rejects an invalid phone', async () => {
  const r = await server.request('POST', '/auth/phone/start', { body: { phone: '12345' } });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'invalid_phone');
  assert.equal(cognito.calls.length, 0);
});

test('POST /auth/phone/start rejects a non-JSON body with 400', async () => {
  const res = await fetch(`${server.url}/auth/phone/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json',
  });
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'bad_request');
});

test('POST /auth/phone/start normalises a 10-digit number, creates the Cognito user and returns a session', async () => {
  const r = await server.request('POST', '/auth/phone/start', { body: { phone: '98765 43210' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.phone, '+919876543210');
  assert.match(r.body.session, /^session-/);
  assert.equal(r.body.expiresInSeconds, 300);

  const names = cognito.calls.map((c) => c.name);
  assert.deepEqual(names, ['AdminGetUserCommand', 'AdminCreateUserCommand', 'AdminInitiateAuthCommand']);
  const create = cognito.calls[1].input;
  assert.equal(create.Username, '+919876543210', 'username is the E.164 phone itself');
  assert.equal(create.MessageAction, 'SUPPRESS');
  assert.equal(cognito.calls[2].input.AuthFlow, 'CUSTOM_AUTH');
  assert.equal(cognito.calls[2].input.AuthParameters.USERNAME, '+919876543210');
});

test('POST /auth/phone/start does not recreate an existing Cognito user', async () => {
  cognito.seedUser('+919876543210', { phone_number: '+919876543210' });
  const r = await server.request('POST', '/auth/phone/start', { body: { phone: '+919876543210' } });
  assert.equal(r.status, 200);
  assert.deepEqual(
    cognito.calls.map((c) => c.name),
    ['AdminGetUserCommand', 'AdminInitiateAuthCommand']
  );
});

test('POST /auth/phone/start refuses a disabled account that was not self-deleted', async () => {
  cognito.seedUser('+919876543210', { phone_number: '+919876543210' }, false);
  const r = await server.request('POST', '/auth/phone/start', { body: { phone: '+919876543210' } });
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'account_disabled');
});

test('POST /auth/phone/confirm validates its body', async () => {
  let r = await server.request('POST', '/auth/phone/confirm', { body: { phone: '9876543210', otp: '12', session: 's' } });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'validation_error');
  assert.match(r.body.details, /6 digits/);

  r = await server.request('POST', '/auth/phone/confirm', { body: { phone: '9876543210', otp: '123456' } });
  assert.equal(r.status, 400);
  assert.match(r.body.details, /session is required/);

  r = await server.request('POST', '/auth/phone/confirm', { body: { phone: 'nope', otp: '123456', session: 's' } });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'invalid_phone');
});

test('phone start → confirm creates the user (isNew) and sets the mp_refresh cookie; second login is not new', async () => {
  const start = await server.request('POST', '/auth/phone/start', { body: { phone: '09876543210' } });
  assert.equal(start.status, 200);

  const confirm = await server.request('POST', '/auth/phone/confirm', {
    body: { phone: '9876543210', otp: '123456', session: start.body.session },
  });
  assert.equal(confirm.status, 200, JSON.stringify(confirm.body));
  assert.ok(confirm.body.accessToken);
  assert.ok(confirm.body.idToken);
  assert.equal(confirm.body.expiresIn, 3600);
  assert.deepEqual(Object.keys(confirm.body).sort(), ['accessToken', 'expiresIn', 'idToken', 'user']);
  assert.deepEqual(Object.keys(confirm.body.user).sort(), ['createdAt', 'email', 'isNew', 'name', 'phone', 'userId']);
  assert.equal(confirm.body.user.isNew, true);
  assert.equal(confirm.body.user.phone, '+919876543210');
  assert.equal(confirm.body.user.email, null);
  assert.equal(confirm.body.user.name, null);
  assert.match(confirm.body.user.userId, /^sub-/);

  const cookie = confirm.headers.get('set-cookie') ?? '';
  assert.match(cookie, /^mp_refresh=refresh-/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=None/);
  assert.match(cookie, /Secure/);

  // Row + identity written, phone marked verified in Cognito.
  const users = dynamo.items(TEST_ENV.USERS_TABLE);
  assert.equal(users.length, 1);
  assert.equal(users[0].UserId, confirm.body.user.userId);
  assert.equal(users[0].sub, confirm.body.user.userId);
  assert.equal(users[0].provider, 'phone');
  assert.equal(users[0].status, 'ACTIVE');
  const identities = dynamo.items(TEST_ENV.IDENTITIES_TABLE);
  assert.equal(identities.length, 1);
  assert.equal(identities[0].userId, confirm.body.user.userId);
  assert.ok(
    cognito.calls.some((c) => c.name === 'AdminUpdateUserAttributesCommand' && c.input.UserAttributes[0].Name === 'phone_number_verified')
  );

  // Second login: same user, isNew false.
  const start2 = await server.request('POST', '/auth/phone/start', { body: { phone: '+919876543210' } });
  const confirm2 = await server.request('POST', '/auth/phone/confirm', {
    body: { phone: '+919876543210', otp: '123456', session: start2.body.session },
  });
  assert.equal(confirm2.status, 200);
  assert.equal(confirm2.body.user.isNew, false);
  assert.equal(confirm2.body.user.userId, confirm.body.user.userId);
  assert.equal(dynamo.items(TEST_ENV.USERS_TABLE).length, 1);
});

test('POST /auth/phone/confirm with a wrong OTP returns invalid_otp and a fresh session', async () => {
  const start = await server.request('POST', '/auth/phone/start', { body: { phone: '9876543210' } });
  const bad = await server.request('POST', '/auth/phone/confirm', {
    body: { phone: '9876543210', otp: '000000', session: start.body.session },
  });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'invalid_otp');
  assert.ok(bad.body.session && bad.body.session !== start.body.session, 'a new session is handed back for the retry');
  assert.equal(dynamo.items(TEST_ENV.USERS_TABLE).length, 0);

  // The fresh session still works with the right code.
  const good = await server.request('POST', '/auth/phone/confirm', {
    body: { phone: '9876543210', otp: '123456', session: bad.body.session },
  });
  assert.equal(good.status, 200);
});

test('POST /auth/phone/confirm with an expired/used session is invalid_otp without a session', async () => {
  const r = await server.request('POST', '/auth/phone/confirm', {
    body: { phone: '9876543210', otp: '123456', session: 'session-does-not-exist' },
  });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'invalid_otp');
  assert.equal(r.body.session, undefined);
});

test('a self-deleted account is re-enabled on the next phone login and comes back as isNew', async () => {
  const start = await server.request('POST', '/auth/phone/start', { body: { phone: '9876543210' } });
  const confirm = await server.request('POST', '/auth/phone/confirm', {
    body: { phone: '9876543210', otp: '123456', session: start.body.session },
  });
  const userId = confirm.body.user.userId as string;

  // Simulate DELETE /auth/me's end state.
  const row = dynamo.tables.get(TEST_ENV.USERS_TABLE)!;
  const key = [...row.keys()][0];
  row.set(key, { ...row.get(key)!, status: 'DELETED', deletedAt: new Date().toISOString() });
  cognito.users.get('+919876543210')!.enabled = false;

  const start2 = await server.request('POST', '/auth/phone/start', { body: { phone: '9876543210' } });
  assert.equal(start2.status, 200, JSON.stringify(start2.body));
  assert.ok(cognito.calls.some((c) => c.name === 'AdminEnableUserCommand'));

  const confirm2 = await server.request('POST', '/auth/phone/confirm', {
    body: { phone: '9876543210', otp: '123456', session: start2.body.session },
  });
  assert.equal(confirm2.status, 200);
  assert.equal(confirm2.body.user.isNew, true);
  assert.equal(confirm2.body.user.userId, userId);
  assert.equal(dynamo.items(TEST_ENV.USERS_TABLE)[0].status, 'ACTIVE');
  assert.equal(dynamo.items(TEST_ENV.USERS_TABLE)[0].deletedAt, undefined);
});
