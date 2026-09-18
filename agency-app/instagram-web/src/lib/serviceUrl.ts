/**
 * Composes an API base URL from an API Gateway custom domain and its base path
 * mapping. Mirrors agency-app/instagram-api/config/env.js `buildServiceBaseUrl`.
 *
 * - `domainName` is a bare hostname (services-api.realestateflow.in). A value
 *   containing "://" is used as the origin verbatim — local development only
 *   (http://localhost:3101).
 * - Raw API Gateway invoke URLs are rejected: every API is reached through its
 *   custom domain.
 * - App-internal prefixes (`/api/insta`) are appended by the caller, never here.
 */

// "[-]" keeps the literal invoke-host string out of the built bundle, so a plain
// grep of dist/ for raw API Gateway URLs stays a clean signal.
const RAW_API_GATEWAY_HOST = /execute[-]api\.|\.amazonaws\.com/i;

export function buildServiceBaseUrl(
  domainName: string | undefined,
  basePath: string | undefined,
  domainVar = 'domainName',
): string {
  const domain = (domainName ?? '').trim();
  if (!domain) {
    throw new Error(`${domainVar} is not configured`);
  }

  const origin = (domain.includes('://') ? domain : `https://${domain}`).replace(/\/+$/, '');

  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    throw new Error(`${domainVar} ('${domain}') is not a valid hostname or origin`);
  }
  if (RAW_API_GATEWAY_HOST.test(host)) {
    throw new Error(`${domainVar} ('${domain}'): raw API Gateway URLs are not allowed; use the custom domain`);
  }

  const bp = (basePath ?? '').trim().replace(/^\/+|\/+$/g, '');
  return bp ? `${origin}/${bp}` : origin;
}
