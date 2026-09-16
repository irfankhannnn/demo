#!/bin/bash
set -euo pipefail

# =============================================================================
# Instagram Solution Frontend — Config-Only Deploy
# =============================================================================
# Usage: ./infra/config-deploy.sh <dev|prod>
#
# For a CrmDistributionId-only change (wiring this bucket into the CRM's
# CloudFront distribution after the fact) — skips npm/vite build/s3 sync
# entirely, delegating to infra/deploy.sh's own --skip-build mode after this
# script's safety gate passes. Same safety model as reality-flow-
# authentication/infra/config-deploy.sh (the reference implementation).
#
# This is the "category 1" axis. For a pure VITE_*-only change, see
# infra/content-deploy.sh instead — see docs/proposals/config-only-deploy/
# context.md for why these are two separate axes, not one.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

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
echo " Instagram Solution Frontend — Config-Only Deploy"
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
ENVIRONMENT_NAME="$DEPLOY_ENV"

REQUIRED_VARS=(AWS_REGION AWS_PROFILE STACK_NAME BUCKET_NAME VITE_INSTA_API_DOMAIN_NAME VITE_INSTA_API_BASE_PATH VITE_CRM_URL)
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Required env var $var is not set in $ENV_FILE"
    exit 1
  fi
done

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/api-domain-guard.sh"
assert_frontend_api_domain_vars
if [[ "$STACK_NAME" != "${ENVIRONMENT_NAME}-realestateflow-"* ]]; then
  echo "ERROR: STACK_NAME ('$STACK_NAME') must start with '${ENVIRONMENT_NAME}-realestateflow-'"
  exit 1
fi

AWS_ARGS=(--region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager)

echo "Region:  $AWS_REGION"
echo "Stack:   $STACK_NAME"
echo "Bucket:  $BUCKET_NAME"
echo "Env:     $ENVIRONMENT_NAME"
echo ""

echo "[1/3] Reading live stack parameters..."
if ! LIVE_PARAMS_JSON="$("$AWS_BIN" cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --query "Stacks[0].Parameters" \
      --output json "${AWS_ARGS[@]}" 2>/dev/null)"; then
  echo "ERROR: stack $STACK_NAME does not exist (or isn't reachable) — config-only mode requires an existing deployed stack."
  echo "Run a full deploy first: ./infra/deploy.sh $ENVIRONMENT_NAME"
  exit 1
fi

echo "[2/3] Computing desired parameter values from $(basename "$ENV_FILE")..."
declare -A DESIRED=(
  [EnvironmentName]="$ENVIRONMENT_NAME"
  [BucketName]="$BUCKET_NAME"
  [CrmDistributionId]="${CRM_DISTRIBUTION_ID:-}"
)

ALLOWLIST_FILE="$SCRIPT_DIR/config-only-allowed-params.json"
ALLOWED_LIST="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).allowedParams.join(','))" "$ALLOWLIST_FILE")"

live_value_of() {
  node -e "const m=JSON.parse(process.argv[1]);for(const p of m)if(p.ParameterKey===process.argv[2])process.stdout.write(p.ParameterValue)" "$LIVE_PARAMS_JSON" "$1"
}

MISSING_KEYS=()
CHANGED_KEYS=()
BLOCKED_KEYS=()
for key in "${!DESIRED[@]}"; do
  if ! node -e "const m=JSON.parse(process.argv[1]);process.exit(m.some(p=>p.ParameterKey===process.argv[2])?0:1)" "$LIVE_PARAMS_JSON" "$key"; then
    MISSING_KEYS+=("$key"); continue
  fi
  live="$(live_value_of "$key")"
  desired="${DESIRED[$key]}"
  if [ "$live" != "$desired" ]; then
    case ",$ALLOWED_LIST," in
      *",$key,"*) CHANGED_KEYS+=("$key") ;;
      *) BLOCKED_KEYS+=("$key: '$live' -> '$desired'") ;;
    esac
  fi
done

if [ ${#MISSING_KEYS[@]} -gt 0 ]; then
  echo "ERROR: the live stack has no value for: ${MISSING_KEYS[*]}."
  echo "That's a template change, not a pure parameter change. Run a full deploy: ./infra/deploy.sh $ENVIRONMENT_NAME"
  exit 1
fi

if [ ${#BLOCKED_KEYS[@]} -gt 0 ]; then
  echo ""
  echo "ERROR: config-only mode refuses to proceed — the following parameter(s)"
  echo "changed but are NOT on the config-only-safe allowlist ($ALLOWLIST_FILE):"
  for b in "${BLOCKED_KEYS[@]}"; do echo "  - $b"; done
  echo ""
  echo "Run a full deploy instead: ./infra/deploy.sh $ENVIRONMENT_NAME"
  exit 1
fi

if [ ${#CHANGED_KEYS[@]} -eq 0 ]; then
  echo ""
  echo "No allowlisted parameter differs from the live stack — nothing to do."
  echo '{}' > "$SCRIPT_DIR/.last-config-diff.json"
  exit 0
fi

echo ""
echo "The following parameter(s) will change:"
for key in "${CHANGED_KEYS[@]}"; do
  echo "  - $key: '$(live_value_of "$key")' -> '${DESIRED[$key]}'"
done
{
  echo "{"
  n=${#CHANGED_KEYS[@]}
  i=0
  for key in "${CHANGED_KEYS[@]}"; do
    i=$((i + 1))
    live="$(live_value_of "$key")"
    desired="${DESIRED[$key]}"
    comma=","
    [ "$i" -eq "$n" ] && comma=""
    printf '  "%s": { "from": %s, "to": %s }%s\n' \
      "$key" \
      "$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$live")" \
      "$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$desired")" \
      "$comma"
  done
  echo "}"
} > "$SCRIPT_DIR/.last-config-diff.json"
echo ""

echo "[3/3] Delegating to ./infra/deploy.sh $ENVIRONMENT_NAME --skip-build..."
"$SCRIPT_DIR/deploy.sh" "$ENVIRONMENT_NAME" --skip-build

echo ""
echo "============================================="
echo " Config-only deploy complete!"
echo "============================================="
