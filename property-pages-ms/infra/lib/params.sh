# =============================================================================
# Shared CFN parameter computation — property-pages-ms
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
    PublicPagesInternalApiKey
    VisitSessionSecret
    PublicPagesBaseDomain
    PathTenantFallback
    HcaptchaSiteKey
    HcaptchaSecretKey
    GoogleMapsEmbedApiKey
    LimitTenantBookingsDaily
    CrmTimeoutMs
    VisitSessionTtlSeconds
    VisitMinFillSeconds
    LimitIpBurst
    LimitIpBurstWindowSeconds
    LimitIpHourly
    LimitIpBookingsDaily
    LimitPhoneBookingsDaily
    LimitCaptchaTrigger
    HcaptchaVerifyTimeoutMs
    AssetCacheSeconds
    PageCacheSeconds
    ApiStageName
    EnableCloudFront
    PagesApiDomainName
    PagesApiBasePath
    EnableCustomDomainMapping
    EnableBasePathStrip
    LogLevel
    LogRetentionDays
  )

  declare -gA PARAM_VALUES=(
    [EnvironmentName]="${ENVIRONMENT_NAME}"
    [LambdaRuntime]="${LAMBDA_RUNTIME:-nodejs20.x}"
    [LambdaMemorySize]="${LAMBDA_MEMORY_SIZE:-512}"
    [LambdaTimeout]="${LAMBDA_TIMEOUT:-15}"
    [LambdaCodeS3Bucket]="${ARTIFACT_BUCKET}"
    [LambdaCodeS3Key]="${s3_key}"
    [CrmInternalApiDomainName]="${CRM_INTERNAL_API_DOMAIN_NAME}"
    [CrmInternalApiBasePath]="${CRM_INTERNAL_API_BASE_PATH}"
    [PublicPagesInternalApiKey]="${PUBLIC_PAGES_INTERNAL_API_KEY}"
    [VisitSessionSecret]="${VISIT_SESSION_SECRET}"
    [PublicPagesBaseDomain]="${PUBLIC_PAGES_BASE_DOMAIN:-}"
    [PathTenantFallback]="${PATH_TENANT_FALLBACK:-true}"
    [HcaptchaSiteKey]="${HCAPTCHA_SITE_KEY:-}"
    [HcaptchaSecretKey]="${HCAPTCHA_SECRET_KEY:-}"
    [GoogleMapsEmbedApiKey]="${GOOGLE_MAPS_EMBED_API_KEY:-}"
    [LimitTenantBookingsDaily]="${LIMIT_TENANT_BOOKINGS_DAILY:-200}"
    [CrmTimeoutMs]="${CRM_TIMEOUT_MS:-12000}"
    [VisitSessionTtlSeconds]="${VISIT_SESSION_TTL_SECONDS:-1800}"
    [VisitMinFillSeconds]="${VISIT_MIN_FILL_SECONDS:-3}"
    [LimitIpBurst]="${LIMIT_IP_BURST:-5}"
    [LimitIpBurstWindowSeconds]="${LIMIT_IP_BURST_WINDOW_SECONDS:-10}"
    [LimitIpHourly]="${LIMIT_IP_HOURLY:-40}"
    [LimitIpBookingsDaily]="${LIMIT_IP_BOOKINGS_DAILY:-6}"
    [LimitPhoneBookingsDaily]="${LIMIT_PHONE_BOOKINGS_DAILY:-3}"
    [LimitCaptchaTrigger]="${LIMIT_CAPTCHA_TRIGGER:-3}"
    [HcaptchaVerifyTimeoutMs]="${HCAPTCHA_VERIFY_TIMEOUT_MS:-5000}"
    [AssetCacheSeconds]="${ASSET_CACHE_SECONDS:-300}"
    [PageCacheSeconds]="${PAGE_CACHE_SECONDS:-60}"
    [ApiStageName]="${API_STAGE_NAME:-v1}"
    [EnableCloudFront]="${ENABLE_CLOUDFRONT:-true}"
    [PagesApiDomainName]="${PAGES_API_DOMAIN_NAME:-}"
    [PagesApiBasePath]="${PAGES_API_BASE_PATH:-}"
    [EnableCustomDomainMapping]="${ENABLE_CUSTOM_DOMAIN_MAPPING:-false}"
    [EnableBasePathStrip]="${ENABLE_BASE_PATH_STRIP:-false}"
    [LogLevel]="${LOG_LEVEL:-info}"
    [LogRetentionDays]="${LOG_RETENTION_DAYS:-30}"
  )
}

# validate_custom_domain_vars — shared by deploy.sh and config-deploy.sh.
# Every API is reached via an API Gateway custom domain + base path; a raw
# execute-api host (or a full URL) in any *_DOMAIN_NAME var is refused.
validate_custom_domain_vars() {
  local failed=0 var value
  for var in CRM_INTERNAL_API_DOMAIN_NAME PAGES_API_DOMAIN_NAME; do
    value="${!var:-}"
    if [ -z "$value" ]; then
      echo "ERROR: $var is not set (host only, e.g. services-api.cloudberrysolutions.in)"; failed=1
    elif [[ "$value" == *execute-api* || "$value" == *amazonaws.com* ]]; then
      echo "ERROR: $var='$value' is a raw API Gateway host; use the custom domain"; failed=1
    elif [[ "$value" == *"://"* ]]; then
      echo "ERROR: $var='$value' must be a host only, without a scheme"; failed=1
    fi
  done
  for var in CRM_INTERNAL_API_BASE_PATH PAGES_API_BASE_PATH; do
    if [ -z "${!var:-}" ]; then
      echo "ERROR: $var is not set"; failed=1
    fi
  done
  if [ "${ENABLE_CUSTOM_DOMAIN_MAPPING:-false}" != "true" ]; then
    echo "ERROR: ENABLE_CUSTOM_DOMAIN_MAPPING must be true (dev and prod are both served via the custom domain)"; failed=1
  fi
  if [ "${ENABLE_BASE_PATH_STRIP:-false}" != "true" ]; then
    echo "ERROR: ENABLE_BASE_PATH_STRIP must be true when the custom domain mapping is enabled"; failed=1
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
