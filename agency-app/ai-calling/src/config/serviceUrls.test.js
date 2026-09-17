import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildServiceBaseUrl, getCrmInternalApiBaseUrl } from './serviceUrls.js';

test('composes https + domain + base path', () => {
  assert.equal(
    getCrmInternalApiBaseUrl({
      CRM_INTERNAL_API_DOMAIN_NAME: ' services-api.cloudberrysolutions.in ',
      CRM_INTERNAL_API_BASE_PATH: '/devrealestatecrm/',
    }),
    'https://services-api.cloudberrysolutions.in/devrealestatecrm',
  );
});

test('keeps an explicit scheme for local dev and allows an empty base path', () => {
  assert.equal(buildServiceBaseUrl('http://localhost:4000/', ''), 'http://localhost:4000');
});

test('fails naming the env var when the domain is missing', () => {
  assert.throws(() => getCrmInternalApiBaseUrl({}), /CRM_INTERNAL_API_DOMAIN_NAME/);
});

test('rejects raw API Gateway hosts', () => {
  assert.throws(
    () => buildServiceBaseUrl('see5j61tuh.execute-api.ap-south-1.amazonaws.com', 'dev'),
    /raw API Gateway URLs are not allowed/,
  );
  assert.throws(
    () => buildServiceBaseUrl('https://see5j61tuh.execute-api.ap-south-1.amazonaws.com/dev', ''),
    /raw API Gateway URLs are not allowed/,
  );
});
