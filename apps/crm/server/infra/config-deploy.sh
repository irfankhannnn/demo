#!/bin/bash
set -euo pipefail

# =============================================================================
# CRM Backend Microservice — Config-Only Deploy
# =============================================================================
# Usage: ./infra/config-deploy.sh <dev|prod>
#
# This service's config-only path is NOT a CloudFormation parameter update
# at all — it doesn't need to be. ~100 of this template's ~120 CFN
# parameters are consumed by the app at Lambda cold start via SSM Parameter
# Store (see apps/crm/server/config/ssmBootstrap.js), not via CFN Environment.Variables
# — a migration made specifically to escape Lambda's 4KB env var limit. That
# means changing one of those ~100 values already never needed a CFN update
# to begin with; it only ever needed:
#   1. apps/crm/server/infra/sync-ssm-params.sh (already exists, already idempotent —
#      diffs desired vs. live SSM values and creates/updates/deletes only
#      what changed).
#   2. Something to make the running Lambdas pick up the new SSM values —
#      ssmBootstrap.js fetches SSM exactly ONCE per execution environment
#      and caches it (see hydratePromise there), so a warm container keeps
#      serving the OLD values until it's naturally recycled (which can take
#      a long time) unless something forces fresh execution environments
#      sooner. Updating a Lambda's configuration does that: AWS Lambda
#      invalidates existing execution environments on any configuration
#      change, so subsequent invocations get a fresh container that
#      re-hydrates from SSM. This script does a no-op-value "touch" of a
#      CONFIG_APPLIED_AT env var via update-function-configuration for
#      exactly this reason — see force_cold_start() below.
#
# The remaining ~20 parameters (LambdaMemorySize, LambdaRuntime, the table
# names this template itself CREATES, domain/base-path/stage settings,
# DeployApiRoutePart2, the two ApiGatewayRoutesTemplateUrl* keys, S3BucketName,
# LambdaCodeS3Key/Bucket, CallRecordingQueueRetentionSeconds, FounderWhatsApp)
# are real CFN parameters wired into resource properties — those still
# require a full deploy (infra/deploy.sh) to change. This script refuses to
# proceed if a value in .env.$ENV would change one of them.
#
# So the allowlist here isn't a hand-maintained file — it IS
# infra/ssm-param-map.txt (its CFN-parameter-name column): a parameter is
# config-only-safe here precisely because, and only because, it's SSM-synced.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/generate-cfn-params.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/validate-service-endpoints.sh"

AWS_BIN="aws"
case "$(uname -s || echo '')" in
  MINGW*|MSYS*|CYGWIN*)
    if command -v aws.exe >/dev/null 2>&1; then AWS_BIN="aws.exe"; fi
    ;;
esac

# Deliberately NOT setting MSYS_NO_PATHCONV here (unlike sync-ssm-params.sh,
# which needs it for its own /-prefixed --name/--path SSM arguments) — this
# script never calls `aws ssm` directly, it delegates that entirely to
# sync-ssm-params.sh as a child process (which sets its own, scoped to
# itself). Setting it here would instead break every plain POSIX-path
# argument this script hands to `node` and `aws cloudformation`.

if ! command -v "$AWS_BIN" >/dev/null 2>&1; then
  echo "ERROR: $AWS_BIN not found in PATH (AWS CLI required)"
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found in PATH (used here only for safe JSON handling)"
  exit 1
fi

echo "============================================="
echo " CRM Backend — Config-Only Deploy"
echo "============================================="

# -----------------------------------------------------------------------------
# 0. Require an explicit dev|prod argument and load the matching env file
#    (identical guard to infra/deploy.sh, on purpose)
# -----------------------------------------------------------------------------
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

REQUIRED_VARS=(
  AWS_REGION
  STACK_NAME
  ARTIFACT_BUCKET
  ARTIFACT_PREFIX
  PUBLIC_API_DOMAIN_NAME
  CRM_API_DOMAIN_NAME
  AUTH_SERVICE_DOMAIN_NAME
  AUTH_SERVICE_BASE_PATH
)
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Required env var $var is not set in $ENV_FILE"
    exit 1
  fi
done

# Custom-domain guard: every API endpoint is a <STEM>_DOMAIN_NAME +
# <STEM>_BASE_PATH pair on an API Gateway custom domain, never a raw
# execute-api URL (see lib/validate-service-endpoints.sh).
if ! validate_service_endpoints "$ENV_FILE"; then
  echo "Fix the custom-domain settings in $ENV_FILE before deploying."
  exit 1
fi

if [[ "$STACK_NAME" != "${ENVIRONMENT_NAME}-realestateflow-"* ]]; then
  echo "ERROR: STACK_NAME ('$STACK_NAME') must start with '${ENVIRONMENT_NAME}-realestateflow-' — set it in $ENV_FILE"
  exit 1
fi

echo "Region:  $AWS_REGION"
echo "Stack:   $STACK_NAME"
echo "Env:     $ENVIRONMENT_NAME"
echo ""

# -----------------------------------------------------------------------------
# 1. The stack must already exist.
# -----------------------------------------------------------------------------
echo "[1/5] Reading live stack parameters..."
if ! LIVE_PARAMS_JSON="$("$AWS_BIN" cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --region "$AWS_REGION" \
      --query "Stacks[0].Parameters" \
      --output json --no-cli-pager 2>/dev/null)"; then
  echo "ERROR: stack $STACK_NAME does not exist (or isn't reachable) — config-only mode requires an existing deployed stack."
  echo "Run a full deploy first: ./infra/deploy.sh $ENVIRONMENT_NAME"
  exit 1
fi

# -----------------------------------------------------------------------------
# 2. Regenerate cfn-params.json fresh from .env.$ENV (a cheap, local, no-AWS
#    operation — the same generator infra/deploy.sh uses). The three
#    deploy-mechanics values are irrelevant here (never diffed, never
#    consulted by sync-ssm-params.sh) so they're passed as empty/default.
# -----------------------------------------------------------------------------
echo "[2/5] Generating infra/cfn-params.json from $(basename "$ENV_FILE")..."
write_cfn_params_json "$SCRIPT_DIR/cfn-params.json" "" "" "" "true"

MAP_FILE="$SCRIPT_DIR/ssm-param-map.txt"
if [ ! -f "$MAP_FILE" ]; then
  echo "ERROR: $MAP_FILE not found — cannot determine which parameters are config-only-safe."
  exit 1
fi

# Parameters that are real CFN-template-wired values (not SSM-synced) but
# that this script must never diff/block on anyway:
#   LambdaCodeS3Key, ApiGatewayRoutesTemplateUrl(Part2) — always freshly
#     produced by a real deploy's artifact upload; this script never
#     computes a meaningful value for them (passed "" above on purpose).
#   DeployApiRoutePart2 — deploy-migration bookkeeping, not env-var-driven.
#   FounderWhatsApp — NoEcho AND not SSM-synced (see cfn-backend.yaml:2688,
#     a direct !Ref on a 4th Lambda that doesn't use ssmBootstrap.js).
#     describe-stacks can only return '****' for it, which would make every
#     run look like a "change" and false-block on it. Excluded rather than
#     mis-detected — if you need to change FOUNDER_WHATSAPP, use a full
#     deploy; config-only mode silently cannot verify or apply it.
EXCLUDE_FROM_DIFF="LambdaCodeS3Key,ApiGatewayRoutesTemplateUrl,ApiGatewayRoutesTemplateUrlPart2,DeployApiRoutePart2,FounderWhatsApp"

DIFF_JSON="$(node -e "
  const fs = require('fs');
  const live = JSON.parse(process.argv[1]);
  const liveMap = {};
  for (const p of live) liveMap[p.ParameterKey] = p.ParameterValue;

  const desired = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

  const mapLines = fs.readFileSync(process.argv[3], 'utf8').split('\n');
  const allowed = new Set();
  for (const raw of mapLines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    allowed.add(line.slice(eq + 1));
  }
  const excluded = new Set(process.argv[4].split(','));

  const missing = [];
  const blocked = {};
  for (const p of desired) {
    const key = p.ParameterKey;
    if (excluded.has(key)) continue;
    if (!(key in liveMap)) { missing.push(key); continue; }
    if (allowed.has(key)) continue; // SSM-synced — sync-ssm-params.sh handles it, never blocks
    if (p.ParameterValue !== liveMap[key]) blocked[key] = { from: liveMap[key], to: p.ParameterValue };
  }
  process.stdout.write(JSON.stringify({ missing, blocked }));
" "$LIVE_PARAMS_JSON" "$SCRIPT_DIR/cfn-params.json" "$MAP_FILE" "$EXCLUDE_FROM_DIFF")"

MISSING_COUNT="$(node -e "process.stdout.write(String(JSON.parse(process.argv[1]).missing.length))" "$DIFF_JSON")"
if [ "$MISSING_COUNT" -gt 0 ]; then
  echo "ERROR: the live stack has no value for some parameter(s) cfn-backend.yaml declares:"
  node -e "JSON.parse(process.argv[1]).missing.forEach(k => console.log('  - ' + k))" "$DIFF_JSON"
  echo "That's a template change, not a pure config change. Run a full deploy: ./infra/deploy.sh $ENVIRONMENT_NAME"
  exit 1
fi

BLOCKED_COUNT="$(node -e "process.stdout.write(String(Object.keys(JSON.parse(process.argv[1]).blocked).length))" "$DIFF_JSON")"
if [ "$BLOCKED_COUNT" -gt 0 ]; then
  echo ""
  echo "ERROR: config-only mode refuses to proceed — the following parameter(s) changed"
  echo "but are NOT SSM-synced (see $MAP_FILE) — they're wired directly into CFN resource"
  echo "properties and need a real CloudFormation update:"
  node -e "
    const d = JSON.parse(process.argv[1]).blocked;
    for (const [k, v] of Object.entries(d)) console.log('  - ' + k + ': ' + JSON.stringify(v.from) + ' -> ' + JSON.stringify(v.to));
  " "$DIFF_JSON"
  echo ""
  echo "Run a full deploy instead: ./infra/deploy.sh $ENVIRONMENT_NAME"
  exit 1
fi

# -----------------------------------------------------------------------------
# 3. Sync SSM Parameter Store — reuses the existing, already-idempotent
#    script unchanged (it does its own create/update/delete diffing).
# -----------------------------------------------------------------------------
echo "[3/5] Syncing config to SSM Parameter Store..."
"$SCRIPT_DIR/sync-ssm-params.sh" "$ENVIRONMENT_NAME"

SSM_PLAN_FILE="$SCRIPT_DIR/.last-ssm-sync-plan.json"
if [ ! -f "$SSM_PLAN_FILE" ]; then
  echo '{"created":[],"updated":[],"deleted":[]}' > "$SSM_PLAN_FILE"
fi
CHANGED_COUNT="$(node -e "
  const p = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  process.stdout.write(String(p.created.length + p.updated.length + p.deleted.length));
" "$SSM_PLAN_FILE")"

if [ "$CHANGED_COUNT" -eq 0 ]; then
  echo ""
  echo "No SSM parameter actually changed — nothing to do (skipping the cold-start touch)."
  exit 0
fi

# -----------------------------------------------------------------------------
# 4. Force fresh execution environments on the SSM-consuming Lambdas, so
#    already-warm containers stop serving stale values. A Lambda
#    configuration update (any change, even a no-op value) invalidates
#    existing execution environments — this is the standard, documented way
#    to force that without publishing new code. Fetches each Lambda's full
#    current Environment.Variables first and merges in just one marker key,
#    since update-function-configuration REPLACES the whole Variables map
#    with whatever is passed, not merges it — passing a partial map would
#    wipe NODE_ENV/SSM_CONFIG_PATH.
# -----------------------------------------------------------------------------
echo "[4/5] Forcing fresh execution environments (SSM cache is per-container, cold-start only)..."
CONFIG_TOUCH_LAMBDAS=(
  "${ENVIRONMENT_NAME}-realestateflow-api"
  "${ENVIRONMENT_NAME}-realestateflow-call-recording-worker"
  "${ENVIRONMENT_NAME}-realestateflow-meeting-reminder"
)
force_cold_start() {
  local fn="$1"
  local current_env
  if ! current_env="$("$AWS_BIN" lambda get-function-configuration \
        --function-name "$fn" --region "$AWS_REGION" \
        --query "Environment.Variables" --output json --no-cli-pager 2>/dev/null)"; then
    echo "  Skipping $fn (not found)."
    return 0
  fi
  local merged
  merged="$(node -e "
    const vars = JSON.parse(process.argv[1] === 'null' ? '{}' : process.argv[1]);
    vars.CONFIG_APPLIED_AT = new Date().toISOString();
    process.stdout.write(JSON.stringify({ Variables: vars }));
  " "$current_env")"
  echo "  Touching $fn..."
  "$AWS_BIN" lambda update-function-configuration \
    --function-name "$fn" \
    --environment "$merged" \
    --region "$AWS_REGION" \
    --no-cli-pager >/dev/null
}
for fn in "${CONFIG_TOUCH_LAMBDAS[@]}"; do
  force_cold_start "$fn"
done

echo ""
echo "============================================="
echo " Config-only deploy complete!"
echo "============================================="
echo "[5/5] $CHANGED_COUNT SSM parameter(s) changed; cold-start touch applied."
