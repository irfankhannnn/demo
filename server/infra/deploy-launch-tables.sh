#!/bin/bash
set -euo pipefail

# =============================================================================
# RealEstateFlow Launch Tables — Deployment Script
# =============================================================================
# Usage: ./infra/deploy-launch-tables.sh <dev|prod>
#   Deploys server/infra/launch-tables-cfn.yaml — the DynamoDB tables shared
#   by server + reality-flow-authentication that are NOT owned by
#   cfn-backend.yaml: Grievances, WebhookLog, TenantApiKeys, Subscriptions,
#   NPSResponses, BetaInvites. (AIEmployeeProvisioning is deliberately NOT
#   here — cfn-backend.yaml owns that one; see the comment in
#   launch-tables-cfn.yaml.)
#
#   Loads .env.launch-tables.dev or .env.launch-tables.prod (never a plain
#   .env) and forces EnvironmentName to match the argument, so every table
#   is named <dev|prod>-realestateflow-<table>, matching the convention
#   already live on prod-realestateflow-networking-common.
#
#   This is a separate script (not server/infra/deploy.sh) and a separate
#   stack (${ENV}-realestateflow-tables-stack, not the cfn-backend.yaml
#   stack) because launch-tables-cfn.yaml has its own lifecycle — it's pure
#   DynamoDB (DeletionPolicy: Retain everywhere), no Lambda/API Gateway, and
#   cfn-backend.yaml only ever *references* its table names as parameters,
#   never creates them (see cfn-backend.yaml's GrievancesTableName etc.
#   parameter descriptions).
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# -----------------------------------------------------------------------------
# Windows Git Bash compatibility
# -----------------------------------------------------------------------------
OS_UNAME="$(uname -s || echo '')"
AWS_BIN="aws"
case "$OS_UNAME" in
  MINGW*|MSYS*|CYGWIN*)
    if command -v aws.exe >/dev/null 2>&1; then AWS_BIN="aws.exe"; fi
    ;;
esac

if ! command -v "$AWS_BIN" >/dev/null 2>&1; then
  echo "ERROR: $AWS_BIN not found in PATH (AWS CLI required)"
  exit 1
fi

echo "============================================="
echo " RealEstateFlow Launch Tables — Deploy"
echo "============================================="

# -----------------------------------------------------------------------------
# 0. Require an explicit dev|prod argument and load the matching env file
# -----------------------------------------------------------------------------
DEPLOY_ENV="${1:-}"
if [ "$DEPLOY_ENV" != "dev" ] && [ "$DEPLOY_ENV" != "prod" ]; then
  echo "ERROR: Usage: $0 <dev|prod>"
  echo "  e.g. ./infra/deploy-launch-tables.sh dev"
  echo "       ./infra/deploy-launch-tables.sh prod"
  exit 1
fi

ENV_FILE="$PROJECT_DIR/.env.launch-tables.${DEPLOY_ENV}"

# -----------------------------------------------------------------------------
# 1. Load and validate the environment file
# -----------------------------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found at $ENV_FILE"
  echo "Copy .env.launch-tables.${DEPLOY_ENV}.sample to $ENV_FILE and fill in the values."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# The CLI argument is the source of truth, not whatever the env file
# happens to set — this is what stops a dev deploy from silently reusing
# prod's table names (or vice versa) if the file drifts.
ENV="$DEPLOY_ENV"

echo "Deploy target: $DEPLOY_ENV (env file: $(basename "$ENV_FILE"))"
echo ""

REQUIRED_VARS=(
  AWS_REGION
  ARTIFACT_BUCKET
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Required env var $var is not set in $ENV_FILE"
    exit 1
  fi
done

STACK_NAME="${ENV}-realestateflow-tables-stack"

echo "Region:     $AWS_REGION"
echo "Stack:      $STACK_NAME"
echo "Env:        $ENV"
echo ""

# -----------------------------------------------------------------------------
# 2. Deploy CloudFormation stack
# -----------------------------------------------------------------------------
# No CAPABILITY_* flag needed — launch-tables-cfn.yaml declares only
# AWS::DynamoDB::Table resources, no IAM.
echo "[1/2] Deploying CloudFormation stack: $STACK_NAME..."
"$AWS_BIN" cloudformation deploy \
  --template-file "$SCRIPT_DIR/launch-tables-cfn.yaml" \
  --stack-name "$STACK_NAME" \
  --parameter-overrides "EnvironmentName=${ENV}" \
  --region "$AWS_REGION" \
  --no-cli-pager \
  --no-fail-on-empty-changeset

# -----------------------------------------------------------------------------
# 3. Archive the template to the shared artifact bucket for build tracking
# -----------------------------------------------------------------------------
# Content-hashed key (like auth-explicit-routes.yaml's approach) so every
# template change gets its own permanent, never-overwritten object — the
# wrapper (cfn-templates-cicd/launch-tables/deploy.sh) reads this back to
# record the build and to snapshot for rollback-full.
TEMPLATE_HASH="$(node -e "const fs=require('fs');const crypto=require('crypto');process.stdout.write(crypto.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex').slice(0,12))" "$SCRIPT_DIR/launch-tables-cfn.yaml")"
TEMPLATE_KEY="realestateflow-launch-tables/launch-tables-cfn-${TEMPLATE_HASH}.yaml"
echo "[2/2] Archiving template to s3://${ARTIFACT_BUCKET}/${TEMPLATE_KEY}..."
"$AWS_BIN" s3 cp "$SCRIPT_DIR/launch-tables-cfn.yaml" "s3://${ARTIFACT_BUCKET}/${TEMPLATE_KEY}" --region "$AWS_REGION" --no-cli-pager

cat > "$SCRIPT_DIR/.last-launch-tables-deploy-artifacts.json" <<EOF
{
  "artifactBucket": "${ARTIFACT_BUCKET}",
  "templateS3Key": "${TEMPLATE_KEY}"
}
EOF

echo ""
echo "============================================="
echo " Deploy complete!"
echo "============================================="

echo ""
echo "Stack outputs:"
"$AWS_BIN" cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --no-cli-pager \
  --query "Stacks[0].Outputs" \
  --output table

echo ""
echo "Done."
