// =============================================================================
// Shared cfn-params.json generator — ai-calling-service
// =============================================================================
// Single source of truth for "what does .env.$ENV produce as CFN parameter
// values" — invoked by both infra/deploy.sh (full deploy) and
// infra/config-deploy.sh (config-only deploy) so the two paths can't
// hand-maintain two copies of this mapping and drift apart. Pure extraction
// of the object literal that used to live inline in infra/deploy.sh — same
// keys, same defaults, same order.
//
// Usage: node generate-cfn-params.js <out-file> <environmentName> <s3Key>
//   <environmentName> and <s3Key> are passed explicitly because neither is
//   an exported env var the parent shell can just leave in process.env:
//   ENVIRONMENT_NAME is assigned from the CLI arg outside `set -a`, and
//   S3_KEY is computed after sourcing .env, timestamped, and only ever
//   known to a full deploy. config-deploy.sh calls this with an empty
//   string for <s3Key> — LambdaCodeS3Key is never on the config-only-safe
//   allowlist and always falls back to the live stack's current value
//   regardless of what's written here.
import fs from 'fs';

const [, , outFile, environmentName, s3Key] = process.argv;
const e = process.env;

const params = {
  EnvironmentName: environmentName,
  LambdaRuntime: e.LAMBDA_RUNTIME || 'nodejs20.x',
  LambdaMemorySize: e.LAMBDA_MEMORY_SIZE || '512',
  LambdaTimeout: e.LAMBDA_TIMEOUT || '30',
  LambdaCodeS3Bucket: e.ARTIFACT_BUCKET,
  LambdaCodeS3Key: s3Key || '',
  AICallingTableName: e.AI_CALLING_TABLE_NAME,
  AICallingKnowledgeBucket: e.AI_CALLING_KNOWLEDGE_BUCKET,
  AICallingRecordingsBucket: e.AI_CALLING_RECORDINGS_BUCKET,
  CrmInternalApiDomainName: e.CRM_INTERNAL_API_DOMAIN_NAME,
  CrmInternalApiBasePath: e.CRM_INTERNAL_API_BASE_PATH,
  CrmInternalApiKey: e.CRM_INTERNAL_API_KEY,
  ExotelSubdomain: e.EXOTEL_SUBDOMAIN || 'api.exotel.com',
  ExotelApiKey: e.EXOTEL_API_KEY,
  ExotelApiToken: e.EXOTEL_API_TOKEN,
  ExotelSid: e.EXOTEL_SID,
  ExotelCallerId: e.EXOTEL_CALLER_ID || '',
  ExotelWebhookIps: e.EXOTEL_WEBHOOK_IPS || '',
  ElevenLabsApiKey: e.ELEVENLABS_API_KEY,
  ElevenLabsAgentId: e.ELEVENLABS_AGENT_ID,
  ElevenLabsAgentPhoneNumberId: e.ELEVENLABS_AGENT_PHONE_NUMBER_ID || '',
  ElevenLabsWebhookSecret: e.ELEVENLABS_WEBHOOK_SECRET,
  ServerToolApiKey: e.SERVER_TOOL_API_KEY,
  CrmCallerApiKey: e.CRM_CALLER_API_KEY,
  ApiStageName: e.API_STAGE_NAME || 'v1',
  AllowedOrigins: e.ALLOWED_ORIGINS,
  AiCallingApiDomainName: e.AI_CALLING_API_DOMAIN_NAME,
  AiCallingApiBasePath: e.AI_CALLING_API_BASE_PATH,
  EnableCustomDomainMapping: e.ENABLE_CUSTOM_DOMAIN_MAPPING || 'false',
  EnableBasePathStrip: e.ENABLE_BASE_PATH_STRIP || 'false',
  LogLevel: e.LOG_LEVEL || 'info',
  LogRetentionDays: e.LOG_RETENTION_DAYS || '30',
  RecordingRetentionDays: e.RECORDING_RETENTION_DAYS || '90',
};

const out = Object.entries(params).map(([ParameterKey, ParameterValue]) => ({
  ParameterKey,
  ParameterValue: String(ParameterValue),
}));
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
try { fs.chmodSync(outFile, 0o600); } catch { /* best-effort, e.g. unsupported on Windows */ }
