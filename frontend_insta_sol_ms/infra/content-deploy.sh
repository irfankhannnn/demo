#!/bin/bash
set -euo pipefail

# =============================================================================
# Instagram Solution Frontend — Content-Only Deploy
# =============================================================================
# Usage: ./infra/content-deploy.sh <dev|prod>
#
# For a pure VITE_*-only change: rebuild + re-sync content, but skip the
# CloudFormation update if CrmDistributionId hasn't also changed. This is
# the "category 3" axis from docs/proposals/config-only-deploy/context.md
# — see infra/config-deploy.sh for the complementary "category 1" axis.
#
# Safety gate: refuses (no --skip-cfn) if the live stack's CrmDistributionId
# differs from what .env.$ENV would produce — that needs a real CFN update.
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
echo " Instagram Solution Frontend — Content-Only Deploy"
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

AWS_ARGS=(--region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager)

echo "Region:  $AWS_REGION"
echo "Stack:   $STACK_NAME"
echo "Bucket:  $BUCKET_NAME"
echo "Env:     $ENVIRONMENT_NAME"
echo ""

echo "[1/2] Verifying no CFN parameter has changed..."
if ! LIVE_PARAMS_JSON="$("$AWS_BIN" cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --query "Stacks[0].Parameters" \
      --output json "${AWS_ARGS[@]}" 2>/dev/null)"; then
  echo "ERROR: stack $STACK_NAME does not exist (or isn't reachable) — content-only mode requires an existing deployed stack."
  echo "Run a full deploy first: ./infra/deploy.sh $ENVIRONMENT_NAME"
  exit 1
fi

declare -A DESIRED=(
  [EnvironmentName]="$ENVIRONMENT_NAME"
  [BucketName]="$BUCKET_NAME"
  [CrmDistributionId]="${CRM_DISTRIBUTION_ID:-}"
)

MISSING_KEYS=()
CHANGED_KEYS=()
for key in "${!DESIRED[@]}"; do
  if ! node -e "const m=JSON.parse(process.argv[1]);process.exit(m.some(p=>p.ParameterKey===process.argv[2])?0:1)" "$LIVE_PARAMS_JSON" "$key"; then
    MISSING_KEYS+=("$key"); continue
  fi
  live="$(node -e "const m=JSON.parse(process.argv[1]);for(const p of m)if(p.ParameterKey===process.argv[2])process.stdout.write(p.ParameterValue)" "$LIVE_PARAMS_JSON" "$key")"
  if [ "$live" != "${DESIRED[$key]}" ]; then
    CHANGED_KEYS+=("$key: '$live' -> '${DESIRED[$key]}'")
  fi
done

if [ ${#MISSING_KEYS[@]} -gt 0 ] || [ ${#CHANGED_KEYS[@]} -gt 0 ]; then
  echo ""
  echo "ERROR: content-only mode refuses to proceed — at least one CFN parameter"
  echo "would also change, which needs a real CloudFormation update:"
  for k in "${MISSING_KEYS[@]}"; do echo "  - $k: declared in template but not on the live stack (template changed)"; done
  for c in "${CHANGED_KEYS[@]}"; do echo "  - $c"; done
  echo ""
  echo "Run a full deploy instead: ./infra/deploy.sh $ENVIRONMENT_NAME"
  exit 1
fi

echo "  No CFN parameter changed — safe to skip the CloudFormation update."
echo ""
echo "[2/2] Delegating to ./infra/deploy.sh $ENVIRONMENT_NAME --skip-cfn..."
"$SCRIPT_DIR/deploy.sh" "$ENVIRONMENT_NAME" --skip-cfn

echo ""
echo "============================================="
echo " Content-only deploy complete!"
echo "============================================="
