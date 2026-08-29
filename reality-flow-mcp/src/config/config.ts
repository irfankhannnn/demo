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

  // OAuth Base URL (auto-computed by CloudFormation in production)
  OAUTH_BASE_URL: z.string().default(''),

  // DynamoDB Tables
  OAUTH_CODES_TABLE_NAME: z.string().default('realtyflow-oauth-codes'),
  OAUTH_CONNECTIONS_TABLE: z.string().default('realtyflow-oauth-connections'),

  // CRM Backend API (for tool execution via HTTP)
  CRM_API_URL: z.string().min(1, 'CRM_API_URL is required'),
  CRM_API_INTERNAL_KEY: z.string().default(''),

  // Cognito (for validating user tokens on /oauth/authorize)
  COGNITO_USER_POOL_ID: z.string().default(''),
  COGNITO_CLIENT_ID: z.string().default(''),
  AUTH_SERVICE_URL: z.string().default(''),

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

  // Domain
  DOMAIN_NAME: z.string().default(''),
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

  _config = parsed.data;
  return _config;
}


