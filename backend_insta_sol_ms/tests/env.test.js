// Service URL composition (custom-domain contract).
//
// What these tests protect: every API this service calls is reached through an
// API Gateway custom domain + base path, never a raw execute-api invoke URL, and
// a misconfigured domain fails at boot rather than on the first request.

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServiceBaseUrl, assertEnv, getConfig } from '../config/env.js';

test('bare domain + base path composes an https URL', () => {
  assert.equal(
    buildServiceBaseUrl('services-api.cloudberrysolutions.in', 'devrealestateauth'),
    'https://services-api.cloudberrysolutions.in/devrealestateauth'
  );
});

test('surrounding whitespace and slashes are trimmed', () => {
  assert.equal(
    buildServiceBaseUrl('  services-api.realestateflow.in  ', ' /prodrealestatecrm/ '),
    'https://services-api.realestateflow.in/prodrealestatecrm'
  );
});

test('a full origin is used verbatim for local development, base path optional', () => {
  assert.equal(buildServiceBaseUrl('http://localhost:4000/', ''), 'http://localhost:4000');
  assert.equal(buildServiceBaseUrl('http://localhost:4000', undefined), 'http://localhost:4000');
});

test('an empty domain fails, naming the env var', () => {
  assert.throws(() => buildServiceBaseUrl('  ', 'x', 'AUTH_SERVICE_DOMAIN_NAME'), /AUTH_SERVICE_DOMAIN_NAME/);
});

test('raw API Gateway hosts are rejected', () => {
  assert.throws(
    () => buildServiceBaseUrl('abc123.execute-api.ap-south-1.amazonaws.com', 'dev'),
    /raw API Gateway URLs are not allowed/
  );
  assert.throws(
    () => buildServiceBaseUrl('https://abc123.execute-api.ap-south-1.amazonaws.com/dev', ''),
    /raw API Gateway URLs are not allowed/
  );
});

test('config composes auth + CRM URLs from DOMAIN_NAME/BASE_PATH pairs', () => {
  const keys = [
    'AUTH_SERVICE_DOMAIN_NAME',
    'AUTH_SERVICE_BASE_PATH',
    'CRM_INTERNAL_API_DOMAIN_NAME',
    'CRM_INTERNAL_API_BASE_PATH',
    'INSTA_DATA_TABLE_NAME',
    'INSTA_AUDIT_TABLE_NAME',
  ];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    process.env.AUTH_SERVICE_DOMAIN_NAME = 'services-api.cloudberrysolutions.in';
    process.env.AUTH_SERVICE_BASE_PATH = 'devrealestateauth';
    process.env.CRM_INTERNAL_API_DOMAIN_NAME = 'services-api.cloudberrysolutions.in';
    process.env.CRM_INTERNAL_API_BASE_PATH = 'devrealestatecrm';
    process.env.INSTA_DATA_TABLE_NAME = 'dev-realestateflow-insta-data';
    process.env.INSTA_AUDIT_TABLE_NAME = 'dev-realestateflow-insta-audit';

    assert.doesNotThrow(() => assertEnv());
    const cfg = getConfig();
    assert.equal(cfg.authServiceUrl, 'https://services-api.cloudberrysolutions.in/devrealestateauth');
    assert.equal(cfg.crmInternalApiUrl, 'https://services-api.cloudberrysolutions.in/devrealestatecrm');

    delete process.env.CRM_INTERNAL_API_DOMAIN_NAME;
    assert.equal(getConfig().crmInternalApiUrl, undefined, 'CRM bridge stays optional');

    process.env.AUTH_SERVICE_DOMAIN_NAME = 'gpjh2iy6h4.execute-api.ap-south-1.amazonaws.com';
    assert.throws(() => assertEnv(), /AUTH_SERVICE_DOMAIN_NAME.*raw API Gateway/);
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});
