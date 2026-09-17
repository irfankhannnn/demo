#!/bin/bash
set -euo pipefail

# =============================================================================
# RealtyFlow CRM Frontend — Config-Only Deploy
# =============================================================================
# Usage: ./infra/config-deploy.sh <dev|prod>
#
# For a pure CFN-parameter change (custom domain, ACM cert, price class,
# WAF) — skips npm ci/vite build/s3 sync entirely, delegating to
# infra/deploy.sh's own --skip-build mode after this script's safety gate
# passes. Same safety model as platform/auth/infra/
# config-deploy.sh (the reference implementation): diffs the LIVE stack's
# parameters against what .env.$ENV would produce today
# (infra/lib/params.sh — the same function infra/deploy.sh uses), and
# refuses outright (no CFN call at all) if a changed parameter isn't on
# infra/config-only-allowed-params.json's allowlist.
#
# This is the "category 1" axis. For a pure VITE_*-only change (baked into
# the JS bundle, never skippable regardless of CFN), see
# infra/content-deploy.sh instead — see docs/proposals/config-only-deploy/
# context.md for why these are two separate axes, not one.
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
echo " RealtyFlow CRM Frontend — Config-Only Deploy"
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
if [[ "$SERVICE_NAME" != realestateflow-* ]]; then
  echo "ERROR: SERVICE_NAME ('$SERVICE_NAME') must start with 'realestateflow-' — set it in $ENV_FILE"
  exit 1
fi
# No rebuild here, but deploy.sh --skip-build validates the same file anyway —
# fail before touching the live stack rather than after.
validate_api_domain_vars "$ENV_FILE"

BUCKET_NAME="${FRONTEND_S3_BUCKET_NAME:-${ENV}-${SERVICE_NAME}}"
STACK_NAME="${ENV}-${SERVICE_NAME}-stack"
PRICE_CLASS="${FRONTEND_PRICE_CLASS:-PriceClass_200}"
CUSTOM_DOMAIN_NAME="${FRONTEND_CUSTOM_DOMAIN_NAME:-}"
ACM_CERTIFICATE_ARN="${FRONTEND_ACM_CERTIFICATE_ARN:-}"
HOSTED_ZONE_ID="${FRONTEND_HOSTED_ZONE_ID:-}"
WAF_WEB_ACL_ARN="${FRONTEND_WAF_WEB_ACL_ARN:-}"
INSTA_FRONTEND_BUCKET_DOMAIN_NAME="${INSTA_FRONTEND_BUCKET_DOMAIN_NAME:-}"

if [ -n "$CUSTOM_DOMAIN_NAME" ] && [ -z "$ACM_CERTIFICATE_ARN" ]; then
  echo "ERROR: FRONTEND_CUSTOM_DOMAIN_NAME is set but FRONTEND_ACM_CERTIFICATE_ARN is missing in $ENV_FILE"
  exit 1
fi

echo "Region:  $AWS_REGION"
echo "Stack:   $STACK_NAME"
echo "Bucket:  $BUCKET_NAME"
echo "Env:     $ENV"
echo ""

echo "[1/4] Reading live stack parameters..."
if ! LIVE_PARAMS_JSON="$("$AWS_BIN" cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --region "$AWS_REGION" \
      --query "Stacks[0].Parameters" \
      --output json --no-cli-pager 2>/dev/null)"; then
  echo "ERROR: stack $STACK_NAME does not exist (or isn't reachable) — config-only mode requires an existing deployed stack."
  echo "Run a full deploy first: ./infra/deploy.sh $ENV"
  exit 1
fi

compute_param_values
MISSING_LIVE_PARAMS="$(node -e "
  const live = new Set(JSON.parse(process.argv[1]).map(p => p.ParameterKey));
  const wanted = process.argv.slice(2);
  console.log(wanted.filter(k => !live.has(k)).join(','));
" "$LIVE_PARAMS_JSON" "${PARAM_KEYS[@]}")"
if [ -n "$MISSING_LIVE_PARAMS" ]; then
  echo "ERROR: the live stack has no value for: $MISSING_LIVE_PARAMS."
  echo "That's a template change, not a pure parameter change. Run a full deploy: ./infra/deploy.sh $ENV"
  exit 1
fi

echo "[2/4] Computing desired parameter values from $(basename "$ENV_FILE")..."
ALLOWLIST_FILE="$SCRIPT_DIR/config-only-allowed-params.json"
if [ ! -f "$ALLOWLIST_FILE" ]; then
  echo "ERROR: $ALLOWLIST_FILE not found — config-only mode has no allowlist to check against, refusing to run blind."
  exit 1
fi

for k in "${PARAM_KEYS[@]}"; do export "PV_${k}=${PARAM_VALUES[$k]}"; done

DIFF_JSON="$(node -e "
  const live = JSON.parse(process.argv[1]);
  const liveMap = {};
  for (const p of live) liveMap[p.ParameterKey] = p.ParameterValue;
  const allowed = new Set(JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8')).allowedParams);
  const keys = process.argv.slice(3);

  const changed = {};
  const blocked = {};
  for (const key of keys) {
    const desired = process.env['PV_' + key];
    if (liveMap[key] === undefined) continue;
    const liveVal = liveMap[key];
    if (desired !== liveVal) {
      if (allowed.has(key)) changed[key] = { from: liveVal, to: desired };
      else blocked[key] = { from: liveVal, to: desired };
    }
  }
  process.stdout.write(JSON.stringify({ changed, blocked }));
" "$LIVE_PARAMS_JSON" "$ALLOWLIST_FILE" "${PARAM_KEYS[@]}")"

BLOCKED_COUNT="$(node -e "process.stdout.write(String(Object.keys(JSON.parse(process.argv[1]).blocked).length))" "$DIFF_JSON")"
CHANGED_COUNT="$(node -e "process.stdout.write(String(Object.keys(JSON.parse(process.argv[1]).changed).length))" "$DIFF_JSON")"

if [ "$BLOCKED_COUNT" -gt 0 ]; then
  echo ""
  echo "ERROR: config-only mode refuses to proceed — the following parameter(s)"
  echo "changed but are NOT on the config-only-safe allowlist ($ALLOWLIST_FILE):"
  node -e "
    const d = JSON.parse(process.argv[1]).blocked;
    for (const [k, v] of Object.entries(d)) console.log('  - ' + k + ': ' + JSON.stringify(v.from) + ' -> ' + JSON.stringify(v.to));
  " "$DIFF_JSON"
  echo ""
  echo "Run a full deploy instead: ./infra/deploy.sh $ENV"
  exit 1
fi

if [ "$CHANGED_COUNT" -eq 0 ]; then
  echo ""
  echo "No allowlisted parameter differs from the live stack — nothing to do."
  echo '{}' > "$SCRIPT_DIR/.last-config-diff.json"
  exit 0
fi

echo ""
echo "[3/4] The following parameter(s) will change:"
node -e "
  const d = JSON.parse(process.argv[1]).changed;
  for (const [k, v] of Object.entries(d)) console.log('  - ' + k + ': ' + JSON.stringify(v.from) + ' -> ' + JSON.stringify(v.to));
" "$DIFF_JSON"
echo ""

node -e "
  const d = JSON.parse(process.argv[1]);
  require('fs').writeFileSync(process.argv[2], JSON.stringify(d.changed, null, 2) + '\n');
" "$DIFF_JSON" "$SCRIPT_DIR/.last-config-diff.json"

if [ -n "$CUSTOM_DOMAIN_NAME" ]; then
  echo "(a first CloudFront distribution/custom-domain change takes 5-15 minutes to propagate)"
fi

echo "[4/4] Delegating to ./infra/deploy.sh $ENV --skip-build..."
"$SCRIPT_DIR/deploy.sh" "$ENV" --skip-build

cp "$SCRIPT_DIR/cfn-params.json" "$SCRIPT_DIR/.last-config-params.json" 2>/dev/null || true

echo ""
echo "============================================="
echo " Config-only deploy complete!"
echo "============================================="
