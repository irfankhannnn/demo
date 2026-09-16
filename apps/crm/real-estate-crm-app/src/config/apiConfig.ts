/**
 * Central API endpoint configuration. The ONLY module that reads API
 * domain/base-path env vars — everything else imports from here.
 *
 * Each API is configured as a custom-domain + base-path pair:
 *   VITE_CRM_API_DOMAIN_NAME  + VITE_CRM_API_BASE_PATH   server CRM REST API (devrealestatecrm / prodrealestatecrm)
 *   VITE_AUTH_API_DOMAIN_NAME + VITE_AUTH_API_BASE_PATH  reality-flow-authentication (devrealestateauth / prodrealestateauth)
 *   VITE_MCP_API_DOMAIN_NAME  + VITE_MCP_API_BASE_PATH   reality-flow-mcp (devrealestatemcp / prodrealestatemcp) — optional
 *
 * Route prefixes are appended here, never baked into env values.
 */
import { buildServiceBaseUrl } from '../utils/serviceUrl';

const env = import.meta.env;

/**
 * Server CRM API, including the `/api` prefix — callers append e.g.
 * `/crm/leads`. Serves every server route the CRM app uses (the CRM REST API
 * has an `/api/{proxy+}` catch-all), including the public grievance and NPS
 * endpoints.
 */
export const CRM_API_URL = `${buildServiceBaseUrl(
  env.VITE_CRM_API_DOMAIN_NAME,
  env.VITE_CRM_API_BASE_PATH,
  'VITE_CRM_API_DOMAIN_NAME',
)}/api`;

/** Auth service root — callers append e.g. `/auth/refresh`. */
export const AUTH_API_URL = buildServiceBaseUrl(
  env.VITE_AUTH_API_DOMAIN_NAME,
  env.VITE_AUTH_API_BASE_PATH,
  'VITE_AUTH_API_DOMAIN_NAME',
);

const mcpDomain = (env.VITE_MCP_API_DOMAIN_NAME ?? '').trim();
const mcpBaseUrl = mcpDomain
  ? buildServiceBaseUrl(mcpDomain, env.VITE_MCP_API_BASE_PATH, 'VITE_MCP_API_DOMAIN_NAME')
  : null;

/**
 * Full MCP endpoint (`<base>/mcp`) for the Claude Desktop setup snippet, or
 * null when this deployment has no MCP server — the UI then says the
 * connector isn't available instead of showing a broken URL.
 */
export const MCP_SERVER_URL: string | null = mcpBaseUrl ? `${mcpBaseUrl}/mcp` : null;

/** Host name of the MCP server, for the OAuth redirect allowlist. Null when unset. */
export const MCP_API_HOSTNAME: string | null = mcpBaseUrl ? new URL(mcpBaseUrl).hostname : null;
