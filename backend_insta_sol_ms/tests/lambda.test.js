// The Lambda handler's two triggers: EventBridge runs the worker, API Gateway
// reaches Express (with the custom-domain base path stripped).

import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, withEnv } from './support.js';

freshDb();
const { handler, isScheduledEvent } = await import('../lambda.js');

const httpEvent = (path) => ({
  httpMethod: 'GET',
  path,
  headers: {},
  multiValueHeaders: {},
  queryStringParameters: null,
  requestContext: { requestId: 'r1' },
  body: null,
  isBase64Encoded: false,
});

test('scheduled events are recognised', () => {
  assert.equal(isScheduledEvent({ source: 'aws.events' }), true);
  assert.equal(isScheduledEvent({ 'detail-type': 'Scheduled Event' }), true);
  assert.equal(isScheduledEvent({ job: 'instagram-worker' }), true);
  assert.equal(isScheduledEvent(httpEvent('/api/insta/health')), false);
});

test('a scheduled event runs the worker and returns its summary', async () => {
  const summary = await handler({ job: 'instagram-worker' }, {});
  assert.equal(summary.accounts, 0);
  assert.deepEqual(summary.errors, []);
});

test('an API Gateway event reaches Express, with the base path stripped when enabled', async () => {
  const plain = await handler(httpEvent('/api/insta/health'), {});
  assert.equal(plain.statusCode, 200);
  assert.equal(JSON.parse(plain.body).status, 'ok');

  await withEnv({ ENABLE_BASE_PATH_STRIP: 'true', INSTA_API_BASE_PATH: 'devrealestateinsta' }, async () => {
    const mapped = await handler(httpEvent('/devrealestateinsta/api/insta/health'), {});
    assert.equal(mapped.statusCode, 200);
  });
});
