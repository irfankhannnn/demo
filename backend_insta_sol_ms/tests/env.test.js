// Environment contract.
//
// What these tests protect: every API this service calls is reached through an
// API Gateway custom domain + base path, a half-configured Instagram app fails
// at boot rather than on the first connect, and the two local-only shortcuts
// (in-memory store, login bypass) can never run in a deployed function.

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServiceBaseUrl, assertEnv, getConfig } from '../config/env.js';

const KEY = 'a'.repeat(64);

async function withVars(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const BASE_VARS = {
  AUTH_SERVICE_DOMAIN_NAME: 'services-api.cloudberrysolutions.in',
  AUTH_SERVICE_BASE_PATH: 'devrealestateauth',
  INSTA_DATA_TABLE_NAME: 'dev-realestateflow-insta-data',
  INSTA_AUDIT_TABLE_NAME: 'dev-realestateflow-insta-audit',
  CRM_INTERNAL_API_DOMAIN_NAME: undefined,
  INSTA_API_DOMAIN_NAME: undefined,
  INSTA_API_BASE_PATH: undefined,
  META_APP_ID: undefined,
  META_APP_SECRET: undefined,
  META_REDIRECT_URI: undefined,
  INSTA_TOKEN_ENCRYPTION_KEY: undefined,
  INSTA_CONSOLE_URL: undefined,
  INSTA_STORE: undefined,
  INSTA_DEV_AUTH_TENANT_ID: undefined,
  AWS_LAMBDA_FUNCTION_NAME: undefined,
  NODE_ENV: undefined,
};

test('bare domain + base path composes an https URL', () => {
  assert.equal(
    buildServiceBaseUrl('services-api.cloudberrysolutions.in', 'devrealestateauth'),
    'https://services-api.cloudberrysolutions.in/devrealestateauth'
  );
  assert.equal(
    buildServiceBaseUrl('  services-api.realestateflow.in  ', ' /prodrealestatecrm/ '),
    'https://services-api.realestateflow.in/prodrealestatecrm'
  );
});

test('a full origin is used verbatim for local development, base path optional', () => {
  assert.equal(buildServiceBaseUrl('http://localhost:4000/', ''), 'http://localhost:4000');
  assert.equal(buildServiceBaseUrl('http://localhost:4000', undefined), 'http://localhost:4000');
});

test('an empty domain fails naming the env var, and raw API Gateway hosts are rejected', () => {
  assert.throws(() => buildServiceBaseUrl('  ', 'x', 'AUTH_SERVICE_DOMAIN_NAME'), /AUTH_SERVICE_DOMAIN_NAME/);
  assert.throws(() => buildServiceBaseUrl('abc123.execute-api.ap-south-1.amazonaws.com', 'dev'), /raw API Gateway URLs are not allowed/);
  assert.throws(() => buildServiceBaseUrl('https://abc123.execute-api.ap-south-1.amazonaws.com/dev', ''), /raw API Gateway URLs are not allowed/);
});

test('config composes auth + CRM URLs, and the CRM bridge stays optional', async () => {
  await withVars({ ...BASE_VARS, CRM_INTERNAL_API_DOMAIN_NAME: 'services-api.cloudberrysolutions.in', CRM_INTERNAL_API_BASE_PATH: 'devrealestatecrm' }, async () => {
    assert.doesNotThrow(() => assertEnv());
    const cfg = getConfig();
    assert.equal(cfg.authServiceUrl, 'https://services-api.cloudberrysolutions.in/devrealestateauth');
    assert.equal(cfg.crmInternalApiUrl, 'https://services-api.cloudberrysolutions.in/devrealestatecrm');
    assert.equal(cfg.instagramConfigured, false);

    delete process.env.CRM_INTERNAL_API_DOMAIN_NAME;
    assert.equal(getConfig().crmInternalApiUrl, undefined);

    process.env.AUTH_SERVICE_DOMAIN_NAME = 'gpjh2iy6h4.execute-api.ap-south-1.amazonaws.com';
    assert.throws(() => assertEnv(), /AUTH_SERVICE_DOMAIN_NAME.*raw API Gateway/);
  });
});

test('the OAuth redirect URI is derived from this API\'s own public URL, unless overridden', async () => {
  await withVars(
    {
      ...BASE_VARS,
      INSTA_API_DOMAIN_NAME: 'services-api.cloudberrysolutions.in',
      INSTA_API_BASE_PATH: 'devrealestateinsta',
      META_APP_ID: '123',
      META_APP_SECRET: 's',
      INSTA_TOKEN_ENCRYPTION_KEY: KEY,
      INSTA_CONSOLE_URL: 'https://app.example.com/insta/',
    },
    async () => {
      assert.doesNotThrow(() => assertEnv());
      const cfg = getConfig();
      assert.equal(cfg.meta.redirectUri, 'https://services-api.cloudberrysolutions.in/devrealestateinsta/api/insta/oauth/callback');
      assert.equal(cfg.consoleUrl, 'https://app.example.com/insta');
      assert.equal(cfg.instagramConfigured, true);
      assert.deepEqual(cfg.meta.scopes, ['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments']);

      process.env.META_REDIRECT_URI = 'https://tunnel.example.dev/api/insta/oauth/callback';
      assert.equal(getConfig().meta.redirectUri, 'https://tunnel.example.dev/api/insta/oauth/callback');
    }
  );
});

test('a half-configured Instagram app fails at boot, naming every missing piece', async () => {
  await withVars({ ...BASE_VARS, META_APP_ID: '123', INSTA_TOKEN_ENCRYPTION_KEY: 'too-short' }, async () => {
    let message = '';
    try {
      assertEnv();
    } catch (err) {
      message = err.message;
    }
    assert.match(message, /META_APP_SECRET/);
    assert.match(message, /INSTA_TOKEN_ENCRYPTION_KEY/);
    assert.match(message, /INSTA_API_DOMAIN_NAME/);
    assert.match(message, /INSTA_CONSOLE_URL/);
    assert.equal(getConfig().instagramConfigured, false);
  });
});

test('the in-memory store needs no tables locally and is refused in Lambda', async () => {
  await withVars({ ...BASE_VARS, INSTA_STORE: 'memory', INSTA_DATA_TABLE_NAME: undefined, INSTA_AUDIT_TABLE_NAME: undefined }, async () => {
    assert.doesNotThrow(() => assertEnv());
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'dev-realestateflow-insta-lambda';
    assert.throws(() => assertEnv(), /INSTA_STORE=memory/);
  });
});

test('the login bypass is refused in Lambda and in production', async () => {
  await withVars({ ...BASE_VARS, INSTA_DEV_AUTH_TENANT_ID: 't1' }, async () => {
    assert.doesNotThrow(() => assertEnv());
    process.env.NODE_ENV = 'production';
    assert.throws(() => assertEnv(), /INSTA_DEV_AUTH_TENANT_ID/);
    process.env.NODE_ENV = 'development';
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'fn';
    assert.throws(() => assertEnv(), /INSTA_DEV_AUTH_TENANT_ID/);
  });
});
