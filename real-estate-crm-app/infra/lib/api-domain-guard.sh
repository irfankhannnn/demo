# =============================================================================
# API custom-domain guard — real-estate-crm-app
# =============================================================================
# The CRM bundle bakes its API endpoints in at build time from
# VITE_<X>_API_DOMAIN_NAME + VITE_<X>_API_BASE_PATH (composed by
# src/config/apiConfig.ts). A deployed build must only ever reach APIs through
# the API Gateway custom domain + base path mapping — never a raw
# https://<id>.execute-api.<region>.amazonaws.com/<stage> invoke URL.
#
# validate_api_domain_vars <env-file-label>
#   Requires the caller to have already sourced .env.$ENV. Exits 1 on:
#     - a required DOMAIN_NAME that is empty, matches execute-api/amazonaws.com,
#       or contains :// (full origins are for local `vite` dev only)
#     - a required BASE_PATH that is empty
#   VITE_MCP_API_* is optional (no MCP stack in every env); when its domain is
#   set it gets the same checks, including a non-empty base path.
# Sourced by infra/deploy.sh, infra/content-deploy.sh, infra/config-deploy.sh
# and cfn-templates-cicd/real-estate-crm-app/deploy.sh.

_check_api_domain_pair() {
  local domain_var="$1" path_var="$2" label="$3"
  local domain="${!domain_var:-}" base_path="${!path_var:-}"
  domain="$(printf '%s' "$domain" | tr -d '[:space:]')"
  base_path="$(printf '%s' "$base_path" | tr -d '[:space:]')"

  if [ -z "$domain" ]; then
    echo "ERROR: $domain_var is not set in $label"
    return 1
  fi
  if printf '%s' "$domain" | grep -Eqi 'execute-api|amazonaws\.com'; then
    echo "ERROR: $domain_var ('$domain') is a raw API Gateway host — raw API Gateway URLs are not allowed; use the custom domain (services-api.*)."
    return 1
  fi
  if [[ "$domain" == *"://"* ]]; then
    echo "ERROR: $domain_var ('$domain') must be a bare host name, not a URL (no scheme, no path)."
    return 1
  fi
  if [ -z "$base_path" ]; then
    echo "ERROR: $path_var is not set in $label (required with $domain_var)"
    return 1
  fi
  return 0
}

validate_api_domain_vars() {
  local label="${1:-env file}"
  local failed=0
  _check_api_domain_pair VITE_CRM_API_DOMAIN_NAME VITE_CRM_API_BASE_PATH "$label" || failed=1
  _check_api_domain_pair VITE_AUTH_API_DOMAIN_NAME VITE_AUTH_API_BASE_PATH "$label" || failed=1
  if [ -n "$(printf '%s' "${VITE_MCP_API_DOMAIN_NAME:-}" | tr -d '[:space:]')" ]; then
    _check_api_domain_pair VITE_MCP_API_DOMAIN_NAME VITE_MCP_API_BASE_PATH "$label" || failed=1
  fi
  # Legacy single-URL vars were removed; refuse a file that still carries them
  # so a stale .env can't look valid while the bundle silently ignores it.
  local legacy
  for legacy in VITE_API_URL VITE_API_BASE_URL VITE_AUTH_API_URL VITE_AI_CALLING_API_URL; do
    if [ -n "${!legacy:-}" ]; then
      echo "ERROR: $legacy is no longer read by the app — replace it with the VITE_<X>_API_DOMAIN_NAME + VITE_<X>_API_BASE_PATH pair in $label"
      failed=1
    fi
  done
  if [ "$failed" -ne 0 ]; then
    exit 1
  fi
}
