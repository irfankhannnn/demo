# =============================================================================
# Shared CFN parameter computation — landing-pages
# =============================================================================
# Single source of truth for "what CFN parameter values does the currently
# loaded .env.$ENV produce". Sourced by infra/deploy.sh, infra/
# config-deploy.sh, and infra/content-deploy.sh. All 9 params here are pure
# infra topology (CloudFront/S3/domain/WAF) — no code-location parameter.
#
# Requires the caller to have already done `set -a; source .env.$ENV; set +a`
# and set ENV to the CLI-argument-driven value, and to have computed
# BUCKET_NAME the same way infra/deploy.sh does (below).
compute_param_values() {
  PARAM_KEYS=(
    EnvironmentName
    BucketName
    PriceClass
    CustomDomainName
    IncludeWwwAlias
    WwwIsCanonical
    AcmCertificateArn
    HostedZoneId
    WafWebAclArn
  )

  declare -gA PARAM_VALUES=(
    [EnvironmentName]="${ENV}"
    [BucketName]="${BUCKET_NAME}"
    [PriceClass]="${PRICE_CLASS}"
    [CustomDomainName]="${CUSTOM_DOMAIN_NAME}"
    [IncludeWwwAlias]="${INCLUDE_WWW_ALIAS}"
    [WwwIsCanonical]="${WWW_IS_CANONICAL}"
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
