# =============================================================================
# Shared CFN parameter computation — reality-flow-authentication
# =============================================================================
# Single source of truth for "what CFN parameter values does the currently
# loaded .env.$ENV produce". Sourced by both infra/deploy.sh (full deploy)
# and infra/config-deploy.sh (config-only deploy) so the two paths can never
# drift apart on how a given env var maps to a given CFN parameter.
#
# Requires the caller to have already done `set -a; source .env.$ENV; set +a`
# and set ENV to the CLI-argument-driven value (not whatever the env file
# itself says) before calling compute_param_values.
#
# Populates two globals:
#   PARAM_KEYS     — ordered indexed array of every parameter name, so
#                    callers that need a stable order (e.g. cfn-params.json)
#                    can rely on it.
#   PARAM_VALUES   — associative array, PARAM_VALUES[<Key>] = <value>.
#
# compute_param_values <ApiGatewayRoutesTemplateUrl>
#   The nested-routes-template URL is the one value this file cannot compute
#   on its own — it depends on a fresh S3 upload of auth-explicit-routes.yaml
#   that only a full deploy performs. Pass it in; config-deploy.sh calls this
#   with an empty string since ApiGatewayRoutesTemplateUrl is never on the
#   config-only-safe allowlist and always falls back to the live stack's
#   current value regardless of what's passed here.
#
# validate_custom_domain_vars — fails (exit 1) unless AUTH_API_DOMAIN_NAME is a
# bare custom domain host (non-empty, no scheme, not a raw API Gateway
# execute-api / amazonaws.com host) and AUTH_API_BASE_PATH is non-empty. This
# API is only ever reached via https://<AUTH_API_DOMAIN_NAME>/<AUTH_API_BASE_PATH>
# — see the repo-wide custom-domain contract. Called by both deploy.sh and
# config-deploy.sh right after the env file is loaded.
validate_custom_domain_vars() {
  local domain="${AUTH_API_DOMAIN_NAME:-}"
  local base_path="${AUTH_API_BASE_PATH:-}"
  if [ -z "$domain" ]; then
    echo "ERROR: AUTH_API_DOMAIN_NAME is empty — set it to the API Gateway custom domain (e.g. services-api.cloudberrysolutions.in)"
    exit 1
  fi
  if [[ "$domain" == *"://"* ]]; then
    echo "ERROR: AUTH_API_DOMAIN_NAME ('$domain') must be a bare host name, not a URL (no scheme)"
    exit 1
  fi
  if [[ "$domain" == *execute-api* ]] || [[ "$domain" == *amazonaws.com* ]]; then
    echo "ERROR: AUTH_API_DOMAIN_NAME ('$domain') is a raw API Gateway host — raw API Gateway URLs are not allowed; use the custom domain"
    exit 1
  fi
  if [ -z "$base_path" ]; then
    echo "ERROR: AUTH_API_BASE_PATH is empty — set it (devrealestateauth for dev, prodrealestateauth for prod)"
    exit 1
  fi
}

compute_param_values() {
  local template_url="${1:-}"

  PARAM_KEYS=(
    ServiceName
    Env
    LambdaMemorySize
    LambdaTimeout
    LogRetentionInDays
    SubnetIds
    SecurityGroupIds
    LambdaPackagesBucketName
    DatabaseHost
    DatabasePort
    DatabaseName
    DatabaseUsername
    DatabasePassword
    DomainName
    AuthApiDomainName
    AuthApiBasePath
    EnableCustomDomainMapping
    EnableBasePathStrip
    GoogleClientId
    GoogleClientSecret
    CognitoDomainPrefixV2
    IdentityCallbackURL
    IdentityLogoutURL
    TestOtpEnabled
    TestOtpValue
    ApiGatewayRoutesTemplateUrl
    InternalApiKey
    AllowedOrigins
    SubscriptionsTableName
    AgencyConfigTableName
    ServerStackName
    AwsSesFromEmail
    FrontendLoginUrl
  )

  declare -gA PARAM_VALUES=(
    [ServiceName]="${SERVICE_NAME}"
    [Env]="${ENV}"
    [LambdaMemorySize]="${LAMBDA_MEMORY_SIZE:-256}"
    [LambdaTimeout]="${LAMBDA_TIMEOUT:-30}"
    [LogRetentionInDays]="${LOG_RETENTION_IN_DAYS:-14}"
    [SubnetIds]="${SUBNET_IDS:-}"
    [SecurityGroupIds]="${SECURITY_GROUP_IDS:-}"
    [LambdaPackagesBucketName]="${LAMBDA_PACKAGES_BUCKET_NAME}"
    [DatabaseHost]=""
    [DatabasePort]=""
    [DatabaseName]=""
    [DatabaseUsername]=""
    [DatabasePassword]=""
    [DomainName]="${DOMAIN_NAME:-}"
    [AuthApiDomainName]="${AUTH_API_DOMAIN_NAME:-}"
    [AuthApiBasePath]="${AUTH_API_BASE_PATH:-}"
    [EnableCustomDomainMapping]="${ENABLE_CUSTOM_DOMAIN_MAPPING:-false}"
    [EnableBasePathStrip]="${ENABLE_BASE_PATH_STRIP:-false}"
    [GoogleClientId]="${GOOGLE_CLIENT_ID}"
    [GoogleClientSecret]="${GOOGLE_CLIENT_SECRET}"
    [CognitoDomainPrefixV2]="${COGNITO_DOMAIN_PREFIX_V2}"
    [IdentityCallbackURL]="${IDENTITY_CALLBACK_URL}"
    [IdentityLogoutURL]="${IDENTITY_LOGOUT_URL}"
    [TestOtpEnabled]="${TEST_OTP_ENABLED:-false}"
    [TestOtpValue]="${TEST_OTP_VALUE:-123456}"
    [ApiGatewayRoutesTemplateUrl]="${template_url}"
    [InternalApiKey]="${INTERNAL_API_KEY:-}"
    [AllowedOrigins]="${ALLOWED_ORIGINS:-http://localhost:3000,http://localhost:5173}"
    [SubscriptionsTableName]="${SUBSCRIPTIONS_TABLE:-${ENV}-realestateflow-subscriptions}"
    [AgencyConfigTableName]="${AGENCY_CONFIG_TABLE:-${ENV}-realestateflow-agencies}"
    [ServerStackName]="${SERVER_STACK_NAME:-}"
    [AwsSesFromEmail]="${AWS_SES_FROM_EMAIL:-}"
    [FrontendLoginUrl]="${FRONTEND_LOGIN_URL:-https://app.realestateflow.in/login}"
  )
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
