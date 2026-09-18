# =============================================================================
# Shared CFN parameter computation — marketplace-api
# =============================================================================
# Single source of truth for "what CFN parameter values does the currently
# loaded .env.$ENVIRONMENT_NAME produce". Sourced by both infra/deploy.sh
# (full deploy) and infra/config-deploy.sh (config-only deploy).
#
# Requires the caller to have already done `set -a; source .env.$ENV; set +a`
# and set ENVIRONMENT_NAME to the CLI-argument-driven value.
#
# compute_param_values <S3Key> — LambdaCodeS3Key is a fresh timestamped key
# only a real deploy's upload produces; config-deploy.sh calls this with an
# empty string, since that key is never on the config-only-safe allowlist
# and always falls back to the live stack's current value regardless.
compute_param_values() {
  local s3_key="${1:-}"

  PARAM_KEYS=(
    EnvironmentName
    LambdaRuntime
    LambdaMemorySize
    LambdaTimeout
    LambdaCodeS3Bucket
    LambdaCodeS3Key
    CrmInternalApiDomainName
    CrmInternalApiBasePath
    MarketplaceInternalApiKey
    CrmCallerApiKey
    AuthCallerApiKey
    CognitoUserPoolId
    CognitoRegion
    CognitoClientId
    ModelProvider
    GeminiApiKey
    GeminiModel
    BedrockModelId
    ModelTimeoutMs
    MarketplaceWebOrigin
    SesFromEmail
    ApiStageName
    EnableCloudFront
    MarketplaceApiDomainName
    MarketplaceApiBasePath
    EnableCustomDomainMapping
    EnableBasePathStrip
    CrmTimeoutMs
    LimitIpBurst
    LimitIpBurstWindowSeconds
    LimitIpHourly
    LimitIpBookingsDaily
    LimitPhoneBookingsDaily
    LimitTenantBookingsDaily
    LimitCaptchaTrigger
    LimitAiSearchAnonHourly
    LimitAiSearchUserHourly
    LimitBuyerWritesHourly
    HcaptchaSiteKey
    HcaptchaSecretKey
    MarketplaceSessionSecret
    ListingCacheSeconds
    CitiesCacheSeconds
    AssetCacheSeconds
    PublicCacheSeconds
    LogLevel
    LogRetentionDays
  )

  declare -gA PARAM_VALUES=(
    [EnvironmentName]="${ENVIRONMENT_NAME}"
    [LambdaRuntime]="${LAMBDA_RUNTIME:-nodejs20.x}"
    [LambdaMemorySize]="${LAMBDA_MEMORY_SIZE:-512}"
    [LambdaTimeout]="${LAMBDA_TIMEOUT:-25}"
    [LambdaCodeS3Bucket]="${ARTIFACT_BUCKET}"
    [LambdaCodeS3Key]="${s3_key}"
    [CrmInternalApiDomainName]="${CRM_INTERNAL_API_DOMAIN_NAME}"
    [CrmInternalApiBasePath]="${CRM_INTERNAL_API_BASE_PATH}"
    [MarketplaceInternalApiKey]="${MARKETPLACE_INTERNAL_API_KEY}"
    [CrmCallerApiKey]="${CRM_CALLER_API_KEY}"
    [AuthCallerApiKey]="${AUTH_CALLER_API_KEY}"
    [CognitoUserPoolId]="${COGNITO_USER_POOL_ID}"
    [CognitoRegion]="${COGNITO_REGION:-${AWS_REGION}}"
    [CognitoClientId]="${COGNITO_CLIENT_ID:-}"
    [ModelProvider]="${MODEL_PROVIDER:-gemini}"
    [GeminiApiKey]="${GEMINI_API_KEY:-}"
    [GeminiModel]="${GEMINI_MODEL:-gemini-2.0-flash}"
    [BedrockModelId]="${BEDROCK_MODEL_ID:-anthropic.claude-haiku-4-5-20251001-v1:0}"
    [ModelTimeoutMs]="${MODEL_TIMEOUT_MS:-8000}"
    [MarketplaceWebOrigin]="${MARKETPLACE_WEB_ORIGIN:-}"
    [SesFromEmail]="${SES_FROM_EMAIL:-}"
    [ApiStageName]="${API_STAGE_NAME:-v1}"
    [EnableCloudFront]="${ENABLE_CLOUDFRONT:-false}"
    [MarketplaceApiDomainName]="${MARKETPLACE_API_DOMAIN_NAME:-}"
    [MarketplaceApiBasePath]="${MARKETPLACE_API_BASE_PATH:-}"
    [EnableCustomDomainMapping]="${ENABLE_CUSTOM_DOMAIN_MAPPING:-false}"
    [EnableBasePathStrip]="${ENABLE_BASE_PATH_STRIP:-false}"
    [CrmTimeoutMs]="${CRM_TIMEOUT_MS:-12000}"
    [LimitIpBurst]="${LIMIT_IP_BURST:-20}"
    [LimitIpBurstWindowSeconds]="${LIMIT_IP_BURST_WINDOW_SECONDS:-10}"
    [LimitIpHourly]="${LIMIT_IP_HOURLY:-600}"
    [LimitIpBookingsDaily]="${LIMIT_IP_BOOKINGS_DAILY:-6}"
    [LimitPhoneBookingsDaily]="${LIMIT_PHONE_BOOKINGS_DAILY:-3}"
    [LimitTenantBookingsDaily]="${LIMIT_TENANT_BOOKINGS_DAILY:-200}"
    [LimitCaptchaTrigger]="${LIMIT_CAPTCHA_TRIGGER:-3}"
    [LimitAiSearchAnonHourly]="${LIMIT_AI_SEARCH_ANON_HOURLY:-20}"
    [LimitAiSearchUserHourly]="${LIMIT_AI_SEARCH_USER_HOURLY:-60}"
    [LimitBuyerWritesHourly]="${LIMIT_BUYER_WRITES_HOURLY:-120}"
    [HcaptchaSiteKey]="${HCAPTCHA_SITE_KEY:-}"
    [HcaptchaSecretKey]="${HCAPTCHA_SECRET_KEY:-}"
    [MarketplaceSessionSecret]="${MARKETPLACE_SESSION_SECRET:-}"
    [ListingCacheSeconds]="${LISTING_CACHE_SECONDS:-60}"
    [CitiesCacheSeconds]="${CITIES_CACHE_SECONDS:-300}"
    [AssetCacheSeconds]="${ASSET_CACHE_SECONDS:-300}"
    [PublicCacheSeconds]="${PUBLIC_CACHE_SECONDS:-60}"
    [LogLevel]="${LOG_LEVEL:-info}"
    [LogRetentionDays]="${LOG_RETENTION_DAYS:-30}"
  )
}

# validate_custom_domain_vars — shared by deploy.sh and config-deploy.sh.
#
# The CRM domain is always required (host only, custom domain, never
# execute-api). This API's OWN domain is a placeholder until the marketplace
# domain is chosen: with ENABLE_CUSTOM_DOMAIN_MAPPING=false an empty
# MARKETPLACE_API_DOMAIN_NAME is allowed and the raw execute-api URL is used.
# With the mapping on, domain + base path + strip are all required. In every
# case an execute-api host or a scheme in a *_DOMAIN_NAME is refused.
validate_custom_domain_vars() {
  local failed=0 value

  value="${CRM_INTERNAL_API_DOMAIN_NAME:-}"
  if [ -z "$value" ]; then
    echo "ERROR: CRM_INTERNAL_API_DOMAIN_NAME is not set (host only, e.g. services-api.cloudberrysolutions.in)"; failed=1
  elif [[ "$value" == *execute-api* || "$value" == *amazonaws.com* ]]; then
    echo "ERROR: CRM_INTERNAL_API_DOMAIN_NAME='$value' is a raw API Gateway host; use the custom domain"; failed=1
  elif [[ "$value" == *"://"* ]]; then
    echo "ERROR: CRM_INTERNAL_API_DOMAIN_NAME='$value' must be a host only, without a scheme"; failed=1
  fi
  if [ -z "${CRM_INTERNAL_API_BASE_PATH:-}" ]; then
    echo "ERROR: CRM_INTERNAL_API_BASE_PATH is not set"; failed=1
  fi

  value="${MARKETPLACE_API_DOMAIN_NAME:-}"
  if [ -n "$value" ]; then
    if [[ "$value" == *execute-api* || "$value" == *amazonaws.com* ]]; then
      echo "ERROR: MARKETPLACE_API_DOMAIN_NAME='$value' is a raw API Gateway host; leave it empty (mapping off) or use the custom domain"; failed=1
    elif [[ "$value" == *"://"* ]]; then
      echo "ERROR: MARKETPLACE_API_DOMAIN_NAME='$value' must be a host only, without a scheme"; failed=1
    fi
  fi

  if [ "${ENABLE_CUSTOM_DOMAIN_MAPPING:-false}" = "true" ]; then
    if [ -z "$value" ]; then
      echo "ERROR: ENABLE_CUSTOM_DOMAIN_MAPPING=true requires MARKETPLACE_API_DOMAIN_NAME"; failed=1
    fi
    if [ -z "${MARKETPLACE_API_BASE_PATH:-}" ]; then
      echo "ERROR: ENABLE_CUSTOM_DOMAIN_MAPPING=true requires MARKETPLACE_API_BASE_PATH"; failed=1
    fi
    if [ "${ENABLE_BASE_PATH_STRIP:-false}" != "true" ]; then
      echo "ERROR: ENABLE_BASE_PATH_STRIP must be true when the custom domain mapping is enabled"; failed=1
    fi
  else
    if [ "${ENABLE_CLOUDFRONT:-false}" = "true" ]; then
      echo "ERROR: ENABLE_CLOUDFRONT=true requires ENABLE_CUSTOM_DOMAIN_MAPPING=true (the CloudFront origin is the custom domain)"; failed=1
    fi
    if [ "${ENABLE_BASE_PATH_STRIP:-false}" = "true" ]; then
      echo "ERROR: ENABLE_BASE_PATH_STRIP=true without a mapping would strip a segment that is not there"; failed=1
    fi
  fi
  return $failed
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
