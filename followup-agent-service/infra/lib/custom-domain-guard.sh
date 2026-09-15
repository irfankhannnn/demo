# =============================================================================
# Custom-domain guard — followup-agent-service
# =============================================================================
# Sourced by infra/deploy.sh and infra/config-deploy.sh after .env.$ENV is
# loaded. Every API is reached via an API Gateway custom domain + base path;
# raw execute-api hosts (or full URLs) in any *_DOMAIN_NAME var are refused,
# and both the mapping and the Lambda-side base-path strip must be on.
validate_custom_domain_vars() {
  local failed=0 var value
  for var in CRM_INTERNAL_API_DOMAIN_NAME AI_CALLING_SERVICE_DOMAIN_NAME FOLLOWUP_API_DOMAIN_NAME; do
    value="${!var:-}"
    if [ -z "$value" ]; then
      echo "ERROR: $var is not set (host only, e.g. services-api.cloudberrysolutions.in)"; failed=1
    elif [[ "$value" == *execute-api* || "$value" == *amazonaws.com* ]]; then
      echo "ERROR: $var='$value' is a raw API Gateway host; use the custom domain"; failed=1
    elif [[ "$value" == *"://"* ]]; then
      echo "ERROR: $var='$value' must be a host only, without a scheme"; failed=1
    fi
  done
  for var in CRM_INTERNAL_API_BASE_PATH AI_CALLING_SERVICE_BASE_PATH FOLLOWUP_API_BASE_PATH; do
    if [ -z "${!var:-}" ]; then
      echo "ERROR: $var is not set"; failed=1
    fi
  done
  if [ "${ENABLE_CUSTOM_DOMAIN_MAPPING:-false}" != "true" ]; then
    echo "ERROR: ENABLE_CUSTOM_DOMAIN_MAPPING must be true - the CRM reaches this service via the custom domain."; failed=1
  fi
  if [ "${ENABLE_BASE_PATH_STRIP:-false}" != "true" ]; then
    echo "ERROR: ENABLE_BASE_PATH_STRIP must be true. API Gateway does not strip the base"
    echo "       path from a Lambda proxy event; without it every request 404s."; failed=1
  fi
  return $failed
}
