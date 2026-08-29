#!/bin/bash
set -euo pipefail

# =============================================================================
# Instagram Solution frontend - Deployment Script
# =============================================================================
# Usage: ./infra/deploy.sh <dev|prod>
#
# Builds the Vite app against .env.<env>, deploys the S3 bucket stack, syncs
# dist/ into the bucket under the "insta/" key prefix, and invalidates the CRM
# CloudFront distribution's /insta/* path if one is configured.
#
# KEY PREFIX: objects land at s3://<bucket>/insta/... , not at the bucket root.
# The CRM distribution's /insta/* behavior forwards the full request path to
# this origin (there is no OriginPath), so the S3 key has to include "insta/"
# for /insta/index.html to resolve. vite.config.ts sets base: "/insta/" to match,
# and the SPA rewrite CloudFront function rewrites to /insta/index.html.
# These three must stay in agreement - changing one breaks the app.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

OS_UNAME="$(uname -s || echo '')"
NPM_BIN="npm"
AWS_BIN="aws"
case "$OS_UNAME" in
  MINGW*|MSYS*|CYGWIN*)
    if command -v npm.cmd >/dev/null 2>&1; then NPM_BIN="npm.cmd"; fi
    if command -v aws.exe >/dev/null 2>&1; then AWS_BIN="aws.exe"; fi
    ;;
esac

winpath() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"
  elif command -v wslpath >/dev/null 2>&1; then wslpath -m "$1"
  else echo "$1"; fi
}

for bin in "$NPM_BIN" "$AWS_BIN"; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: $bin not found in PATH"
    exit 1
  fi
done

echo "============================================="
echo " Instagram Solution frontend - Deploy"
echo "============================================="

DEPLOY_ENV="${1:-}"
if [ "$DEPLOY_ENV" != "dev" ] && [ "$DEPLOY_ENV" != "prod" ]; then
  echo "ERROR: Usage: $0 <dev|prod>"
  exit 1
fi

ENV_FILE="$PROJECT_DIR/.env.${DEPLOY_ENV}"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found at $ENV_FILE"
  echo "Copy frontend_insta_sol_ms/.env.sample to $ENV_FILE and fill in the values."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

ENVIRONMENT_NAME="$DEPLOY_ENV"

REQUIRED_VARS=(AWS_REGION AWS_PROFILE STACK_NAME BUCKET_NAME VITE_API_BASE_URL VITE_CRM_URL)
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Required env var $var is not set in $ENV_FILE"
    exit 1
  fi
done

if [[ "$STACK_NAME" != "${ENVIRONMENT_NAME}-realestateflow-"* ]]; then
  echo "ERROR: STACK_NAME ('$STACK_NAME') must start with '${ENVIRONMENT_NAME}-realestateflow-'"
  exit 1
fi
if [[ "$BUCKET_NAME" != "${ENVIRONMENT_NAME}-realestateflow-insta-"* ]]; then
  echo "ERROR: BUCKET_NAME ('$BUCKET_NAME') must start with '${ENVIRONMENT_NAME}-realestateflow-insta-'"
  exit 1
fi

AWS_ARGS=(--region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager)
CALLER_ACCOUNT="$("$AWS_BIN" sts get-caller-identity "${AWS_ARGS[@]}" --query Account --output text)"

echo "Deploy target: $DEPLOY_ENV"
echo "AWS account:   $CALLER_ACCOUNT"
echo "Stack:         $STACK_NAME"
echo "Bucket:        $BUCKET_NAME"
echo "API base:      $VITE_API_BASE_URL"
echo "CRM URL:       $VITE_CRM_URL"
echo ""

TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")

# -----------------------------------------------------------------------------
# 1. Build
# -----------------------------------------------------------------------------
echo "[1/5] Installing dependencies..."
cd "$PROJECT_DIR"
"$NPM_BIN" ci --no-audit --no-fund 2>/dev/null || "$NPM_BIN" install --no-audit --no-fund

echo "[2/5] Building (vite, mode=$DEPLOY_ENV)..."
rm -rf "$PROJECT_DIR/dist"
"$NPM_BIN" run build

if [ ! -f "$PROJECT_DIR/dist/index.html" ]; then
  echo "ERROR: build produced no dist/index.html"
  exit 1
fi

# -----------------------------------------------------------------------------
# 2. Deploy the bucket stack
# -----------------------------------------------------------------------------
echo "[3/5] Generating infra/cfn-params.json and deploying $STACK_NAME..."
cat > "$SCRIPT_DIR/cfn-params.json" <<EOF
[
  { "ParameterKey": "EnvironmentName", "ParameterValue": "${ENVIRONMENT_NAME}" },
  { "ParameterKey": "BucketName", "ParameterValue": "${BUCKET_NAME}" },
  { "ParameterKey": "CrmDistributionId", "ParameterValue": "${CRM_DISTRIBUTION_ID:-}" }
]
EOF

"$AWS_BIN" cloudformation deploy \
  --template-file "$(winpath "$SCRIPT_DIR/cfn-insta-frontend.yaml")" \
  --stack-name "$STACK_NAME" \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT_NAME" Service=realestateflow-insta-frontend \
  --parameter-overrides \
    EnvironmentName="$ENVIRONMENT_NAME" \
    BucketName="$BUCKET_NAME" \
    CrmDistributionId="${CRM_DISTRIBUTION_ID:-}" \
  "${AWS_ARGS[@]}"

if [ -z "${CRM_DISTRIBUTION_ID:-}" ]; then
  echo ""
  echo "      NOTE: CRM_DISTRIBUTION_ID is empty, so no bucket policy was attached."
  echo "      The bucket is private and CloudFront cannot read it yet. That is the"
  echo "      expected state until the CRM frontend stack is deployed with"
  echo "      InstaFrontendBucketDomainName set. See"
  echo "      docs/insta-sol-ms-docs/09-CLOUDFRONT-INTEGRATION.md"
  echo ""
fi

# -----------------------------------------------------------------------------
# 3. Sync content under the insta/ prefix
# -----------------------------------------------------------------------------
echo "[4/5] Syncing dist/ to s3://${BUCKET_NAME}/insta/ ..."

# Hashed assets are immutable - cache them hard. index.html must never be cached
# at the edge or a deploy would not be visible until the TTL expired.
"$AWS_BIN" s3 sync "$PROJECT_DIR/dist/" "s3://${BUCKET_NAME}/insta/" \
  --delete \
  --exclude "index.html" \
  --cache-control "public,max-age=31536000,immutable" \
  "${AWS_ARGS[@]}"

"$AWS_BIN" s3 cp "$PROJECT_DIR/dist/index.html" "s3://${BUCKET_NAME}/insta/index.html" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html" \
  "${AWS_ARGS[@]}"

# -----------------------------------------------------------------------------
# 4. Invalidate
# -----------------------------------------------------------------------------
if [ -n "${CRM_DISTRIBUTION_ID:-}" ]; then
  echo "[5/5] Invalidating /insta/* on distribution ${CRM_DISTRIBUTION_ID}..."
  INVALIDATION_ID="$("$AWS_BIN" cloudfront create-invalidation \
    --distribution-id "$CRM_DISTRIBUTION_ID" \
    --paths "/insta/*" \
    --profile "$AWS_PROFILE" --no-cli-pager \
    --query 'Invalidation.Id' --output text)"
  echo "      Invalidation $INVALIDATION_ID created."
else
  echo "[5/5] Skipping CloudFront invalidation (CRM_DISTRIBUTION_ID not set)."
fi

cat > "$SCRIPT_DIR/.last-deploy-artifacts.json" <<EOF
{
  "bucket": "${BUCKET_NAME}",
  "keyPrefix": "insta/",
  "environment": "${ENVIRONMENT_NAME}",
  "stackName": "${STACK_NAME}",
  "crmDistributionId": "${CRM_DISTRIBUTION_ID:-}",
  "timestamp": "${TIMESTAMP}"
}
EOF

echo ""
echo "============================================="
echo " Deploy complete"
echo "============================================="
"$AWS_BIN" cloudformation describe-stacks --stack-name "$STACK_NAME" "${AWS_ARGS[@]}" \
  --query "Stacks[0].Outputs" --output table
echo "Done."
