/**
 * PostHog Node SDK wrapper — server-side event capture.
 *
 * Usage: `import { serverTrack } from '../lib/posthog.js';`
 * Call from any route/service that has a known distinctId (userId).
 *
 * Replaces the stub from PR-B (grievance.js inline function).
 */
import { PostHog } from 'posthog-node';

let client = null;

function getPostHogClient() {
  if (!client && process.env.POSTHOG_KEY_SERVER) {
    client = new PostHog(process.env.POSTHOG_KEY_SERVER, {
      host: process.env.POSTHOG_HOST || 'https://eu.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export async function serverTrack(distinctId, event, properties = {}) {
  const ph = getPostHogClient();
  if (!ph) return;
  try {
    await ph.capture({ distinctId, event, properties });
  } catch (err) {
    console.error('[PostHog server]', err.message);
  }
}

export async function shutdownPostHog() {
  if (client) await client.shutdownAsync();
}
