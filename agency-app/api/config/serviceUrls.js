/**
 * Base URLs for the other backend services this server calls.
 *
 * Every API is reached through its API Gateway custom domain plus a single-
 * segment base path mapping, never through a raw
 * https://<id>.execute-api.<region>.amazonaws.com/<stage> invoke URL. Each
 * dependency is therefore configured as a pair of env vars:
 *   <STEM>_DOMAIN_NAME  e.g. services-api.cloudberrysolutions.in
 *   <STEM>_BASE_PATH    e.g. devrealestateauth
 * and composed here, in one place. Route suffixes (/auth/me, /oauth/token,
 * /api/ai-calling/...) are appended by the calling code, never baked into env
 * values.
 *
 * Everything is resolved at call time, not at import: in Lambda,
 * config/ssmBootstrap.js hydrates process.env from SSM during cold start, so a
 * value captured at module load could be stale or undefined.
 */

export class ServiceUrlConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ServiceUrlConfigError';
  }
}

const RAW_API_GATEWAY_HOST = /execute-api\.|\.amazonaws\.com/i;

/**
 * Compose a service base URL from a custom domain and base path.
 *
 * @param {string|undefined} domainName  bare host (https:// is implied); a value
 *   containing "://" is used as the origin as-is, for local dev only
 *   (e.g. http://localhost:3002)
 * @param {string|undefined} basePath    single path segment; leading/trailing
 *   slashes are ignored; empty means "no base path"
 * @param {string} [domainVarName]       env var name, used in error messages
 * @returns {string} origin[/basePath], no trailing slash
 */
export function buildServiceBaseUrl(domainName, basePath, domainVarName = 'domainName') {
  const domain = String(domainName ?? '').trim();
  if (!domain) {
    throw new ServiceUrlConfigError(`${domainVarName} is not configured`);
  }

  let origin = domain.includes('://') ? domain : `https://${domain}`;
  origin = origin.replace(/\/+$/, '');

  let host;
  try {
    host = new URL(origin).host;
  } catch {
    throw new ServiceUrlConfigError(`${domainVarName} is not a valid domain name: ${domain}`);
  }
  if (RAW_API_GATEWAY_HOST.test(host)) {
    throw new ServiceUrlConfigError(
      `${domainVarName}: raw API Gateway URLs are not allowed; use the custom domain`
    );
  }

  const bp = String(basePath ?? '').trim().replace(/^\/+|\/+$/g, '');
  return bp ? `${origin}/${bp}` : origin;
}

function isBlank(value) {
  return String(value ?? '').trim() === '';
}

/**
 * reality-flow-authentication. Required: throws ServiceUrlConfigError when
 * AUTH_SERVICE_DOMAIN_NAME is unset or points at a raw API Gateway host.
 */
export function getAuthServiceBaseUrl() {
  return buildServiceBaseUrl(
    process.env.AUTH_SERVICE_DOMAIN_NAME,
    process.env.AUTH_SERVICE_BASE_PATH,
    'AUTH_SERVICE_DOMAIN_NAME'
  );
}

/**
 * reality-flow-mcp. Optional (prod has no MCP stack yet): returns null when
 * MCP_API_DOMAIN_NAME is blank, meaning "MCP not configured". Still throws on
 * a raw API Gateway host.
 */
export function getMcpApiBaseUrl() {
  if (isBlank(process.env.MCP_API_DOMAIN_NAME)) {
    return null;
  }
  return buildServiceBaseUrl(
    process.env.MCP_API_DOMAIN_NAME,
    process.env.MCP_API_BASE_PATH,
    'MCP_API_DOMAIN_NAME'
  );
}

/** Express mount prefix of ai-calling-service's management API. */
export const AI_CALLING_API_PREFIX = '/api/ai-calling';

/**
 * ai-calling-service management API (already including its /api/ai-calling
 * prefix). Optional: returns null when AI_CALLING_SERVICE_DOMAIN_NAME is blank
 * (stack not deployed). Still throws on a raw API Gateway host.
 */
export function getAiCallingServiceBaseUrl() {
  if (isBlank(process.env.AI_CALLING_SERVICE_DOMAIN_NAME)) {
    return null;
  }
  const base = buildServiceBaseUrl(
    process.env.AI_CALLING_SERVICE_DOMAIN_NAME,
    process.env.AI_CALLING_SERVICE_BASE_PATH,
    'AI_CALLING_SERVICE_DOMAIN_NAME'
  );
  return `${base}${AI_CALLING_API_PREFIX}`;
}

/**
 * followup-agent-service (the AI site-visit confirmation / post-visit feedback
 * caller). Optional: returns null when FOLLOWUP_SERVICE_DOMAIN_NAME is blank
 * (stack not deployed), so callers can degrade to "not configured" rather
 * than dial a half-built URL. Still throws on a raw API Gateway host.
 *
 * Unlike the ai-calling getter this returns the bare service base — the
 * route prefix (/api/followup/...) is appended by services/followupService.js,
 * which is the only module that talks to it.
 */
export function getFollowupServiceBaseUrl() {
  if (isBlank(process.env.FOLLOWUP_SERVICE_DOMAIN_NAME)) {
    return null;
  }
  return buildServiceBaseUrl(
    process.env.FOLLOWUP_SERVICE_DOMAIN_NAME,
    process.env.FOLLOWUP_SERVICE_BASE_PATH,
    'FOLLOWUP_SERVICE_DOMAIN_NAME'
  );
}

/**
 * marketplace-api (the consumer properties portal backend). Optional: returns
 * null when MARKETPLACE_API_DOMAIN_NAME is blank (stack not deployed), so the
 * CRM's Marketplace Inbox can report "not configured" instead of dialling a
 * half-built URL. Still throws on a raw API Gateway host.
 */
export function getMarketplaceApiBaseUrl() {
  if (isBlank(process.env.MARKETPLACE_API_DOMAIN_NAME)) {
    return null;
  }
  return buildServiceBaseUrl(
    process.env.MARKETPLACE_API_DOMAIN_NAME,
    process.env.MARKETPLACE_API_BASE_PATH,
    'MARKETPLACE_API_DOMAIN_NAME'
  );
}
