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

# Upload nested template for explicit API Gateway routes
NESTED_TEMPLATE_KEY="${SERVICE_NAME}/auth-explicit-routes.yaml"
echo "[4c/6] Uploading nested template to s3://${LAMBDA_PACKAGES_BUCKET_NAME}/${NESTED_TEMPLATE_KEY}..."
"$AWS_BIN" s3 cp "$SCRIPT_DIR/auth-explicit-routes.yaml" "s3://${LAMBDA_PACKAGES_BUCKET_NAME}/${NESTED_TEMPLATE_KEY}" --region "$AWS_REGION" --no-cli-pager

TEMPLATE_URL="https://s3.${AWS_REGION}.amazonaws.com/${LAMBDA_PACKAGES_BUCKET_NAME}/${NESTED_TEMPLATE_KEY}"

# -----------------------------------------------------------------------------
# 5. Generate cfn-params.json from .env
# -----------------------------------------------------------------------------
echo "[5/6] Generating infra/cfn-params.json..."
cat > "$SCRIPT_DIR/cfn-params.json" <<EOF
[
  { "ParameterKey": "ServiceName", "ParameterValue": "${SERVICE_NAME}" },
  { "ParameterKey": "Env", "ParameterValue": "${ENV}" },
  { "ParameterKey": "LambdaMemorySize", "ParameterValue": "${LAMBDA_MEMORY_SIZE:-256}" },
  { "ParameterKey": "LambdaTimeout", "ParameterValue": "${LAMBDA_TIMEOUT:-30}" },
  { "ParameterKey": "LogRetentionInDays", "ParameterValue": "${LOG_RETENTION_IN_DAYS:-14}" },
  { "ParameterKey": "SubnetIds", "ParameterValue": "${SUBNET_IDS:-}" },
  { "ParameterKey": "SecurityGroupIds", "ParameterValue": "${SECURITY_GROUP_IDS:-}" },
  { "ParameterKey": "LambdaPackagesBucketName", "ParameterValue": "${LAMBDA_PACKAGES_BUCKET_NAME}" },
  { "ParameterKey": "DatabaseHost", "ParameterValue": "" },
  { "ParameterKey": "DatabasePort", "ParameterValue": "" },
  { "ParameterKey": "DatabaseName", "ParameterValue": "" },
  { "ParameterKey": "DatabaseUsername", "ParameterValue": "" },
  { "ParameterKey": "DatabasePassword", "ParameterValue": "" },
  { "ParameterKey": "DomainName", "ParameterValue": "${DOMAIN_NAME:-}" },
  { "ParameterKey": "GoogleClientId", "ParameterValue": "${GOOGLE_CLIENT_ID}" },
  { "ParameterKey": "GoogleClientSecret", "ParameterValue": "${GOOGLE_CLIENT_SECRET}" },
  { "ParameterKey": "CognitoDomainPrefixV2", "ParameterValue": "${COGNITO_DOMAIN_PREFIX_V2}" },
  { "ParameterKey": "IdentityCallbackURL", "ParameterValue": "${IDENTITY_CALLBACK_URL}" },
  { "ParameterKey": "IdentityLogoutURL", "ParameterValue": "${IDENTITY_LOGOUT_URL}" },
  { "ParameterKey": "TestOtpEnabled", "ParameterValue": "${TEST_OTP_ENABLED:-false}" },
  { "ParameterKey": "TestOtpValue", "ParameterValue": "${TEST_OTP_VALUE:-123456}" },
  { "ParameterKey": "ApiGatewayRoutesTemplateUrl", "ParameterValue": "${TEMPLATE_URL}" },
  { "ParameterKey": "InternalApiKey", "ParameterValue": "${INTERNAL_API_KEY:-}" },
  { "ParameterKey": "AllowedOrigins", "ParameterValue": "${ALLOWED_ORIGINS:-http://localhost:3000,http://localhost:5173}" },
  { "ParameterKey": "SubscriptionsTableName", "ParameterValue": "${SUBSCRIPTIONS_TABLE:-${ENV}-realestateflow-subscriptions}" },
  { "ParameterKey": "ServerStackName", "ParameterValue": "${SERVER_STACK_NAME:-}" }
]
EOF

# -----------------------------------------------------------------------------
# 6. Deploy CloudFormation stack
# -----------------------------------------------------------------------------
echo "[6/6] Deploying CloudFormation stack: $STACK_NAME..."
PARAM_OVERRIDES=(
  "ServiceName=${SERVICE_NAME}"
  "Env=${ENV}"
  "LambdaMemorySize=${LAMBDA_MEMORY_SIZE:-256}"
  "LambdaTimeout=${LAMBDA_TIMEOUT:-30}"
  "LogRetentionInDays=${LOG_RETENTION_IN_DAYS:-14}"
  "SubnetIds=${SUBNET_IDS:-}"
  "SecurityGroupIds=${SECURITY_GROUP_IDS:-}"
  "LambdaPackagesBucketName=${LAMBDA_PACKAGES_BUCKET_NAME}"
  "DatabaseHost="
  "DatabasePort="
  "DatabaseName="
  "DatabaseUsername="
  "DatabasePassword="
  "DomainName=${DOMAIN_NAME:-}"
  "GoogleClientId=${GOOGLE_CLIENT_ID}"
  "GoogleClientSecret=${GOOGLE_CLIENT_SECRET}"
  "CognitoDomainPrefixV2=${COGNITO_DOMAIN_PREFIX_V2}"
  "IdentityCallbackURL=${IDENTITY_CALLBACK_URL}"
  "IdentityLogoutURL=${IDENTITY_LOGOUT_URL}"
  "TestOtpEnabled=${TEST_OTP_ENABLED:-false}"
  "TestOtpValue=${TEST_OTP_VALUE:-123456}"
  "ApiGatewayRoutesTemplateUrl=${TEMPLATE_URL}"
  "InternalApiKey=${INTERNAL_API_KEY:-}"
  "AllowedOrigins=${ALLOWED_ORIGINS:-http://localhost:3000,http://localhost:5173}"
  "SubscriptionsTableName=${SUBSCRIPTIONS_TABLE:-${ENV}-realestateflow-subscriptions}"
  "ServerStackName=${SERVER_STACK_NAME:-}"
)
"$AWS_BIN" cloudformation deploy \
  --template-file "$SCRIPT_DIR/cfn-backend.yaml" \
  --stack-name "$STACK_NAME" \
  --parameter-overrides "${PARAM_OVERRIDES[@]}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$AWS_REGION" \
  --no-cli-pager \
  --no-fail-on-empty-changeset

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
