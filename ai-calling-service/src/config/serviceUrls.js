// Service base URLs, composed from an API Gateway custom domain + base path.
//
// Every API in this repo is reached through services-api.cloudberrysolutions.in
// (dev) or services-api.realestateflow.in (prod) plus a single-segment base
// path mapping. Raw execute-api invoke URLs are refused: they bypass the
// mapping and change whenever a stack is rebuilt.
//
// Read lazily (not at import) because Lambda cold-start hydration populates
// process.env after modules load.

/**
 * @param {string|undefined} domainName host only; a scheme is allowed for local dev (http://localhost:4000)
 * @param {string|undefined} basePath single segment, leading/trailing slashes ignored
 * @param {string} domainVar env var name, used in error messages
 */
export function buildServiceBaseUrl(domainName, basePath, domainVar = 'domainName') {
  const domain = String(domainName ?? '').trim();
  if (!domain) {
    throw new Error(`Missing required environment variable ${domainVar}`);
  }
  const origin = (domain.includes('://') ? domain : `https://${domain}`).replace(/\/+$/, '');
  if (/execute-api\.|\.amazonaws\.com/i.test(origin)) {
    throw new Error(`${domainVar}: raw API Gateway URLs are not allowed; use the custom domain`);
  }
  const bp = String(basePath ?? '').trim().replace(/^\/+|\/+$/g, '');
  return bp ? `${origin}/${bp}` : origin;
}

/** CRM API root; callers append /api/internal/... themselves. */
export function getCrmInternalApiBaseUrl(env = process.env) {
  return buildServiceBaseUrl(
    env.CRM_INTERNAL_API_DOMAIN_NAME,
    env.CRM_INTERNAL_API_BASE_PATH,
    'CRM_INTERNAL_API_DOMAIN_NAME',
  );
}

