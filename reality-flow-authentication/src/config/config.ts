import { z } from 'zod';

const envSchema = z.object({
  // AWS
  AWS_REGION: z.string().default('ap-south-1'),

  // Service
  SERVICE_NAME: z.string().default('reality-flow-auth'),
  ENV: z.enum(['dev', 'test', 'prod']).default('dev'),

  // Cognito (V2 pool supporting both Google and Phone auth)
  COGNITO_USER_POOL_ID: z.string().min(1, 'COGNITO_USER_POOL_ID is required'),
  COGNITO_CLIENT_ID: z.string().min(1, 'COGNITO_CLIENT_ID is required'),
  COGNITO_CLIENT_SECRET: z.string().optional(),
  COGNITO_HOSTED_UI_DOMAIN: z.string().min(1, 'COGNITO_HOSTED_UI_DOMAIN is required'),

  // DynamoDB Tables
  USERS_TABLE: z.string().min(1, 'USERS_TABLE is required'),
  AUTH_IDENTITIES_TABLE: z.string().min(1, 'AUTH_IDENTITIES_TABLE is required'),
  AGENCY_CONFIG_TABLE: z.string().min(1, 'AGENCY_CONFIG_TABLE is required'),
  OTP_TABLE: z.string().min(1, 'OTP_TABLE is required'),
  SUBSCRIPTIONS_TABLE: z.string().min(1).default('Subscriptions'),

  // CORS - allowed origins for auth service.
  // capacitor://localhost (iOS WKWebView) and https://localhost (Android, per
  // server.androidScheme in capacitor.config.ts) are appended unconditionally:
  // they are fixed platform constants, and if they are missing the mobile app
  // cannot reach /auth/refresh at all, which logs every user out hourly.
  // Entries are trimmed so a spaced-out env value like "a, b" still matches.
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:5173')
    .transform(s => [
      ...new Set([
        ...s.split(',').map(o => o.trim()).filter(Boolean),
        'capacitor://localhost',
        'https://localhost',
      ]),
    ]),

  // Internal API key for service-to-service auth
  INTERNAL_API_KEY: z.string().min(1, 'INTERNAL_API_KEY is required'),

  // Invite emails. Optional: if AWS_SES_FROM_EMAIL is unset, invite creation
  // still succeeds (email send is best-effort, see inviteController.ts) —
  // the invite record itself, not the email, is the source of truth.
  AWS_SES_FROM_EMAIL: z.string().optional(),
  FRONTEND_LOGIN_URL: z.string().default('https://app.realestateflow.in/login'),

  // Local dev
  PORT: z.string().default('3002').transform(Number),
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

export function getConfig(): EnvConfig {
  if (!_config) {
    return loadConfig();
  }
  return _config;
}
