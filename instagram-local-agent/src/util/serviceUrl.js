/**
 * Cloud API base URL, composed from an API Gateway custom domain + base path.
 *
 * The laptop reaches backend_insta_sol_ms only through the shared custom
 * domain (services-api.cloudberrysolutions.in / services-api.realestateflow.in)
 * and its base path mapping (devrealestateinsta / prodrealestateinsta). Raw
 * execute-api invoke URLs are refused.
 */

/** The insta API's own route prefix. Appended by code, never configured. */
export const INSTA_API_PREFIX = '/api/insta';

export function buildServiceBaseUrl(domainName, basePath, domainVar = 'domainName') {
  const domain = String(domainName ?? '').trim();
  if (!domain) throw new Error(`${domainVar} is not configured`);
  const origin = (domain.includes('://') ? domain : `https://${domain}`).replace(/\/+$/, '');
  if (/execute-api\.|\.amazonaws\.com/i.test(origin)) {
    throw new Error(`${domainVar}: raw API Gateway URLs are not allowed; use the custom domain`);
  }
  const bp = String(basePath ?? '').trim().replace(/^\/+|\/+$/g, '');
  return bp ? `${origin}/${bp}` : origin;
}

/** True when config.cloud has a real (non-placeholder) domain. */
export function cloudConfigured(cloud) {
  const domain = String(cloud?.domainName ?? '').trim();
  return Boolean(domain) && !domain.startsWith('REPLACE');
}

/**
 * config.cloud -> https://<domainName>/<basePath>. Throws with the config key
 * named, including for the retired cloud.baseUrl shape.
 */
export function resolveCloudBaseUrl(cloud) {
  if (!cloudConfigured(cloud)) {
    if (cloud?.baseUrl) {
      throw new Error('cloud.baseUrl is no longer supported; set cloud.domainName and cloud.basePath instead');
    }
    throw new Error('cloud.domainName is not configured');
  }
  return buildServiceBaseUrl(cloud.domainName, cloud.basePath, 'cloud.domainName');
}
