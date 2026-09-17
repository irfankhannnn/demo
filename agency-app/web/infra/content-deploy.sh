#!/bin/bash
set -euo pipefail

# =============================================================================
# RealtyFlow CRM Frontend — Content-Only Deploy
# =============================================================================
# Usage: ./infra/content-deploy.sh <dev|prod>
#
# For a pure VITE_*-only change: a build-time env var Vite compiles directly
# into the static JS bundle (vite build --mode $ENV). This is NEVER a
# CFN-only change — a rebuild and re-sync to S3 is unavoidable — but if
# no CFN parameter (custom domain, cert, price class, WAF) ALSO changed,
# the CloudFormation stack update is pure overhead: skip it.
#
# This is the "category 3" axis from docs/proposals/config-only-deploy/
# context.md — the complement of infra/config-deploy.sh's "category 1"
# (pure CFN-parameter change, skip the build instead). The two are
# independent: a change touching both runs neither script, it's a normal
# full deploy (infra/deploy.sh with no flags).
#
# Safety gate: verifies the CFN parameters .env.$ENV would produce today
# are IDENTICAL to the live stack's current parameters before skipping the
# CFN step — if they differ at all (not just on the allowlist — an actual
# CFN update is needed here, so there's no "allowed vs blocked" distinction
# the way config-deploy.sh has), refuses and says so, since --skip-cfn would
# otherwise silently ship content in front of stale infrastructure.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/params.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/api-domain-guard.sh"

OS_UNAME="$(uname -s || echo '')"
AWS_BIN="aws"
case "$OS_UNAME" in
  MINGW*|MSYS*|CYGWIN*)
    if command -v aws.exe >/dev/null 2>&1; then AWS_BIN="aws.exe"; fi
    ;;
esac

for bin in "$AWS_BIN" node; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: $bin not found in PATH"
    exit 1
  fi
done

echo "============================================="
echo " RealtyFlow CRM Frontend — Content-Only Deploy"
echo "============================================="

DEPLOY_ENV="${1:-}"
if [ "$DEPLOY_ENV" != "dev" ] && [ "$DEPLOY_ENV" != "prod" ]; then
  echo "ERROR: Usage: $0 <dev|prod>"
  exit 1
fi

ENV_FILE="$PROJECT_DIR/.env.${DEPLOY_ENV}"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found at $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
ENV="$DEPLOY_ENV"

REQUIRED_VARS=(AWS_REGION SERVICE_NAME)
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Required env var $var is not set in $ENV_FILE"
    exit 1
  fi
done
# A content deploy rebuilds the bundle — refuse raw execute-api endpoints up front.
validate_api_domain_vars "$ENV_FILE"

BUCKET_NAME="${FRONTEND_S3_BUCKET_NAME:-${ENV}-${SERVICE_NAME}}"
STACK_NAME="${ENV}-${SERVICE_NAME}-stack"
PRICE_CLASS="${FRONTEND_PRICE_CLASS:-PriceClass_200}"
CUSTOM_DOMAIN_NAME="${FRONTEND_CUSTOM_DOMAIN_NAME:-}"
ACM_CERTIFICATE_ARN="${FRONTEND_ACM_CERTIFICATE_ARN:-}"
HOSTED_ZONE_ID="${FRONTEND_HOSTED_ZONE_ID:-}"
WAF_WEB_ACL_ARN="${FRONTEND_WAF_WEB_ACL_ARN:-}"
INSTA_FRONTEND_BUCKET_DOMAIN_NAME="${INSTA_FRONTEND_BUCKET_DOMAIN_NAME:-}"

echo "Region:  $AWS_REGION"
echo "Stack:   $STACK_NAME"
echo "Bucket:  $BUCKET_NAME"
echo "Env:     $ENV"
echo ""

echo "[1/2] Verifying no CFN parameter has changed..."
if ! LIVE_PARAMS_JSON="$("$AWS_BIN" cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --region "$AWS_REGION" \
      --query "Stacks[0].Parameters" \
      --output json --no-cli-pager 2>/dev/null)"; then
  echo "ERROR: stack $STACK_NAME does not exist (or isn't reachable) — content-only mode requires an existing deployed stack."
  echo "Run a full deploy first: ./infra/deploy.sh $ENV"
  exit 1
fi

compute_param_values
for k in "${PARAM_KEYS[@]}"; do export "PV_${k}=${PARAM_VALUES[$k]}"; done

DIFF_JSON="$(node -e "
  const live = JSON.parse(process.argv[1]);
  const liveMap = {};
  for (const p of live) liveMap[p.ParameterKey] = p.ParameterValue;
  const keys = process.argv.slice(2);
  const missing = [];
  const changed = {};
  for (const key of keys) {
    if (liveMap[key] === undefined) { missing.push(key); continue; }
    const desired = process.env['PV_' + key];
    if (desired !== liveMap[key]) changed[key] = { from: liveMap[key], to: desired };
  }
  process.stdout.write(JSON.stringify({ missing, changed }));
" "$LIVE_PARAMS_JSON" "${PARAM_KEYS[@]}")"

MISSING_COUNT="$(node -e "process.stdout.write(String(JSON.parse(process.argv[1]).missing.length))" "$DIFF_JSON")"
CHANGED_COUNT="$(node -e "process.stdout.write(String(Object.keys(JSON.parse(process.argv[1]).changed).length))" "$DIFF_JSON")"

if [ "$MISSING_COUNT" -gt 0 ] || [ "$CHANGED_COUNT" -gt 0 ]; then
  echo ""
  echo "ERROR: content-only mode refuses to proceed — at least one CFN parameter"
  echo "would also change, which needs a real CloudFormation update:"
  node -e "
    const d = JSON.parse(process.argv[1]);
    d.missing.forEach(k => console.log('  - ' + k + ': declared in template but not on the live stack (template changed)'));
    for (const [k, v] of Object.entries(d.changed)) console.log('  - ' + k + ': ' + JSON.stringify(v.from) + ' -> ' + JSON.stringify(v.to));
  " "$DIFF_JSON"
  echo ""
  echo "Run a full deploy instead: ./infra/deploy.sh $ENV"
  exit 1
fi

echo "  No CFN parameter changed — safe to skip the CloudFormation update."
echo ""
echo "[2/2] Delegating to ./infra/deploy.sh $ENV --skip-cfn..."
"$SCRIPT_DIR/deploy.sh" "$ENV" --skip-cfn

echo ""
echo "============================================="
echo " Content-only deploy complete!"
echo "============================================="
