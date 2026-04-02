#!/bin/bash
set -euo pipefail

# =============================================================================
# Reality Flow Authentication Microservice — Deployment Script
# =============================================================================
# Usage: ./infra/deploy.sh
# Requires: .env file in project root with all required variables
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
# 1. Load and validate .env
# -----------------------------------------------------------------------------
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "ERROR: .env file not found at $PROJECT_DIR/.env"
  echo "Copy sample.env to .env and fill in the values."
  exit 1
fi

set -a
source "$PROJECT_DIR/.env"
set +a

REQUIRED_VARS=(
  AWS_REGION
  SERVICE_NAME
  ENV
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  COGNITO_DOMAIN_PREFIX_V2
  LAMBDA_PACKAGES_BUCKET_NAME
  IDENTITY_CALLBACK_URL
  IDENTITY_LOGOUT_URL
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Required env var $var is not set in .env"
    exit 1
  fi
done

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
  { "ParameterKey": "CognitoUserPoolId", "ParameterValue": "" },
  { "ParameterKey": "CognitoClientId", "ParameterValue": "" },
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
  { "ParameterKey": "TestOtpValue", "ParameterValue": "${TEST_OTP_VALUE:-123456}" }
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
  "CognitoUserPoolId="
  "CognitoClientId="
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
