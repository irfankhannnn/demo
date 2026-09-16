# =============================================================================
# Shared cfn-params.json generator — server
# =============================================================================
# Single source of truth for "what does .env.$ENV produce as CFN parameter
# values" — sourced by both infra/deploy.sh (full deploy) and
# infra/config-deploy.sh (config-only deploy) so the two paths can never
# hand-maintain two copies of this ~120-key mapping and drift apart.
#
# Requires the caller to have already loaded .env.$ENV (set -a; source; set
# +a) and set ENVIRONMENT_NAME to the CLI-argument-driven value. The three
# deploy-mechanics values below are NOT derivable from .env — pass them in
# (a full deploy computes real ones after uploading fresh artifacts; a
# config-only deploy passes empty strings, since none of these three keys
# are ever synced to SSM or otherwise consulted by config-deploy.sh's own
# logic — see that script's EXCLUDE_FROM_DIFF set):
#   $1 = S3_KEY (LambdaCodeS3Key's value; empty means "parameter omitted")
#   $2 = TEMPLATE_URL (ApiGatewayRoutesTemplateUrl)
#   $3 = TEMPLATE_URL_PART2 (ApiGatewayRoutesTemplateUrlPart2)
#   $4 = DEPLOY_API_ROUTE_PART2 (DeployApiRoutePart2; defaults to "true")
#
# write_cfn_params_json <out-file> writes infra/cfn-params.json exactly as
# before this was extracted from deploy.sh — same keys, same defaults, same
# order — this is a pure extraction, not a behavior change.
write_cfn_params_json() {
  local out_file="$1"
  local s3_key="${2:-}"
  local template_url="${3:-}"
  local template_url_part2="${4:-}"
  local deploy_api_route_part2="${5:-true}"

  local lambda_code_parameter_json=''
  if [ -n "$s3_key" ]; then
    lambda_code_parameter_json='  { "ParameterKey": "LambdaCodeS3Key", "ParameterValue": "'"${s3_key}"'" },'
  fi

  cat > "$out_file" <<EOF
[
  { "ParameterKey": "EnvironmentName", "ParameterValue": "${ENVIRONMENT_NAME}" },
  { "ParameterKey": "LambdaRuntime", "ParameterValue": "${LAMBDA_RUNTIME}" },
  { "ParameterKey": "LambdaMemorySize", "ParameterValue": "${LAMBDA_MEMORY_SIZE}" },
  { "ParameterKey": "LambdaTimeout", "ParameterValue": "${LAMBDA_TIMEOUT}" },
  { "ParameterKey": "DynamoDbTableName", "ParameterValue": "${DYNAMODB_TABLE_NAME}" },
  { "ParameterKey": "CrmDynamoDbTableName", "ParameterValue": "${CRM_DYNAMODB_TABLE_NAME}" },
  { "ParameterKey": "AgencyConfigTableName", "ParameterValue": "${AGENCY_CONFIG_DYNAMODB_TABLE_NAME}" },
  { "ParameterKey": "KnowledgeChunksTableName", "ParameterValue": "${KNOWLEDGE_CHUNKS_DYNAMODB_TABLE_NAME}" },
  { "ParameterKey": "EnquiriesTableNameCloudberry", "ParameterValue": "${ENQUIRIES_DYNAMODB_TABLE_NAME}" },
  { "ParameterKey": "AreasTableName", "ParameterValue": "${AREAS_DYNAMODB_TABLE_NAME}" },
  { "ParameterKey": "B2BLeadsTableName", "ParameterValue": "${B2B_LEADS_TABLE}" },
  { "ParameterKey": "KhataTableName", "ParameterValue": "${KHATA_TABLE_NAME}" },
  { "ParameterKey": "NotificationsTableName", "ParameterValue": "${NOTIFICATIONS_TABLE_NAME}" },
  { "ParameterKey": "DevelopersTableName", "ParameterValue": "${DEVELOPERS_TABLE_NAME}" },
  { "ParameterKey": "RealEstateAreasTableName", "ParameterValue": "${REAL_ESTATE_AREAS_TABLE_NAME}" },
  { "ParameterKey": "ProjectsTableName", "ParameterValue": "${PROJECTS_TABLE_NAME}" },
  { "ParameterKey": "PushTokensTableName", "ParameterValue": "${PUSH_TOKENS_TABLE:-${ENVIRONMENT_NAME}-realestateflow-push-tokens}" },
  { "ParameterKey": "UserCategoriesTableName", "ParameterValue": "${USER_CATEGORIES_TABLE_NAME:-${ENVIRONMENT_NAME}-realestateflow-user-categories}" },
  { "ParameterKey": "GrievancesTableName", "ParameterValue": "${GRIEVANCES_TABLE_NAME:-${ENVIRONMENT_NAME}-realestateflow-grievances}" },
  { "ParameterKey": "NpsResponsesTableName", "ParameterValue": "${NPS_TABLE:-${ENVIRONMENT_NAME}-realestateflow-nps-responses}" },
  { "ParameterKey": "SubscriptionsTableName", "ParameterValue": "${SUBSCRIPTIONS_TABLE:-${ENVIRONMENT_NAME}-realestateflow-subscriptions}" },
  { "ParameterKey": "WebhookLogTableName", "ParameterValue": "${WEBHOOK_LOG_TABLE:-${ENVIRONMENT_NAME}-realestateflow-webhook-log}" },
  { "ParameterKey": "TenantApiKeysTableName", "ParameterValue": "${TENANT_API_KEYS_TABLE:-${ENVIRONMENT_NAME}-realestateflow-tenant-api-keys}" },
  { "ParameterKey": "S3BucketName", "ParameterValue": "${S3_BUCKET_NAME}" },
  { "ParameterKey": "LambdaCodeS3Bucket", "ParameterValue": "${ARTIFACT_BUCKET}" },
${lambda_code_parameter_json}
  { "ParameterKey": "PublicApiDomainName", "ParameterValue": "${PUBLIC_API_DOMAIN_NAME}" },
  { "ParameterKey": "PublicApiBasePath", "ParameterValue": "${PUBLIC_API_BASE_PATH}" },
  { "ParameterKey": "PublicApiStageName", "ParameterValue": "${PUBLIC_API_STAGE_NAME}" },
  { "ParameterKey": "CrmApiDomainName", "ParameterValue": "${CRM_API_DOMAIN_NAME}" },
  { "ParameterKey": "CrmApiBasePath", "ParameterValue": "${CRM_API_BASE_PATH}" },
  { "ParameterKey": "CrmApiStageName", "ParameterValue": "${CRM_API_STAGE_NAME}" },
  { "ParameterKey": "EnableCustomDomainMapping", "ParameterValue": "${ENABLE_CUSTOM_DOMAIN_MAPPING:-true}" },
  { "ParameterKey": "EnableBasePathStrip", "ParameterValue": "${ENABLE_BASE_PATH_STRIP:-false}" },
  { "ParameterKey": "AuthServiceDomainName", "ParameterValue": "${AUTH_SERVICE_DOMAIN_NAME}" },
  { "ParameterKey": "AuthServiceBasePath", "ParameterValue": "${AUTH_SERVICE_BASE_PATH}" },
  { "ParameterKey": "AllowedOrigins", "ParameterValue": "${ALLOWED_ORIGINS}" },
  { "ParameterKey": "NpsHmacSecret", "ParameterValue": "${NPS_HMAC_SECRET}" },
  { "ParameterKey": "BrevoApiKey", "ParameterValue": "${BREVO_API_KEY}" },
  { "ParameterKey": "RazorpayWebhookSecret", "ParameterValue": "${RAZORPAY_WEBHOOK_SECRET}" },
  { "ParameterKey": "RazorpayKeyId", "ParameterValue": "${RAZORPAY_KEY_ID}" },
  { "ParameterKey": "RazorpayKeySecret", "ParameterValue": "${RAZORPAY_KEY_SECRET}" },
  { "ParameterKey": "BrevoFromEmail", "ParameterValue": "${BREVO_FROM_EMAIL}" },
  { "ParameterKey": "BrevoFromName", "ParameterValue": "${BREVO_FROM_NAME}" },
  { "ParameterKey": "HcaptchaSecretKey", "ParameterValue": "${HCAPTCHA_SECRET_KEY}" },
  { "ParameterKey": "CreditsTableName", "ParameterValue": "${CREDITS_TABLE_NAME}" },
  { "ParameterKey": "CreditConfigTableName", "ParameterValue": "${CREDIT_CONFIG_TABLE_NAME}" },
  { "ParameterKey": "SesFromEmail", "ParameterValue": "${AWS_SES_FROM_EMAIL}" },
  { "ParameterKey": "EmailProviderPrimary", "ParameterValue": "${EMAIL_PROVIDER_PRIMARY}" },
  { "ParameterKey": "BaileyEnabled", "ParameterValue": "${BAILEY_ENABLED}" },
  { "ParameterKey": "BaileyApiKey", "ParameterValue": "${BAILEY_API_KEY}" },
  { "ParameterKey": "BaileyMode", "ParameterValue": "${BAILEY_MODE:-hosted}" },
  { "ParameterKey": "BaileyWebhookSecret", "ParameterValue": "${BAILEY_WEBHOOK_SECRET}" },
  { "ParameterKey": "AgentsEnabled", "ParameterValue": "${AGENTS_ENABLED:-false}" },
  { "ParameterKey": "AllowUserCategoryDefaultFallback", "ParameterValue": "${ALLOW_USER_CATEGORY_DEFAULT_FALLBACK:-false}" },
  { "ParameterKey": "BaileyApiEndpoint", "ParameterValue": "${BAILEY_API_ENDPOINT:-https://api.bailey.ai}" },
  { "ParameterKey": "BaileyApiPrefix", "ParameterValue": "${BAILEY_API_PREFIX:-}" },
  { "ParameterKey": "PostHogKeyServer", "ParameterValue": "${POSTHOG_KEY_SERVER:-}" },
  { "ParameterKey": "PostHogHost", "ParameterValue": "${POSTHOG_HOST:-https://eu.i.posthog.com}" },
  { "ParameterKey": "InternalApiKey", "ParameterValue": "${INTERNAL_API_KEY:-}" },
  { "ParameterKey": "AiCallingInternalApiKey", "ParameterValue": "${AI_CALLING_INTERNAL_API_KEY:-}" },
  { "ParameterKey": "AdapterInternalApiKey", "ParameterValue": "${ADAPTER_INTERNAL_API_KEY:-}" },
  { "ParameterKey": "PublicPagesInternalApiKey", "ParameterValue": "${PUBLIC_PAGES_INTERNAL_API_KEY:-}" },
  { "ParameterKey": "AiCallingServiceDomainName", "ParameterValue": "${AI_CALLING_SERVICE_DOMAIN_NAME:-}" },
  { "ParameterKey": "AiCallingServiceBasePath", "ParameterValue": "${AI_CALLING_SERVICE_BASE_PATH:-}" },
  { "ParameterKey": "CrmCallerApiKey", "ParameterValue": "${CRM_CALLER_API_KEY:-}" },
  { "ParameterKey": "FollowupServiceDomainName", "ParameterValue": "${FOLLOWUP_SERVICE_DOMAIN_NAME:-}" },
  { "ParameterKey": "FollowupServiceBasePath", "ParameterValue": "${FOLLOWUP_SERVICE_BASE_PATH:-}" },
  { "ParameterKey": "FollowupCallerApiKey", "ParameterValue": "${FOLLOWUP_CALLER_API_KEY:-}" },
  { "ParameterKey": "FollowupInternalApiKey", "ParameterValue": "${FOLLOWUP_INTERNAL_API_KEY:-}" },
  { "ParameterKey": "FounderWhatsApp", "ParameterValue": "${FOUNDER_WHATSAPP:-}" },
  { "ParameterKey": "AgentAuditTableName", "ParameterValue": "${AGENT_AUDIT_TABLE_NAME:-cloudberry-real-estate-agent-audit}" },
  { "ParameterKey": "JwtSecret", "ParameterValue": "${JWT_SECRET:-}" },
  { "ParameterKey": "AgentActionCredits", "ParameterValue": "${AGENT_ACTION_CREDITS:-15}" },
  { "ParameterKey": "AiEmployeeRolloutPercentage", "ParameterValue": "${AI_EMPLOYEE_ROLLOUT_PERCENTAGE:-100}" },
  { "ParameterKey": "AiEmployeeProvisioningTableName", "ParameterValue": "${AI_EMPLOYEE_PROVISIONING_TABLE:-AIEmployeeProvisioning}" },
  { "ParameterKey": "LlmProvider", "ParameterValue": "${LLM_PROVIDER:-bedrock}" },
  { "ParameterKey": "BedrockModelId", "ParameterValue": "${BEDROCK_MODEL_ID:-anthropic.claude-3-haiku-20240307-v1:0}" },
  { "ParameterKey": "GeminiApiKey", "ParameterValue": "${GEMINI_API_KEY:-}" },
  { "ParameterKey": "GeminiModel", "ParameterValue": "${GEMINI_MODEL:-gemini-3.8-flash}" },
  { "ParameterKey": "GeminiClassifierModel", "ParameterValue": "${GEMINI_CLASSIFIER_MODEL:-gemini-3.1-flash-lite}" },
  { "ParameterKey": "CloudwatchMetricsEnabled", "ParameterValue": "${CLOUDWATCH_METRICS_ENABLED:-true}" },
  { "ParameterKey": "AiAdminWhatsAppNumbers", "ParameterValue": "${AI_ADMIN_WHATSAPP_NUMBERS:-}" },
  { "ParameterKey": "ApiGatewayRoutesTemplateUrl", "ParameterValue": "${template_url}" },
  { "ParameterKey": "ApiGatewayRoutesTemplateUrlPart2", "ParameterValue": "${template_url_part2}" },
  { "ParameterKey": "DeployApiRoutePart2", "ParameterValue": "${deploy_api_route_part2}" },
  { "ParameterKey": "ServiceAccountUser", "ParameterValue": "${SERVICE_ACCOUNT_USER:-system}" },
  { "ParameterKey": "DefaultCountryCode", "ParameterValue": "${DEFAULT_COUNTRY_CODE:-+91}" },
  { "ParameterKey": "AppUrl", "ParameterValue": "${APP_URL:-https://app.realestateflow.in}" },
  { "ParameterKey": "GrievanceOfficerEmail", "ParameterValue": "${GRIEVANCE_OFFICER_EMAIL:-info@realestateflow.in}" },
  { "ParameterKey": "LogLevel", "ParameterValue": "${LOG_LEVEL:-info}" },
  { "ParameterKey": "McpApiDomainName", "ParameterValue": "${MCP_API_DOMAIN_NAME:-}" },
  { "ParameterKey": "McpApiBasePath", "ParameterValue": "${MCP_API_BASE_PATH:-}" },
  { "ParameterKey": "OAuthCodesTableName", "ParameterValue": "${OAUTH_CODES_TABLE_NAME:-realestate-flow-${ENVIRONMENT_NAME}-oauth-codes}" },
  { "ParameterKey": "OAuthConnectionsTableName", "ParameterValue": "${OAUTH_CONNECTIONS_TABLE:-realestate-flow-${ENVIRONMENT_NAME}-oauth-connections}" },
  { "ParameterKey": "OAuthCallbackUrl", "ParameterValue": "${OAUTH_CALLBACK_URL:-https://services-api.cloudberrysolutions.in/devrealestatecrm/api/ai-integrations/callback}" },
  { "ParameterKey": "FrontendUrl", "ParameterValue": "${FRONTEND_URL:-http://localhost:3000}" },
  { "ParameterKey": "FounderEmail", "ParameterValue": "${FOUNDER_EMAIL:-info@realestateflow.in}" },
  { "ParameterKey": "BrevoTrialListId", "ParameterValue": "${BREVO_TRIAL_LIST_ID:-}" },
  { "ParameterKey": "BrevoPaymentFailedTemplateId", "ParameterValue": "${BREVO_PAYMENT_FAILED_TEMPLATE_ID:-}" },
  { "ParameterKey": "BrevoAiEmployeePaidTemplateId", "ParameterValue": "${BREVO_AI_EMPLOYEE_PAID_TEMPLATE_ID:-}" },
  { "ParameterKey": "BrevoAiEmployeeEscalatedFounderTemplateId", "ParameterValue": "${BREVO_AI_EMPLOYEE_ESCALATED_FOUNDER_TEMPLATE_ID:-}" },
  { "ParameterKey": "BrevoAiEmployeeEscalatedCustomerTemplateId", "ParameterValue": "${BREVO_AI_EMPLOYEE_ESCALATED_CUSTOMER_TEMPLATE_ID:-}" },
  { "ParameterKey": "BaileyAdminApiKey", "ParameterValue": "${BAILEY_ADMIN_API_KEY:-}" },
  { "ParameterKey": "AsrProvider", "ParameterValue": "${ASR_PROVIDER:-amazon-transcribe}" },
  { "ParameterKey": "TranscribeLanguageOptions", "ParameterValue": "${TRANSCRIBE_LANGUAGE_OPTIONS:-en-IN,hi-IN,mr-IN,gu-IN,ta-IN,te-IN,kn-IN,ml-IN,pa-IN,bn-IN}" },
  { "ParameterKey": "TranscribeLanguageCode", "ParameterValue": "${TRANSCRIBE_LANGUAGE_CODE:-}" },
  { "ParameterKey": "TranscribeVocabularyName", "ParameterValue": "${TRANSCRIBE_VOCABULARY_NAME:-}" },
  { "ParameterKey": "CallIntelAutoApplyNotes", "ParameterValue": "${CALL_INTEL_AUTO_APPLY_NOTES:-true}" },
  { "ParameterKey": "CallIntelWorkerMemorySize", "ParameterValue": "${CALL_INTEL_WORKER_MEMORY_SIZE:-1024}" },
  { "ParameterKey": "CallIntelWorkerTimeout", "ParameterValue": "${CALL_INTEL_WORKER_TIMEOUT:-300}" },
  { "ParameterKey": "CallIntelPollDelaySeconds", "ParameterValue": "${CALL_INTEL_POLL_DELAY_SECONDS:-45}" },
  { "ParameterKey": "CallIntelMaxPollAttempts", "ParameterValue": "${CALL_INTEL_MAX_POLL_ATTEMPTS:-60}" },
  { "ParameterKey": "CallRecordingQueueRetentionSeconds", "ParameterValue": "${CALL_RECORDING_QUEUE_RETENTION_SECONDS:-345600}" },
  { "ParameterKey": "CallIntelMaxStageAttempts", "ParameterValue": "${CALL_INTEL_MAX_STAGE_ATTEMPTS:-4}" },
  { "ParameterKey": "CallIntelMaxTranscriptChars", "ParameterValue": "${CALL_INTEL_MAX_TRANSCRIPT_CHARS:-60000}" },
  { "ParameterKey": "CallIntelDefaultMeetingTime", "ParameterValue": "${CALL_INTEL_DEFAULT_MEETING_TIME:-11:00}" },
  { "ParameterKey": "CallIntelMaxUploadBytes", "ParameterValue": "${CALL_INTEL_MAX_UPLOAD_BYTES:-209715200}" },
  { "ParameterKey": "CallIntelUploadUrlTtlSeconds", "ParameterValue": "${CALL_INTEL_UPLOAD_URL_TTL_SECONDS:-900}" },
  { "ParameterKey": "CallIntelPlaybackUrlTtlSeconds", "ParameterValue": "${CALL_INTEL_PLAYBACK_URL_TTL_SECONDS:-3600}" },
  { "ParameterKey": "AgentToolLoopEnabled", "ParameterValue": "${AGENT_TOOL_LOOP_ENABLED:-false}" },
  { "ParameterKey": "AgentWebToolLoopBudgetMs", "ParameterValue": "${AGENT_WEB_TOOL_LOOP_BUDGET_MS:-18000}" },
  { "ParameterKey": "CallIntelStalledAnalysisMs", "ParameterValue": "${CALL_INTEL_STALLED_ANALYSIS_MS:-900000}" },
  { "ParameterKey": "CloudWatchNamespace", "ParameterValue": "${CLOUDWATCH_NAMESPACE:-RealEstateFlow/MVP}" },
  { "ParameterKey": "FirebaseServiceAccountJson", "ParameterValue": "${FIREBASE_SERVICE_ACCOUNT_JSON:-}" },
  { "ParameterKey": "RazorpayPlanAiEmployee", "ParameterValue": "${RAZORPAY_PLAN_AI_EMPLOYEE:-plan_test_ai_employee}" },
  { "ParameterKey": "ToolLogMaxResultChars", "ParameterValue": "${TOOL_LOG_MAX_RESULT_CHARS:-2000}" },
  { "ParameterKey": "WhatsAppFallbackCategory", "ParameterValue": "${WHATSAPP_FALLBACK_CATEGORY:-admin}" }
]
EOF
}
