// =============================================================================
// Shared cfn-params.json generator — followup-agent-service
// =============================================================================
// Single source of truth for "what does .env.$ENV produce as CFN parameter
// values" — invoked by both infra/deploy.sh (full deploy) and
// infra/config-deploy.sh (config-only deploy) so the two paths cannot drift.
//
// Usage: node generate-cfn-params.js <out-file> <environmentName> <s3Key>
//   config-deploy.sh calls this with an empty <s3Key>; LambdaCodeS3Key is
//   never on the config-only allowlist and always carries forward the live
//   stack's value.
import fs from 'fs';

const [, , outFile, environmentName, s3Key] = process.argv;
const e = process.env;

const params = {
  EnvironmentName: environmentName,
  LambdaRuntime: e.LAMBDA_RUNTIME || 'nodejs20.x',
  LambdaMemorySize: e.LAMBDA_MEMORY_SIZE || '512',
  LambdaTimeout: e.LAMBDA_TIMEOUT || '30',
  WorkerTimeout: e.WORKER_TIMEOUT || '120',
  LambdaCodeS3Bucket: e.ARTIFACT_BUCKET,
  LambdaCodeS3Key: s3Key || '',
  FollowupTableName: e.FOLLOWUP_TABLE_NAME,
  CrmInternalApiDomainName: e.CRM_INTERNAL_API_DOMAIN_NAME,
  CrmInternalApiBasePath: e.CRM_INTERNAL_API_BASE_PATH,
  CrmInternalApiKey: e.CRM_INTERNAL_API_KEY,
  AiCallingServiceDomainName: e.AI_CALLING_SERVICE_DOMAIN_NAME,
  AiCallingServiceBasePath: e.AI_CALLING_SERVICE_BASE_PATH,
  AiCallingCallerApiKey: e.AI_CALLING_CALLER_API_KEY,
  CrmCallerApiKey: e.CRM_CALLER_API_KEY,
  ApiStageName: e.API_STAGE_NAME || 'v1',
  AllowedOrigins: e.ALLOWED_ORIGINS,
  FollowupApiDomainName: e.FOLLOWUP_API_DOMAIN_NAME,
  FollowupApiBasePath: e.FOLLOWUP_API_BASE_PATH,
  EnableCustomDomainMapping: e.ENABLE_CUSTOM_DOMAIN_MAPPING || 'false',
  EnableBasePathStrip: e.ENABLE_BASE_PATH_STRIP || 'false',
  DispatchScheduleExpression: e.DISPATCH_SCHEDULE_EXPRESSION || 'rate(5 minutes)',
  DefaultMaxAttempts: e.DEFAULT_MAX_ATTEMPTS || '2',
  DefaultRetryGapMinutes: e.DEFAULT_RETRY_GAP_MINUTES || '45',
  DefaultPostVisitDelayMinutes: e.DEFAULT_POST_VISIT_DELAY_MINUTES || '120',
  DefaultBusinessHoursStart: e.DEFAULT_BUSINESS_HOURS_START || '10:00',
  DefaultBusinessHoursEnd: e.DEFAULT_BUSINESS_HOURS_END || '19:00',
  DefaultTimezone: e.DEFAULT_TIMEZONE || 'Asia/Kolkata',
  CallWatchdogMinutes: e.CALL_WATCHDOG_MINUTES || '20',
  AlertsTopicArn: e.ALERTS_TOPIC_ARN || '',
  LogLevel: e.LOG_LEVEL || 'info',
  LogRetentionDays: e.LOG_RETENTION_DAYS || '30',
};

const out = Object.entries(params).map(([ParameterKey, ParameterValue]) => ({
  ParameterKey,
  ParameterValue: String(ParameterValue ?? ''),
}));
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
try { fs.chmodSync(outFile, 0o600); } catch { /* best-effort, e.g. unsupported on Windows */ }
