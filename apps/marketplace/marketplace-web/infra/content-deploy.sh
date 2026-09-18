#!/bin/bash
set -euo pipefail

# =============================================================================
# RealEstateFlow Homes (marketplace-web) — Content-Only Deploy
# =============================================================================
# Usage: ./infra/content-deploy.sh <dev|prod>
#
# For a pure VITE_*-only change (API URLs, maps key, site name — all baked
# into the JS bundle by `vite build --mode $ENV`). A rebuild and re-sync are
# unavoidable, but if no CFN parameter also changed the CloudFormation update
# is pure overhead: skip it.
#
# Safety gate: the CFN parameters .env.$ENV would produce today must be
# IDENTICAL to the live stack's — if anything differs, refuse and point at a
# full deploy, so --skip-cfn never ships content in front of stale infra.
# Complement of infra/config-deploy.sh (pure CFN-parameter change).
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/params.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/env-guard.sh"

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
echo " RealEstateFlow Homes (marketplace-web) — Content-Only Deploy"
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
if [ -n "${AWS_PROFILE:-}" ]; then export AWS_PROFILE; else unset AWS_PROFILE; fi

REQUIRED_VARS=(AWS_REGION SERVICE_NAME)
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Required env var $var is not set in $ENV_FILE"
    exit 1
  fi
done
# A content deploy rebuilds the bundle — validate the baked-in URLs up front.
validate_web_env_vars "$ENV" "$ENV_FILE"
resolve_web_vars

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
