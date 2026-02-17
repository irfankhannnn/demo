import { z } from 'zod';

const envSchema = z.object({
  // AWS
  AWS_REGION: z.string().default('ap-south-1'),

  // Service
  SERVICE_NAME: z.string().default('reality-flow-auth'),
  ENV: z.enum(['dev', 'test', 'prod']).default('dev'),

  // Cognito
  COGNITO_USER_POOL_ID: z.string().min(1, 'COGNITO_USER_POOL_ID is required'),
  COGNITO_CLIENT_ID: z.string().min(1, 'COGNITO_CLIENT_ID is required'),
  COGNITO_CLIENT_SECRET: z.string().optional(),
  COGNITO_HOSTED_UI_DOMAIN: z.string().min(1, 'COGNITO_HOSTED_UI_DOMAIN is required'),

  // DynamoDB Tables
  USERS_TABLE: z.string().min(1, 'USERS_TABLE is required'),
  AGENCY_CONFIG_TABLE: z.string().min(1, 'AGENCY_CONFIG_TABLE is required'),

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
