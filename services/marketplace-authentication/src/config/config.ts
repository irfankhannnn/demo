import { z } from 'zod';

const boolString = z
  .string()
  .default('false')
  .transform((s) => s.trim().toLowerCase() === 'true');

const envSchema = z.object({
  // AWS. Lambda injects AWS_REGION itself; locally it comes from .env.
  AWS_REGION: z.string().default('ap-south-1'),

  // Service
  SERVICE_NAME: z.string().default('realestateflow-marketplace-auth'),
  ENV: z.enum(['dev', 'test', 'prod']).default('dev'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Cognito consumer pool (phone_number is the username attribute; email optional)
  COGNITO_USER_POOL_ID: z.string().min(1, 'COGNITO_USER_POOL_ID is required'),
  COGNITO_CLIENT_ID: z.string().min(1, 'COGNITO_CLIENT_ID is required'),
  COGNITO_CLIENT_SECRET: z.string().optional(),
  COGNITO_HOSTED_UI_DOMAIN: z.string().min(1, 'COGNITO_HOSTED_UI_DOMAIN is required'),

  // DynamoDB tables owned by this stack
  USERS_TABLE: z.string().min(1, 'USERS_TABLE is required'),
  IDENTITIES_TABLE: z.string().min(1, 'IDENTITIES_TABLE is required'),

  // CORS — comma-separated browser origins of marketplace-web. Trimmed so a
  // spaced-out value like "a, b" still matches.
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:3000')
    .transform((s) => [...new Set(s.split(',').map((o) => o.trim()).filter(Boolean))]),

  // Inbound service-to-service key (x-internal-api-key on /internal/*)
  INTERNAL_API_KEY: z.string().min(1, 'INTERNAL_API_KEY is required'),

  // Outbound: marketplace-api internal routes (DELETE /internal/users/:id on
  // account deletion). Domain is a placeholder until the custom domain is
  // mapped; empty domain disables the call (logged, never fatal).
  MARKETPLACE_API_DOMAIN_NAME: z.string().default(''),
  MARKETPLACE_API_BASE_PATH: z.string().default(''),
  AUTH_CALLER_API_KEY: z.string().default(''),

  // Custom-domain base path handling (see src/index.ts stripBasePath)
  MARKETPLACE_AUTH_BASE_PATH: z.string().default(''),
  ENABLE_BASE_PATH_STRIP: boolString,

  // Local-dev knob. Rate limits are per-IP and low (3 OTP starts / 15 min);
  // disable them only on a developer machine.
  RATE_LIMIT_DISABLED: boolString,

  // Local dev
  PORT: z.string().default('3007').transform(Number),
});

export type EnvConfig = z.infer<typeof envSchema>;

let _config: EnvConfig | null = null;

export function loadConfig(): EnvConfig {
  if (_config) return _config;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:');
    console.error(parsed.error.format());
    throw new Error('Invalid environment configuration');
  }

  _config = parsed.data;
  return _config;
}

export function getConfig(): EnvConfig {
  return _config ?? loadConfig();
}

/** Test helper: drop the cached config so a test can set process.env and reload. */
export function resetConfigForTests(): void {
  _config = null;
}
