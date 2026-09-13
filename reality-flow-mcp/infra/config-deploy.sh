#!/bin/bash
set -euo pipefail

# =============================================================================
# RealtyFlow MCP Microservice — Config-Only Deploy
# =============================================================================
# Usage: ./infra/config-deploy.sh <dev|test|prod>
#
# Unlike every other service's config-deploy.sh, this one does not build its
# own `aws cloudformation deploy` call — deploy.sh already has a
# `--skip-package` flag that does exactly "skip npm/build/zip/upload,
# regenerate cfn-params.json fresh, deploy CFN" (its own header comment:
# "Useful when Lambda code hasn't changed and you only want to update stack
# parameters/resources"). This script's only job is the safety gate every
# other service's config-deploy.sh has in front of that already-existing,
# already-tested path: diff the live stack's parameters against what .env
# would produce today, and refuse outright if a parameter that would change
# isn't on the allowlist (config-only-allowed-params.json) — never silently
# apply an unreviewed change, never silently drop one either.
#
# NOTE: this service's CI/CD wrapper (cfn-templates-cicd/reality-flow-mcp/
# deploy.sh) is a thin `exec` into infra/deploy.sh (2026-09-14; it used to
# carry duplicate copies of deploy.sh and cfn-backend.yaml). It has no
# deploy-versions/ or config-versions/ tracking, unlike auth/server.
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
echo " RealtyFlow MCP — Config-Only Deploy"
echo "============================================="

ENV_ARG="${1:-}"
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "ERROR: .env file not found at $PROJECT_DIR/.env"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$PROJECT_DIR/.env"
set +a

if [ -n "$ENV_ARG" ]; then
  ENV="$ENV_ARG"
fi
ENV="${ENV:-dev}"
case "$ENV" in
  dev|test|prod) ;;
  *)
    echo "ERROR: environment must be dev, test, or prod (got: '$ENV')"
    exit 1
    ;;
esac

SERVICE_NAME="${SERVICE_NAME:-realtyflow-mcp}"
REGION="${AWS_REGION:-ap-south-1}"
STACK_NAME="${ENV}-${SERVICE_NAME}-stack"

echo "Region:  $REGION"
echo "Stack:   $STACK_NAME"
echo "Service: $SERVICE_NAME"
echo "Env:     $ENV"
echo ""

echo "[1/3] Reading live stack parameters..."
if ! LIVE_PARAMS_JSON="$("$AWS_BIN" cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --region "$REGION" \
      --query "Stacks[0].Parameters" \
      --output json --no-cli-pager 2>/dev/null)"; then
  echo "ERROR: stack $STACK_NAME does not exist (or isn't reachable) — config-only mode requires an existing deployed stack."
  echo "Run a full deploy first: ./infra/deploy.sh $ENV"
  exit 1
fi

echo "[2/3] Computing desired parameter values from .env..."
# Every value here is directly derivable from .env with the exact same
# defaults infra/deploy.sh's own cfn-params.json heredoc uses — including
# LambdaCodeS3Key, which unlike most other services' equivalent is a fixed,
# never-timestamped key (${ServiceName}/function.zip). Nothing here needs
# special "always use the live value" treatment the way a timestamped code
# key or a freshly-uploaded nested-template URL would elsewhere in this
# repo — a genuine change to any of these IS something a human could have
# typed into .env, so every key is safe to diff normally.
declare -A DESIRED=(
  [ServiceName]="$SERVICE_NAME"
  [Env]="$ENV"
  [LambdaMemorySize]="${LAMBDA_MEMORY_SIZE:-512}"
  [LambdaTimeout]="${LAMBDA_TIMEOUT:-30}"
  [LogRetentionInDays]="${LOG_RETENTION_IN_DAYS:-30}"
  [LambdaPackagesBucketName]="${LAMBDA_PACKAGES_BUCKET_NAME:-realestate-flow-lambda-packages}"
  [LambdaCodeS3Key]="${SERVICE_NAME}/function.zip"
  [OAuthCodesTableName]="${OAUTH_CODES_TABLE_NAME:-realtyflow-oauth-codes}"
  [OAuthConnectionsTableName]="${OAUTH_CONNECTIONS_TABLE:-realtyflow-oauth-connections}"
  [JWTSecret]="${JWT_SECRET:-}"
  [JWTRefreshSecret]="${JWT_REFRESH_SECRET:-}"
  [CrmApiDomainName]="${CRM_API_DOMAIN_NAME:-}"
  [CrmApiBasePath]="${CRM_API_BASE_PATH:-}"
  [CrmApiInternalKey]="${CRM_API_INTERNAL_KEY:-}"
  [AuthServiceDomainName]="${AUTH_SERVICE_DOMAIN_NAME:-}"
  [AuthServiceBasePath]="${AUTH_SERVICE_BASE_PATH:-}"
  [AllowedOrigins]="${ALLOWED_ORIGINS:-http://localhost:3000,http://localhost:5173}"
  [FrontendUrl]="${FRONTEND_URL:-http://localhost:3000}"
  [McpApiDomainName]="${MCP_API_DOMAIN_NAME:-}"
  [McpApiBasePath]="${MCP_API_BASE_PATH:-}"
  [EnableCustomDomainMapping]="${ENABLE_CUSTOM_DOMAIN_MAPPING:-false}"
  [EnableBasePathStrip]="${ENABLE_BASE_PATH_STRIP:-false}"
)
# Must stay key-for-key identical to infra/deploy.sh's PARAM_OVERRIDES (that
# script also runs the custom-domain guard on these values when this one
# delegates to it below).

ALLOWLIST_FILE="$SCRIPT_DIR/config-only-allowed-params.json"
if [ ! -f "$ALLOWLIST_FILE" ]; then
  echo "ERROR: $ALLOWLIST_FILE not found — config-only mode has no allowlist to check against, refusing to run blind."
  exit 1
fi
ALLOWED_LIST="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).allowedParams.join(','))" "$ALLOWLIST_FILE")"

# NoEcho params — describe-stacks masks these as '****', so they're
# forwarded from .env as-is, never diffed/blocked on.
NOECHO_PARAMS="JWTSecret,JWTRefreshSecret,CrmApiInternalKey"

live_value_of() {
  node -e "const m=JSON.parse(process.argv[1]);for(const p of m)if(p.ParameterKey===process.argv[2])process.stdout.write(p.ParameterValue)" "$LIVE_PARAMS_JSON" "$1"
}

MISSING_KEYS=()
CHANGED_KEYS=()
BLOCKED_KEYS=()
for key in "${!DESIRED[@]}"; do
  live="$(live_value_of "$key")"
  if [ -z "$live" ] && ! node -e "const m=JSON.parse(process.argv[1]);process.exit(m.some(p=>p.ParameterKey===process.argv[2])?0:1)" "$LIVE_PARAMS_JSON" "$key"; then
    MISSING_KEYS+=("$key")
    continue
  fi
  case ",$NOECHO_PARAMS," in *",$key,"*) continue ;; esac
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
  echo "That's a template change, not a pure parameter change. Run a full deploy: ./infra/deploy.sh $ENV"
  exit 1
fi

if [ ${#BLOCKED_KEYS[@]} -gt 0 ]; then
  echo ""
  echo "ERROR: config-only mode refuses to proceed — the following parameter(s)"
  echo "changed but are NOT on the config-only-safe allowlist ($ALLOWLIST_FILE):"
  for b in "${BLOCKED_KEYS[@]}"; do echo "  - $b"; done
  echo ""
  echo "Run a full deploy instead: ./infra/deploy.sh $ENV"
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

echo "[3/3] Delegating to ./infra/deploy.sh $ENV --skip-package..."
"$SCRIPT_DIR/deploy.sh" "$ENV" --skip-package

echo ""
echo "============================================="
echo " Config-only deploy complete!"
echo "============================================="
