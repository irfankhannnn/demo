#!/bin/bash
set -euo pipefail

# =============================================================================
# Reality Flow Authentication Microservice — Deployment Script
# =============================================================================
# Usage: ./infra/deploy.sh <dev|prod>
#   Loads .env.dev or .env.prod (never a plain .env) and forces ENV to match
#   the argument, so every physical resource this stack creates is named
#   <dev|prod>-realestateflow-auth-*, matching the naming already live on
#   prod-realestateflow-networking-common. dev and prod are separate stacks.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/params.sh"

# -----------------------------------------------------------------------------
# Windows Git Bash compatibility
# -----------------------------------------------------------------------------
OS_UNAME="$(uname -s || echo '')"

NPM_BIN="npm"
AWS_BIN="aws"

case "$OS_UNAME" in
  MINGW*|MSYS*|CYGWIN*)
    if command -v npm.cmd >/dev/null 2>&1; then
      NPM_BIN="npm.cmd"
    fi
    if command -v aws.exe >/dev/null 2>&1; then
      AWS_BIN="aws.exe"
    fi
    ;;
esac

if ! command -v "$NPM_BIN" >/dev/null 2>&1; then
  echo "ERROR: $NPM_BIN not found in PATH"
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "ERROR: zip not found in PATH (required to package Lambda)"
  exit 1
fi

if ! command -v "$AWS_BIN" >/dev/null 2>&1; then
  echo "ERROR: $AWS_BIN not found in PATH (AWS CLI required)"
  exit 1
fi

echo "============================================="
echo " Reality Flow Auth — Deploy"
echo "============================================="

# -----------------------------------------------------------------------------
# 0. Require an explicit dev|prod argument and load the matching env file
# -----------------------------------------------------------------------------
DEPLOY_ENV="${1:-}"
if [ "$DEPLOY_ENV" != "dev" ] && [ "$DEPLOY_ENV" != "prod" ]; then
  echo "ERROR: Usage: $0 <dev|prod>"
  echo "  e.g. ./infra/deploy.sh dev"
  echo "       ./infra/deploy.sh prod"
  exit 1
fi

ENV_FILE="$PROJECT_DIR/.env.${DEPLOY_ENV}"

# -----------------------------------------------------------------------------
# 1. Load and validate the environment file
# -----------------------------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found at $ENV_FILE"
  echo "Copy sample.env to $ENV_FILE and fill in the values."
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

# The CLI argument is the source of truth, not whatever ENV the env file
# happens to set — this is what stops a dev deploy from silently reusing
# prod's stack/table/Cognito-pool names (or vice versa) if the file drifts.
ENV="$DEPLOY_ENV"

echo "Deploy target: $DEPLOY_ENV (env file: $(basename "$ENV_FILE"))"
echo ""

REQUIRED_VARS=(
  AWS_REGION
  SERVICE_NAME
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  COGNITO_DOMAIN_PREFIX_V2
  LAMBDA_PACKAGES_BUCKET_NAME
  IDENTITY_CALLBACK_URL
  IDENTITY_LOGOUT_URL
  INTERNAL_API_KEY
)

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

validate_custom_domain_vars

STACK_NAME="${ENV}-${SERVICE_NAME}-stack"

echo "Region:     $AWS_REGION"
echo "Stack:      $STACK_NAME"
echo "Service:    $SERVICE_NAME"
echo "Env:        $ENV"
echo ""

# -----------------------------------------------------------------------------
# 2. Install dependencies and build
# -----------------------------------------------------------------------------
echo "[1/6] Installing dependencies..."
cd "$PROJECT_DIR"
"$NPM_BIN" ci

echo "[2/6] Building TypeScript..."
"$NPM_BIN" run build

# -----------------------------------------------------------------------------
# 3. Package Lambda bundle
# -----------------------------------------------------------------------------
echo "[3/6] Packaging function.zip..."
rm -f "$PROJECT_DIR/function.zip"
cd "$PROJECT_DIR"
zip -r function.zip node_modules dist package.json -x "node_modules/.cache/*" "node_modules/typescript/*" "node_modules/ts-node/*"

# -----------------------------------------------------------------------------
# 4. Upload to S3
# -----------------------------------------------------------------------------
S3_KEY="${SERVICE_NAME}/function.zip"
echo "[4/6] Uploading function.zip to s3://${LAMBDA_PACKAGES_BUCKET_NAME}/${S3_KEY}..."
"$AWS_BIN" s3 cp "$PROJECT_DIR/function.zip" "s3://${LAMBDA_PACKAGES_BUCKET_NAME}/${S3_KEY}" --region "$AWS_REGION" --no-cli-pager

echo "[4b/6] Forcing Lambda code update..."
LAMBDA_NAME="${ENV}-${SERVICE_NAME}-lambda"
"$AWS_BIN" lambda update-function-code \
  --function-name "$LAMBDA_NAME" \
  --s3-bucket "$LAMBDA_PACKAGES_BUCKET_NAME" \
  --s3-key "$S3_KEY" \
  --region "$AWS_REGION" \
  --no-cli-pager || echo "Note: Lambda may not exist yet (first deploy)"

# Upload nested template for explicit API Gateway routes.
#
# The S3 key includes a content hash so TemplateURL's *string value* changes
# whenever auth-explicit-routes.yaml changes. This is load-bearing, not
# cosmetic: CloudFormation only re-evaluates a nested AWS::CloudFormation::Stack
# when its TemplateURL string or its Parameters block changes textually — it
# never diffs the bytes behind an unchanged URL. A prior static key
# (${SERVICE_NAME}/auth-explicit-routes.yaml, no hash) meant every content-only
# change to this file silently never reached the live nested stack across
# three separate "successful" deploys (builds #0001-#0003, confirmed live via
# `aws cloudformation describe-stacks` on the nested stack's own physical ID
# showing LastUpdatedTime null since its 2026-08-27 creation) — this looked
# like a successful deploy every time because the PARENT stack's own
# top-level resources did update correctly; only this one nested stack's
# content was silently stale.
NESTED_TEMPLATE_HASH="$(node -e "const fs=require('fs');const crypto=require('crypto');process.stdout.write(crypto.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex').slice(0,12))" "$SCRIPT_DIR/auth-explicit-routes.yaml")"
NESTED_TEMPLATE_KEY="${SERVICE_NAME}/auth-explicit-routes-${NESTED_TEMPLATE_HASH}.yaml"
echo "[4c/6] Uploading nested template to s3://${LAMBDA_PACKAGES_BUCKET_NAME}/${NESTED_TEMPLATE_KEY}..."
"$AWS_BIN" s3 cp "$SCRIPT_DIR/auth-explicit-routes.yaml" "s3://${LAMBDA_PACKAGES_BUCKET_NAME}/${NESTED_TEMPLATE_KEY}" --region "$AWS_REGION" --no-cli-pager

TEMPLATE_URL="https://s3.${AWS_REGION}.amazonaws.com/${LAMBDA_PACKAGES_BUCKET_NAME}/${NESTED_TEMPLATE_KEY}"

# -----------------------------------------------------------------------------
# 5. Generate cfn-params.json from .env
# -----------------------------------------------------------------------------
echo "[5/6] Generating infra/cfn-params.json..."
compute_param_values "$TEMPLATE_URL"
write_cfn_params_json "$SCRIPT_DIR/cfn-params.json"

# -----------------------------------------------------------------------------
# 6. Deploy CloudFormation stack
# -----------------------------------------------------------------------------
echo "[6/6] Deploying CloudFormation stack: $STACK_NAME..."
PARAM_OVERRIDES=()
for key in "${PARAM_KEYS[@]}"; do
  PARAM_OVERRIDES+=("${key}=${PARAM_VALUES[$key]}")
done
# cfn-backend.yaml is over CloudFormation's 51,200-byte inline TemplateBody limit,
# so the CLI stages it in S3 (--s3-bucket) instead of sending it inline.
"$AWS_BIN" cloudformation deploy \
  --template-file "$SCRIPT_DIR/cfn-backend.yaml" \
  --s3-bucket "$LAMBDA_PACKAGES_BUCKET_NAME" \
  --stack-name "$STACK_NAME" \
  --parameter-overrides "${PARAM_OVERRIDES[@]}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$AWS_REGION" \
  --no-cli-pager \
  --no-fail-on-empty-changeset

# CloudFormation's AWS::ApiGateway::Deployment resource does not reliably
# republish on content-only changes underneath it (a well-known CFN/API
# Gateway limitation - see the Description comment on ApiDeployment in
# cfn-backend.yaml for the two force-replacement approaches that were tried
# and failed live). So every deploy explicitly publishes a fresh deployment
# and repoints the stage at it directly via the API, regardless of whether
# CloudFormation itself thinks anything about ApiDeployment changed.
REST_API_ID="$("$AWS_BIN" cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='AuthApiGatewayId'].OutputValue" \
  --output text --no-cli-pager)"
echo "[6b/6] Publishing fresh API Gateway deployment to stage '$ENV' (rest api $REST_API_ID)..."
"$AWS_BIN" apigateway create-deployment \
  --rest-api-id "$REST_API_ID" \
  --stage-name "$ENV" \
  --description "infra/deploy.sh — routes=${TEMPLATE_URL}" \
  --region "$AWS_REGION" \
  --no-cli-pager

echo ""
echo "============================================="
echo " Deploy complete!"
echo "============================================="

# Print key outputs
echo ""
echo "Stack outputs:"
"$AWS_BIN" cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --no-cli-pager \
  --query "Stacks[0].Outputs" \
  --output table

# -----------------------------------------------------------------------------
# 7. Cleanup
# -----------------------------------------------------------------------------
echo ""
echo "Cleaning up function.zip..."
rm -f "$PROJECT_DIR/function.zip"

echo "Done."
