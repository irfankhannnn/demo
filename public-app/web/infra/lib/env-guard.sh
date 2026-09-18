# =============================================================================
# Build-env guard — marketplace-web
# =============================================================================
# The bundle bakes VITE_MARKETPLACE_API_URL and VITE_MARKETPLACE_AUTH_URL in at
# build time. A deployed build must reach both services over https with no
# trailing slash. Unlike the CRM frontend's api-domain-guard.sh, a raw
# execute-api URL is only a WARNING for dev (the API contract allows it until
# the custom domain is mapped) and an ERROR for prod.
#
# validate_web_env_vars <env> <env-file-label>
#   Requires the caller to have already sourced .env.$ENV.
# Sourced by infra/deploy.sh, infra/content-deploy.sh, infra/config-deploy.sh
# and infra/cicd/public-app/web/deploy.sh.

_check_web_url() {
  local var="$1" env="$2" label="$3"
  local value="${!var:-}"
  value="$(printf '%s' "$value" | tr -d '[:space:]')"

  if [ -z "$value" ]; then
    echo "ERROR: $var is not set in $label"
    return 1
  fi
  if [[ "$value" != https://* ]]; then
    echo "ERROR: $var ('$value') must be an https:// URL for a deployed build (http://localhost is for local dev only)."
    return 1
  fi
  if [[ "$value" == */ ]]; then
    echo "ERROR: $var ('$value') must not end with a slash — the app joins paths itself."
    return 1
  fi
  if printf '%s' "$value" | grep -Eqi 'execute-api|amazonaws\.com'; then
    if [ "$env" = "prod" ]; then
      echo "ERROR: $var ('$value') is a raw API Gateway URL — prod must use the custom domain."
      return 1
    fi
    echo "WARNING: $var ('$value') is a raw API Gateway URL — acceptable for dev until the custom domain is mapped (placeholder)."
  fi
  return 0
}

validate_web_env_vars() {
  local env="$1" label="$2"
  local ok=0
  _check_web_url VITE_MARKETPLACE_API_URL "$env" "$label" || ok=1
  _check_web_url VITE_MARKETPLACE_AUTH_URL "$env" "$label" || ok=1
  if [ "$ok" -ne 0 ]; then
    exit 1
  fi
}
