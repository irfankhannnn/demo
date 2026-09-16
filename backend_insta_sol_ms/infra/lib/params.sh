# =============================================================================
# Shared CFN parameter computation — backend_insta_sol_ms
# =============================================================================
# Single source of truth for "what CFN parameter values does the currently
# loaded .env.$ENVIRONMENT_NAME produce". Sourced by both infra/deploy.sh
# (full deploy) and infra/config-deploy.sh (config-only deploy).
#
# Requires the caller to have already done `set -a; source .env.$ENV; set +a`
# and set ENVIRONMENT_NAME to the CLI-argument-driven value.
#
# compute_param_values <S3Key>
#   LambdaCodeS3Key is the one value this file cannot compute on its own —
#   it's a fresh timestamped key only a real deploy's upload produces. Pass
#   it in; config-deploy.sh calls this with an empty string, since
#   LambdaCodeS3Key is never on the config-only-safe allowlist and always
#   falls back to the live stack's current value regardless of what's
#   passed here (see that script's ALWAYS_LIVE_PARAMS).
compute_param_values() {
  local s3_key="${1:-}"

  PARAM_KEYS=(
    EnvironmentName
    LambdaRuntime
    LambdaMemorySize
    LambdaTimeout
    LambdaCodeS3Bucket
    LambdaCodeS3Key
    DataTableName
    AuditTableName
    AuthServiceDomainName
    AuthServiceBasePath
    AllowedOrigins
    ApiStageName
    InstaApiDomainName
    InstaApiBasePath
    EnableCustomDomainMapping
    EnableBasePathStrip
    LogLevel
    LogRetentionDays
    KillSwitchEnabled
    CrmInternalApiDomainName
    CrmInternalApiBasePath
    AdapterInternalApiKey
    PromoteEnquiriesToLeads
    MetaAppId
    MetaAppSecret
    MetaWebhookVerifyToken
    TokenEncryptionKey
    InstaConsoleUrl
    GeminiApiKey
    LlmModel
    DryRunSends
    RulesEnabled
    WorkerScheduleExpression
    WorkerEnabled
  )

  declare -gA PARAM_VALUES=(
    [EnvironmentName]="${ENVIRONMENT_NAME}"
    [LambdaRuntime]="${LAMBDA_RUNTIME:-nodejs20.x}"
    [LambdaMemorySize]="${LAMBDA_MEMORY_SIZE:-512}"
    [LambdaTimeout]="${LAMBDA_TIMEOUT:-60}"
    [LambdaCodeS3Bucket]="${ARTIFACT_BUCKET}"
    [LambdaCodeS3Key]="${s3_key}"
    [DataTableName]="${INSTA_DATA_TABLE_NAME}"
    [AuditTableName]="${INSTA_AUDIT_TABLE_NAME}"
    [AuthServiceDomainName]="${AUTH_SERVICE_DOMAIN_NAME}"
    [AuthServiceBasePath]="${AUTH_SERVICE_BASE_PATH}"
    [AllowedOrigins]="${ALLOWED_ORIGINS}"
    [ApiStageName]="${API_STAGE_NAME:-v1}"
    [InstaApiDomainName]="${INSTA_API_DOMAIN_NAME:-}"
    [InstaApiBasePath]="${INSTA_API_BASE_PATH:-insta}"
    [EnableCustomDomainMapping]="${ENABLE_CUSTOM_DOMAIN_MAPPING:-false}"
    [EnableBasePathStrip]="${ENABLE_BASE_PATH_STRIP:-false}"
    [LogLevel]="${LOG_LEVEL:-info}"
    [LogRetentionDays]="${LOG_RETENTION_DAYS:-30}"
    [KillSwitchEnabled]="${INSTA_KILL_SWITCH:-false}"
    [CrmInternalApiDomainName]="${CRM_INTERNAL_API_DOMAIN_NAME:-}"
    [CrmInternalApiBasePath]="${CRM_INTERNAL_API_BASE_PATH:-}"
    [AdapterInternalApiKey]="${ADAPTER_INTERNAL_API_KEY:-}"
    [PromoteEnquiriesToLeads]="${INSTA_PROMOTE_ENQUIRIES_TO_LEADS:-true}"
    [MetaAppId]="${META_APP_ID:-}"
    [MetaAppSecret]="${META_APP_SECRET:-}"
    [MetaWebhookVerifyToken]="${META_WEBHOOK_VERIFY_TOKEN:-}"
    [TokenEncryptionKey]="${INSTA_TOKEN_ENCRYPTION_KEY:-}"
    [InstaConsoleUrl]="${INSTA_CONSOLE_URL:-}"
    [GeminiApiKey]="${GEMINI_API_KEY:-}"
    [LlmModel]="${LLM_MODEL:-gemini-2.5-flash}"
    [DryRunSends]="${INSTA_DRY_RUN_SENDS:-true}"
    [RulesEnabled]="${INSTA_RULES_ENABLED:-true}"
    [WorkerScheduleExpression]="${INSTA_WORKER_SCHEDULE:-rate(2 minutes)}"
    [WorkerEnabled]="${INSTA_WORKER_ENABLED:-true}"
  )
}

# assert_custom_domain_vars — custom-domain contract guard, shared by
# deploy.sh and config-deploy.sh. Every API this service owns or calls is
# reached as https://<DOMAIN_NAME>/<BASE_PATH>; a raw API Gateway invoke URL
# (execute-api / amazonaws.com), a scheme, or an empty value fails the deploy
# before any AWS call is made. Prints every problem, then exits 1.
assert_custom_domain_vars() {
  local errors=0 var val
  for var in INSTA_API_DOMAIN_NAME AUTH_SERVICE_DOMAIN_NAME CRM_INTERNAL_API_DOMAIN_NAME; do
    val="${!var:-}"
    if [ -z "$val" ]; then
      echo "ERROR: $var is empty — set it to the API Gateway custom domain (e.g. services-api.cloudberrysolutions.in)"
      errors=$((errors + 1))
    elif [[ "$val" == *execute-api* || "$val" == *amazonaws.com* ]]; then
      echo "ERROR: $var ('$val') is a raw API Gateway host — use the custom domain instead"
      errors=$((errors + 1))
    elif [[ "$val" == *"://"* ]]; then
      echo "ERROR: $var ('$val') must be a bare hostname, without a scheme"
      errors=$((errors + 1))
    fi
  done
  for var in INSTA_API_BASE_PATH AUTH_SERVICE_BASE_PATH CRM_INTERNAL_API_BASE_PATH; do
    if [ -z "${!var:-}" ]; then
      echo "ERROR: $var is empty — set it to the base path mapping for this environment"
      errors=$((errors + 1))
    fi
  done
  if [ "$errors" -gt 0 ]; then
    exit 1
  fi
}

# assert_instagram_app_vars — the Instagram app settings a deployed stack
# cannot work without. Checked before any AWS call.
assert_instagram_app_vars() {
  local errors=0 var
  for var in META_APP_ID META_APP_SECRET META_WEBHOOK_VERIFY_TOKEN INSTA_CONSOLE_URL; do
    if [ -z "${!var:-}" ]; then
      echo "ERROR: $var is empty — see backend_insta_sol_ms/.env.sample"
      errors=$((errors + 1))
    fi
  done
  if ! [[ "${INSTA_TOKEN_ENCRYPTION_KEY:-}" =~ ^[0-9a-fA-F]{64}$ ]]; then
    echo "ERROR: INSTA_TOKEN_ENCRYPTION_KEY must be 64 hex characters (openssl rand -hex 32)"
    errors=$((errors + 1))
  fi
  if [ "$errors" -gt 0 ]; then
    exit 1
  fi
}

# write_cfn_params_json <out-file> — writes infra/cfn-params.json in the
# standard [{ParameterKey,ParameterValue}, ...] shape from PARAM_KEYS/VALUES.
write_cfn_params_json() {
  local out="$1"
  {
    echo "["
    local n=${#PARAM_KEYS[@]}
    local i=0
    for key in "${PARAM_KEYS[@]}"; do
      i=$((i + 1))
      local comma=","
      [ "$i" -eq "$n" ] && comma=""
      printf '  { "ParameterKey": "%s", "ParameterValue": %s }%s\n' \
        "$key" "$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "${PARAM_VALUES[$key]}")" "$comma"
    done
    echo "]"
  } > "$out"
}
