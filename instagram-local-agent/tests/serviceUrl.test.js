/**
 * The laptop reaches the cloud only via custom domain + base path, and signs
 * the path the insta Lambda sees AFTER it strips that base path.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { UplinkClient, signRequest } from '../src/uplink/client.js';
import { buildServiceBaseUrl, resolveCloudBaseUrl } from '../src/util/serviceUrl.js';

test('composes https + domain + base path', () => {
  assert.equal(
    resolveCloudBaseUrl({ domainName: 'services-api.cloudberrysolutions.in', basePath: '/devrealestateinsta/' }),
    'https://services-api.cloudberrysolutions.in/devrealestateinsta',
  );
  assert.equal(buildServiceBaseUrl('http://localhost:4000/', ''), 'http://localhost:4000');
});

test('rejects raw execute-api hosts, placeholders and the retired baseUrl shape', () => {
  assert.throws(() => resolveCloudBaseUrl({ domainName: 'xjmtq7jke4.execute-api.ap-south-1.amazonaws.com', basePath: 'v1' }), /raw API Gateway/);
  assert.throws(() => resolveCloudBaseUrl({ domainName: 'REPLACE_ME', basePath: 'x' }), /cloud.domainName/);
  assert.throws(() => resolveCloudBaseUrl({ baseUrl: 'https://example.com' }), /no longer supported/);
});

test('requests go to <base url>/api/insta/... and sign /api/insta/...', async () => {
  let seen = null;
  const device = { deviceId: 'dev-1', deviceSecret: 's'.repeat(64) };
  const client = new UplinkClient({
    config: { cloud: { domainName: 'example.invalid', basePath: 'devrealestateinsta' } },
    device,
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return new Response('{"ok":true}', { status: 200 });
    },
  });

  await client.request('POST', '/agent/heartbeat', { a: 1 });

  assert.equal(seen.url, 'https://example.invalid/devrealestateinsta/api/insta/agent/heartbeat');
  const h = seen.init.headers;
  const expected = signRequest({
    secret: device.deviceSecret,
    method: 'POST',
    path: '/api/insta/agent/heartbeat',
    timestamp: h['x-insta-timestamp'],
    nonce: h['x-insta-nonce'],
    rawBody: seen.init.body,
  });
  assert.equal(h['x-insta-signature'], expected);
});
