# =============================================================================
# Custom-domain guard — server
# =============================================================================
# Sourced by infra/deploy.sh, infra/config-deploy.sh and the CI/CD wrapper
# (infra/cicd/agency-app/api/deploy.sh) after .env.$ENV has been loaded.
#
# Every API this service owns or calls is reached through an API Gateway
# custom domain + a single-segment base path — never a raw
# https://<id>.execute-api.<region>.amazonaws.com/<stage> invoke URL. Each
# endpoint is therefore a <STEM>_DOMAIN_NAME + <STEM>_BASE_PATH pair, composed
# at runtime by agency-app/api/config/serviceUrls.js.
#
# validate_service_endpoints <env-file-label>
#   Required pairs (fail if either half is empty):
#     PUBLIC_API, CRM_API       (this stack's own base path mappings)
#     AUTH_SERVICE              (reality-flow-authentication)
#   Optional pairs (both empty = feature not configured; otherwise both halves
#   must be set):
#     MCP_API                   (no prod MCP stack yet)
#     AI_CALLING_SERVICE        (stack not deployed yet)
#   Every non-empty *_DOMAIN_NAME must be a bare host: no "://", and not an
#   execute-api / amazonaws.com host.
# =============================================================================

_sse_fail() {
  echo "ERROR: $1"
  return 1
}

_sse_check_domain() {
  local var="$1" label="$2"
  local value="${!var:-}"
  if [ -z "$value" ]; then
    _sse_fail "$var is empty in $label — set it to the API Gateway custom domain (e.g. services-api.cloudberrysolutions.in)."
    return 1
  fi
  if [[ "$value" == *"://"* ]]; then
    _sse_fail "$var ('$value') must be a bare host name, not a URL (no scheme)."
    return 1
  fi
  if [[ "$value" == *"execute-api"* ]] || [[ "$value" == *"amazonaws.com"* ]]; then
    _sse_fail "$var ('$value') is a raw API Gateway host — raw API Gateway URLs are not allowed; use the custom domain."
    return 1
  fi
  return 0
}

_sse_check_base_path() {
  local var="$1" label="$2"
  local value="${!var:-}"
  if [ -z "$value" ]; then
    _sse_fail "$var is empty in $label — set it to the service's base path mapping (single segment)."
    return 1
  fi
  if [[ "$value" == *"/"* ]]; then
    _sse_fail "$var ('$value') must be a single path segment without slashes."
    return 1
  fi
  return 0
}

validate_service_endpoints() {
  local label="${1:-env file}"
  local ok=0
  local stem

  for stem in PUBLIC_API CRM_API AUTH_SERVICE; do
    _sse_check_domain "${stem}_DOMAIN_NAME" "$label" || ok=1
    _sse_check_base_path "${stem}_BASE_PATH" "$label" || ok=1
  done

  for stem in MCP_API AI_CALLING_SERVICE FOLLOWUP_SERVICE MARKETPLACE_API; do
    local d="${stem}_DOMAIN_NAME" b="${stem}_BASE_PATH"
    if [ -z "${!d:-}" ] && [ -z "${!b:-}" ]; then
      echo "NOTE: $d / $b are empty — that integration is treated as not configured."
      continue
    fi
    _sse_check_domain "$d" "$label" || ok=1
    _sse_check_base_path "$b" "$label" || ok=1
  done

  if [ "${ENABLE_CUSTOM_DOMAIN_MAPPING:-true}" = "true" ] && [ "${ENABLE_BASE_PATH_STRIP:-false}" != "true" ]; then
    _sse_fail "ENABLE_CUSTOM_DOMAIN_MAPPING=true requires ENABLE_BASE_PATH_STRIP=true in $label."
    ok=1
  fi

  return $ok
}
