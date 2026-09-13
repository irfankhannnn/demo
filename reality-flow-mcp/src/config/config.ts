import { z } from 'zod';

const envSchema = z.object({
  // AWS
  AWS_REGION: z.string().default('ap-south-1'),

  // Service
  SERVICE_NAME: z.string().default('realtyflow-mcp'),
  ENV: z.enum(['dev', 'test', 'prod']).default('dev'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // JWT Secrets (shared with CRM backend)
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),

  // This MCP server's own public base URL = https://<MCP_API_DOMAIN_NAME>/<MCP_API_BASE_PATH>.
  // Used as the OAuth issuer and for every URL this server publishes
  // (well-known metadata, WWW-Authenticate resource_metadata, login redirect).
  // Local dev only: MCP_API_DOMAIN_NAME=http://localhost:4001 with an empty base path.
  MCP_API_DOMAIN_NAME: z.string().trim().min(1, 'MCP_API_DOMAIN_NAME is required'),
  MCP_API_BASE_PATH: z.string().default(''),
  // Strip MCP_API_BASE_PATH from the incoming Lambda event path (see src/index.ts).
  ENABLE_BASE_PATH_STRIP: z.string().default('false'),

  // DynamoDB Tables
  OAUTH_CODES_TABLE_NAME: z.string().default('realtyflow-oauth-codes'),
  OAUTH_CONNECTIONS_TABLE: z.string().default('realtyflow-oauth-connections'),

  // CRM Backend API (for tool execution via HTTP) — server's CRM REST API
  // (devrealestatecrm / prodrealestatecrm), which serves POST /api/crm/agent/tool.
  CRM_API_DOMAIN_NAME: z.string().trim().min(1, 'CRM_API_DOMAIN_NAME is required'),
  CRM_API_BASE_PATH: z.string().default(''),
  CRM_API_INTERNAL_KEY: z.string().default(''),

  // Cognito (for validating user tokens on /oauth/authorize)
  COGNITO_USER_POOL_ID: z.string().default(''),
  COGNITO_CLIENT_ID: z.string().default(''),
  // Auth microservice (devrealestateauth / prodrealestateauth), serves GET /auth/me
  AUTH_SERVICE_DOMAIN_NAME: z.string().trim().min(1, 'AUTH_SERVICE_DOMAIN_NAME is required'),
  AUTH_SERVICE_BASE_PATH: z.string().default(''),

  // CORS
  ALLOWED_ORIGINS: z.string()
    .default('http://localhost:3000,http://localhost:5173')
    .transform(s => s.split(',').map(o => o.trim()).filter(Boolean)),

  // Local Dev
  PORT: z.string().default('4001').transform(Number),
  MCP_TENANT_ID: z.string().optional(),

  // Lambda Deployment
  LAMBDA_PACKAGES_BUCKET_NAME: z.string().default('realtyflow-lambda-packages'),
  LAMBDA_MEMORY_SIZE: z.string().default('512').transform(Number),
  LAMBDA_TIMEOUT: z.string().default('30').transform(Number),
  LOG_RETENTION_IN_DAYS: z.string().default('30').transform(Number),

});

export type EnvConfig = z.infer<typeof envSchema>;

let _config: EnvConfig | null = null;

export function loadConfig(): EnvConfig {
  if (_config) return _config;

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(parsed.error.format());
    throw new Error('Invalid environment configuration');
  }

  // Fail fast at cold start on a raw API Gateway URL or malformed domain,
  // rather than on the first request that needs the URL.
  buildServiceBaseUrl(parsed.data.MCP_API_DOMAIN_NAME, parsed.data.MCP_API_BASE_PATH, 'MCP_API_DOMAIN_NAME');
  buildServiceBaseUrl(parsed.data.CRM_API_DOMAIN_NAME, parsed.data.CRM_API_BASE_PATH, 'CRM_API_DOMAIN_NAME');
  buildServiceBaseUrl(parsed.data.AUTH_SERVICE_DOMAIN_NAME, parsed.data.AUTH_SERVICE_BASE_PATH, 'AUTH_SERVICE_DOMAIN_NAME');

  _config = parsed.data;
  return _config;
}

const RAW_API_GATEWAY_HOST = /execute-api\.|\.amazonaws\.com/i;

/**
 * Compose a service base URL from a custom domain + base path (repo-wide
 * custom-domain contract). Raw API Gateway invoke URLs are rejected.
 *   buildServiceBaseUrl('services-api.cloudberrysolutions.in', 'devrealestatecrm')
 *     -> 'https://services-api.cloudberrysolutions.in/devrealestatecrm'
 *   buildServiceBaseUrl('http://localhost:4000', '') -> 'http://localhost:4000' (local dev only)
 */
export function buildServiceBaseUrl(
  domainName: string | undefined,
  basePath: string | undefined,
  envVarName = 'domain name'
): string {
  const domain = (domainName || '').trim();
  if (!domain) {
    throw new Error(`${envVarName} is required (custom domain host, e.g. services-api.cloudberrysolutions.in)`);
  }
  let origin = domain.includes('://') ? domain : `https://${domain}`;
  origin = origin.replace(/\/+$/, '');
  let host = origin;
  try {
    host = new URL(origin).host;
  } catch {
    throw new Error(`${envVarName} is not a valid host: ${domain}`);
  }
  if (RAW_API_GATEWAY_HOST.test(host)) {
    throw new Error(`${envVarName}: raw API Gateway URLs are not allowed; use the custom domain`);
  }
  const bp = (basePath || '').trim().replace(/^\/+|\/+$/g, '');
  return bp ? `${origin}/${bp}` : origin;
}

/** Public base URL of THIS MCP server (OAuth issuer / resource). No trailing slash. */
export function getMcpPublicBaseUrl(): string {
  const c = loadConfig();
  return buildServiceBaseUrl(c.MCP_API_DOMAIN_NAME, c.MCP_API_BASE_PATH, 'MCP_API_DOMAIN_NAME');
}

/** Base URL of server's CRM API; callers append /api/crm/... */
export function getCrmApiBaseUrl(): string {
  const c = loadConfig();
  return buildServiceBaseUrl(c.CRM_API_DOMAIN_NAME, c.CRM_API_BASE_PATH, 'CRM_API_DOMAIN_NAME');
}

/** Base URL of the auth microservice; callers append /auth/... */
export function getAuthServiceBaseUrl(): string {
  const c = loadConfig();
  return buildServiceBaseUrl(c.AUTH_SERVICE_DOMAIN_NAME, c.AUTH_SERVICE_BASE_PATH, 'AUTH_SERVICE_DOMAIN_NAME');
}


