# =============================================================================
# Shared CFN parameter computation — real-estate-crm-app
# =============================================================================
# Single source of truth for "what CFN parameter values does the currently
# loaded .env.$ENV produce". Sourced by infra/deploy.sh and
# infra/config-deploy.sh so the two paths can't drift apart. All 8 params
# here are plain infra topology values (CloudFront/S3/domain) — unlike this
# repo's Lambda services, there is no code-location parameter needing
# special "always use the live value" handling.
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
    AcmCertificateArn
    HostedZoneId
    WafWebAclArn
    InstaFrontendBucketDomainName
  )

  declare -gA PARAM_VALUES=(
    [EnvironmentName]="${ENV}"
    [BucketName]="${BUCKET_NAME}"
    [PriceClass]="${PRICE_CLASS}"
    [CustomDomainName]="${CUSTOM_DOMAIN_NAME}"
    [AcmCertificateArn]="${ACM_CERTIFICATE_ARN}"
    [HostedZoneId]="${HOSTED_ZONE_ID}"
    [WafWebAclArn]="${WAF_WEB_ACL_ARN}"
    [InstaFrontendBucketDomainName]="${INSTA_FRONTEND_BUCKET_DOMAIN_NAME}"
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
