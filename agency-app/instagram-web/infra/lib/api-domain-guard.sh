# =============================================================================
# Custom-domain contract guard — frontend_insta_sol_ms
# =============================================================================
# Sourced by infra/deploy.sh, infra/config-deploy.sh and infra/content-deploy.sh
# after the .env.<env> file is loaded. The bundle reaches the Instagram API as
# https://<VITE_INSTA_API_DOMAIN_NAME>/<VITE_INSTA_API_BASE_PATH>/api/insta;
# a raw API Gateway invoke host, a scheme, or an empty value fails the deploy
# before anything is built or uploaded.
assert_frontend_api_domain_vars() {
  local errors=0 var val
  for var in VITE_INSTA_API_DOMAIN_NAME; do
    val="${!var:-}"
    if [ -z "$val" ]; then
      echo "ERROR: $var is empty — set it to the API Gateway custom domain (e.g. services-api.cloudberrysolutions.in)"
      errors=$((errors + 1))
    elif [[ "$val" == *execute-api* || "$val" == *amazonaws.com* ]]; then
      echo "ERROR: $var ('$val') is a raw API Gateway host — use the custom domain instead"
      errors=$((errors + 1))
    elif [[ "$val" == *"://"* ]]; then
      echo "ERROR: $var ('$val') must be a bare hostname, without a scheme"
      errors=$((errors + 1))
    fi
  done
  for var in VITE_INSTA_API_BASE_PATH; do
    if [ -z "${!var:-}" ]; then
      echo "ERROR: $var is empty — set it to the base path mapping for this environment"
      errors=$((errors + 1))
    fi
  done
  if [ "$errors" -gt 0 ]; then
    exit 1
  fi
}
