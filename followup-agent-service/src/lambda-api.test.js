import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripBasePath, normalizeEventPath } from './lambda-api.js';

test('stripBasePath removes the configured prefix only', () => {
  assert.equal(stripBasePath('/devrealestatefollowup/api/followup/jobs', 'devrealestatefollowup'), '/api/followup/jobs');
  assert.equal(stripBasePath('/devrealestatefollowup', 'devrealestatefollowup'), '/');
  assert.equal(stripBasePath('/api/followup/jobs', 'devrealestatefollowup'), '/api/followup/jobs');
  assert.equal(stripBasePath('/api/followup/jobs', ''), '/api/followup/jobs');
});

test('normalizeEventPath touches every path field', () => {
  process.env.API_BASE_PATH_PREFIX = 'devrealestatefollowup';
  const event = normalizeEventPath({
    path: '/devrealestatefollowup/api/health',
    rawPath: '/devrealestatefollowup/api/health',
    requestContext: { path: '/devrealestatefollowup/api/health', http: { path: '/devrealestatefollowup/api/health' } },
  });
  assert.equal(event.path, '/api/health');
  assert.equal(event.rawPath, '/api/health');
  assert.equal(event.requestContext.path, '/api/health');
  assert.equal(event.requestContext.http.path, '/api/health');
});
