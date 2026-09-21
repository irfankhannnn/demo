# =============================================================================
# Shared CFN parameter computation — marketplace-web
# =============================================================================
# Single source of truth for "what CFN parameter values does the currently
# loaded .env.$ENV produce". Sourced by infra/deploy.sh, infra/content-deploy.sh
# and infra/config-deploy.sh so the three paths cannot drift apart. All 8
# params are plain infra topology values (S3 / CloudFront / domain).
#
# Requires the caller to have already done `set -a; source .env.$ENV; set +a`,
# set ENV from the CLI argument, and computed BUCKET_NAME / PRICE_CLASS /
# WEB_DOMAIN_NAME / ACM_CERTIFICATE_ARN / HOSTED_ZONE_ID / WAF_WEB_ACL_ARN the
# way infra/deploy.sh does (see resolve_web_vars below).

# resolve_web_vars — derive the script-level variables from the sourced env
# file. Idempotent; call after sourcing .env.$ENV and setting ENV.
resolve_web_vars() {
  BUCKET_NAME="${WEB_S3_BUCKET_NAME:-${ENV}-${SERVICE_NAME}}"
  STACK_NAME="${ENV}-${SERVICE_NAME}-stack"
  PRICE_CLASS="${WEB_PRICE_CLASS:-PriceClass_200}"
  WEB_DOMAIN_NAME="${WEB_DOMAIN_NAME:-}"
  ACM_CERTIFICATE_ARN="${WEB_ACM_CERTIFICATE_ARN:-}"
  HOSTED_ZONE_ID="${WEB_HOSTED_ZONE_ID:-}"
  WEB_DOMAIN_ALT_NAMES="${WEB_DOMAIN_ALT_NAMES:-}"
  WAF_WEB_ACL_ARN="${WEB_WAF_WEB_ACL_ARN:-}"

  # Domain and certificate go together: the template's HasCustomDomain
  # condition needs both, so refuse a half-configured env file up front
  # instead of silently serving from *.cloudfront.net. The hosted zone is
  # optional (only for DNS in Route53); alt names and a zone make no sense
  # without the domain.
  if [ -n "$WEB_DOMAIN_NAME" ] || [ -n "$ACM_CERTIFICATE_ARN" ] || [ -n "$HOSTED_ZONE_ID" ] || [ -n "$WEB_DOMAIN_ALT_NAMES" ]; then
    if [ -z "$WEB_DOMAIN_NAME" ] || [ -z "$ACM_CERTIFICATE_ARN" ]; then
      echo "ERROR: WEB_DOMAIN_NAME and WEB_ACM_CERTIFICATE_ARN must be set together (or the whole domain block left blank)."
      exit 1
    fi
  fi
  case "$WEB_DOMAIN_ALT_NAMES" in
    *" "*) echo "ERROR: WEB_DOMAIN_ALT_NAMES is comma-separated with no spaces."; exit 1 ;;
  esac
}

compute_param_values() {
  PARAM_KEYS=(
    EnvironmentName
    BucketName
    PriceClass
    WebDomainName
    WebDomainAltNames
    AcmCertificateArn
    HostedZoneId
    WafWebAclArn
  )

  declare -gA PARAM_VALUES=(
    [EnvironmentName]="${ENV}"
    [BucketName]="${BUCKET_NAME}"
    [PriceClass]="${PRICE_CLASS}"
    [WebDomainName]="${WEB_DOMAIN_NAME}"
    [WebDomainAltNames]="${WEB_DOMAIN_ALT_NAMES}"
    [AcmCertificateArn]="${ACM_CERTIFICATE_ARN}"
    [HostedZoneId]="${HOSTED_ZONE_ID}"
    [WafWebAclArn]="${WAF_WEB_ACL_ARN}"
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
