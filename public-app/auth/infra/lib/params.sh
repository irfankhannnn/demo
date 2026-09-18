# =============================================================================
# Shared CFN parameter computation — marketplace-authentication
# =============================================================================
# Single source of truth for "what CFN parameter values does the currently
# loaded .env.$ENV produce". Sourced by infra/deploy.sh (full deploy) and
# infra/config-deploy.sh (config-only) so the two can never drift.
#
# Requires the caller to have done `set -a; source .env.$ENV; set +a` and
# set ENV from the CLI argument before calling compute_param_values.
#
# Populates:
#   PARAM_KEYS    — ordered array of every parameter name
#   PARAM_VALUES  — associative array, PARAM_VALUES[<Key>] = <value>

# validate_custom_domain_vars — the marketplace custom domain is still a
# placeholder, so an EMPTY domain/base path is allowed as long as
# ENABLE_CUSTOM_DOMAIN_MAPPING is false. What is never allowed: a scheme
# (https://…) or a raw API Gateway host (*.execute-api.*.amazonaws.com) —
# those are the two mistakes that produce a "successful" deploy with a
# broken mapping. When mapping is enabled both values must be set.
validate_custom_domain_vars() {
  local domain="${MARKETPLACE_AUTH_DOMAIN_NAME:-}"
  local base_path="${MARKETPLACE_AUTH_BASE_PATH:-}"
  local mapping="${ENABLE_CUSTOM_DOMAIN_MAPPING:-false}"
  local strip="${ENABLE_BASE_PATH_STRIP:-false}"

  if [[ "$domain" == *"://"* ]]; then
    echo "ERROR: MARKETPLACE_AUTH_DOMAIN_NAME ('$domain') must be a bare host name, not a URL (no scheme)"
    exit 1
  fi
  if [[ "$domain" == *execute-api* ]] || [[ "$domain" == *amazonaws.com* ]]; then
    echo "ERROR: MARKETPLACE_AUTH_DOMAIN_NAME ('$domain') is a raw API Gateway host — use the custom domain (or leave it empty with ENABLE_CUSTOM_DOMAIN_MAPPING=false)"
    exit 1
  fi
  if [ "$mapping" = "true" ]; then
    if [ -z "$domain" ]; then
      echo "ERROR: ENABLE_CUSTOM_DOMAIN_MAPPING=true but MARKETPLACE_AUTH_DOMAIN_NAME is empty"
      exit 1
    fi
    if [ -z "$base_path" ]; then
      echo "ERROR: ENABLE_CUSTOM_DOMAIN_MAPPING=true but MARKETPLACE_AUTH_BASE_PATH is empty"
      exit 1
    fi
  elif [ "$mapping" != "false" ]; then
    echo "ERROR: ENABLE_CUSTOM_DOMAIN_MAPPING must be 'true' or 'false' (got '$mapping')"
    exit 1
  fi
  if [ "$strip" = "true" ] && [ "$mapping" != "true" ]; then
    echo "ERROR: ENABLE_BASE_PATH_STRIP=true without ENABLE_CUSTOM_DOMAIN_MAPPING=true would strip a prefix that is never sent — keep them in lockstep"
    exit 1
  fi

  local api_domain="${MARKETPLACE_API_DOMAIN_NAME:-}"
  if [[ "$api_domain" == *"://"* ]]; then
    echo "ERROR: MARKETPLACE_API_DOMAIN_NAME ('$api_domain') must be a bare host name (no scheme)"
    exit 1
  fi
}

compute_param_values() {
  PARAM_KEYS=(
    ServiceName
    Env
    LambdaMemorySize
    LambdaTimeout
    LogRetentionDays
    LogLevel
    SubnetIds
    SecurityGroupIds
    LambdaPackagesBucketName
    MarketplaceAuthDomainName
    MarketplaceAuthBasePath
    EnableCustomDomainMapping
    EnableBasePathStrip
    GoogleClientId
    GoogleClientSecret
    IdentityCallbackURL
    IdentityLogoutURL
    TestOtpEnabled
    TestOtpCode
    InternalApiKey
    AuthCallerApiKey
    MarketplaceApiDomainName
    MarketplaceApiBasePath
    AllowedOrigins
  )

  declare -gA PARAM_VALUES=(
    [ServiceName]="${SERVICE_NAME}"
    [Env]="${ENV}"
    [LambdaMemorySize]="${LAMBDA_MEMORY_SIZE:-256}"
    [LambdaTimeout]="${LAMBDA_TIMEOUT:-30}"
    [LogRetentionDays]="${LOG_RETENTION_DAYS:-14}"
    [LogLevel]="${LOG_LEVEL:-info}"
    [SubnetIds]="${SUBNET_IDS:-}"
    [SecurityGroupIds]="${SECURITY_GROUP_IDS:-}"
    [LambdaPackagesBucketName]="${LAMBDA_PACKAGES_BUCKET_NAME}"
    [MarketplaceAuthDomainName]="${MARKETPLACE_AUTH_DOMAIN_NAME:-}"
    [MarketplaceAuthBasePath]="${MARKETPLACE_AUTH_BASE_PATH:-}"
    [EnableCustomDomainMapping]="${ENABLE_CUSTOM_DOMAIN_MAPPING:-false}"
    [EnableBasePathStrip]="${ENABLE_BASE_PATH_STRIP:-false}"
    [GoogleClientId]="${GOOGLE_CLIENT_ID}"
    [GoogleClientSecret]="${GOOGLE_CLIENT_SECRET}"
    [IdentityCallbackURL]="${IDENTITY_CALLBACK_URL}"
    [IdentityLogoutURL]="${IDENTITY_LOGOUT_URL}"
    [TestOtpEnabled]="${TEST_OTP_ENABLED:-false}"
    [TestOtpCode]="${TEST_OTP_CODE:-123456}"
    [InternalApiKey]="${INTERNAL_API_KEY}"
    [AuthCallerApiKey]="${AUTH_CALLER_API_KEY:-}"
    [MarketplaceApiDomainName]="${MARKETPLACE_API_DOMAIN_NAME:-}"
    [MarketplaceApiBasePath]="${MARKETPLACE_API_BASE_PATH:-}"
    [AllowedOrigins]="${ALLOWED_ORIGINS:-http://localhost:5173,http://localhost:3000}"
  )
}

# write_cfn_params_json <out-file> — [{ParameterKey,ParameterValue}, ...]
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

# check_params_match_template <cfn-backend.yaml> — fails unless the set of
# keys in PARAM_KEYS is exactly the template's Parameters block. Catches
# "added a parameter to the template but not to params.sh" (deploy would
# fall back to a Default silently) and the reverse (deploy rejects an
# unknown parameter, but only after the build/upload steps ran).
check_params_match_template() {
  local template="$1"
  local diff
  diff="$(node -e '
    const fs = require("fs");
    const text = fs.readFileSync(process.argv[1], "utf8");
    const m = text.match(/^Parameters:\r?\n([\s\S]*?)^(?:[A-Za-z]+:)/m);
    if (!m) { console.error("could not find Parameters block"); process.exit(2); }
    const inTemplate = new Set([...m[1].matchAll(/^  ([A-Za-z0-9]+):\s*$/gm)].map(x => x[1]));
    const inScript = new Set(process.argv.slice(2));
    const missing = [...inTemplate].filter(k => !inScript.has(k));
    const extra = [...inScript].filter(k => !inTemplate.has(k));
    if (missing.length || extra.length) {
      if (missing.length) console.log("in template but not in infra/lib/params.sh: " + missing.join(", "));
      if (extra.length) console.log("in infra/lib/params.sh but not in template: " + extra.join(", "));
    }
  ' "$template" "${PARAM_KEYS[@]}")"
  if [ -n "$diff" ]; then
    echo "ERROR: CFN parameter mismatch:"
    echo "$diff"
    exit 1
  fi
}
