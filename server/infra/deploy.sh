#!/bin/bash
set -euo pipefail

# =============================================================================
# CRM Backend Microservice — Deployment Script
# =============================================================================
# Usage: ./infra/deploy.sh
# Toggle Lambda deployment here:
#   true  = deploy Lambda code + API Gateway
#   false = deploy API Gateway only
# Set this manually before running the script.
#
# Defaulting to false keeps the deploy API Gateway-only by default.
# Requires: .env file in project root with all required variables
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DEPLOY_LAMBDA=true


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

# zip check skipped when DEPLOY_LAMBDA=false
if [ "$DEPLOY_LAMBDA" = true ]; then
  if ! command -v zip >/dev/null 2>&1; then
    echo "ERROR: zip not found in PATH (required to package Lambda)"
    exit 1
  fi
fi

if ! command -v "$AWS_BIN" >/dev/null 2>&1; then
  echo "ERROR: $AWS_BIN not found in PATH (AWS CLI required)"
  exit 1
fi

echo "============================================="
echo " CRM Backend — Deploy"
echo "============================================="

# -----------------------------------------------------------------------------
# 1. Load and validate .env
# -----------------------------------------------------------------------------
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "ERROR: .env file not found at $PROJECT_DIR/.env"
  echo "Copy .env.example to .env and fill in the values."
  exit 1
fi

set -a
source "$PROJECT_DIR/.env"
set +a

REQUIRED_VARS=(
  AWS_REGION
  STACK_NAME
  ARTIFACT_BUCKET
  ARTIFACT_PREFIX
  AUTH_SERVICE_URL
  PUBLIC_API_DOMAIN_NAME
  CRM_API_DOMAIN_NAME
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Required env var $var is not set in .env"
    exit 1
  fi
done

echo "Region:     $AWS_REGION"
echo "Stack:      $STACK_NAME"
echo "Auth URL:   $AUTH_SERVICE_URL"
echo ""

# Generate timestamp for deployment descriptions
TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")

# -----------------------------------------------------------------------------
# 2. Install dependencies and build
# -----------------------------------------------------------------------------
if [ "$DEPLOY_LAMBDA" = true ]; then
  echo "[1/6] Installing dependencies..."
  cd "$PROJECT_DIR"
  "$NPM_BIN" ci --omit=dev --no-audit --no-fund

  # -----------------------------------------------------------------------------
  # 3. Package Lambda bundle
  # -----------------------------------------------------------------------------
  echo "[2/6] Packaging function.zip..."
  rm -f "$PROJECT_DIR/function.zip"
  cd "$PROJECT_DIR"
  zip -r function.zip node_modules package.json *.js routes/ middleware/ utils/ validation/ public/ \
    -x "node_modules/.cache/*" "node_modules/typescript/*" "node_modules/ts-node/*" \
       "deploy*.ps1" "deploy.ps1" "*.md" ".git*" "cfn/*" "infra/*"

  # -----------------------------------------------------------------------------
  # 4. Upload to S3
  # -----------------------------------------------------------------------------
  S3_KEY="${ARTIFACT_PREFIX}/function-${TIMESTAMP}.zip"
  echo "[3/6] Uploading function.zip to s3://${ARTIFACT_BUCKET}/${S3_KEY}..."
  "$AWS_BIN" s3 cp "$PROJECT_DIR/function.zip" "s3://${ARTIFACT_BUCKET}/${S3_KEY}" --region "$AWS_REGION" --no-cli-pager
else
  echo "[1/6] Skipping Lambda deployment (DEPLOY_LAMBDA=false)."
fi

# Upload nested template
NESTED_TEMPLATE_KEY="${ARTIFACT_PREFIX}/apigw-explicit-routes.yaml"
echo "[4/6] Uploading nested template to s3://${ARTIFACT_BUCKET}/${NESTED_TEMPLATE_KEY}..."
"$AWS_BIN" s3 cp "$SCRIPT_DIR/apigw-explicit-routes.yaml" "s3://${ARTIFACT_BUCKET}/${NESTED_TEMPLATE_KEY}" --region "$AWS_REGION" --no-cli-pager

TEMPLATE_URL="https://s3.${AWS_REGION}.amazonaws.com/${ARTIFACT_BUCKET}/${NESTED_TEMPLATE_KEY}"

if [ "$DEPLOY_LAMBDA" = true ]; then
  LAMBDA_CODE_PARAMETER_JSON='  { "ParameterKey": "LambdaCodeS3Key", "ParameterValue": "'"${S3_KEY}"'" },'
else
  LAMBDA_CODE_PARAMETER_JSON=''
fi

# -----------------------------------------------------------------------------
# 5. Generate cfn-params.json from .env
# -----------------------------------------------------------------------------
echo "[5/6] Generating infra/cfn-params.json..."
cat > "$SCRIPT_DIR/cfn-params.json" <<EOF
[
  { "ParameterKey": "EnvironmentName", "ParameterValue": "${ENVIRONMENT_NAME}" },
  { "ParameterKey": "LambdaRuntime", "ParameterValue": "${LAMBDA_RUNTIME}" },
  { "ParameterKey": "LambdaMemorySize", "ParameterValue": "${LAMBDA_MEMORY_SIZE}" },
  { "ParameterKey": "LambdaTimeout", "ParameterValue": "${LAMBDA_TIMEOUT}" },
  { "ParameterKey": "DynamoDbTableName", "ParameterValue": "${DYNAMODB_TABLE_NAME}" },
  { "ParameterKey": "CrmDynamoDbTableName", "ParameterValue": "${CRM_DYNAMODB_TABLE_NAME}" },
  { "ParameterKey": "AgencyConfigTableName", "ParameterValue": "${AGENCY_CONFIG_DYNAMODB_TABLE_NAME}" },
  { "ParameterKey": "EnquiriesTableNameCloudberry", "ParameterValue": "${ENQUIRIES_DYNAMODB_TABLE_NAME}" },
  { "ParameterKey": "AreasTableName", "ParameterValue": "${AREAS_DYNAMODB_TABLE_NAME}" },
  { "ParameterKey": "B2BLeadsTableName", "ParameterValue": "${B2B_LEADS_TABLE}" },
  { "ParameterKey": "KhataTableName", "ParameterValue": "${KHATA_TABLE_NAME}" },
  { "ParameterKey": "NotificationsTableName", "ParameterValue": "${NOTIFICATIONS_TABLE_NAME}" },
  { "ParameterKey": "DevelopersTableName", "ParameterValue": "${DEVELOPERS_TABLE_NAME}" },
  { "ParameterKey": "RealEstateAreasTableName", "ParameterValue": "${REAL_ESTATE_AREAS_TABLE_NAME}" },
  { "ParameterKey": "ProjectsTableName", "ParameterValue": "${PROJECTS_TABLE_NAME}" },
  { "ParameterKey": "S3BucketName", "ParameterValue": "${S3_BUCKET_NAME}" },
  { "ParameterKey": "LambdaCodeS3Bucket", "ParameterValue": "${ARTIFACT_BUCKET}" },
${LAMBDA_CODE_PARAMETER_JSON}
  { "ParameterKey": "PublicApiDomainName", "ParameterValue": "${PUBLIC_API_DOMAIN_NAME}" },
  { "ParameterKey": "PublicApiBasePath", "ParameterValue": "${PUBLIC_API_BASE_PATH}" },
  { "ParameterKey": "PublicApiStageName", "ParameterValue": "${PUBLIC_API_STAGE_NAME}" },
  { "ParameterKey": "CrmApiDomainName", "ParameterValue": "${CRM_API_DOMAIN_NAME}" },
  { "ParameterKey": "CrmApiBasePath", "ParameterValue": "${CRM_API_BASE_PATH}" },
  { "ParameterKey": "CrmApiStageName", "ParameterValue": "${CRM_API_STAGE_NAME}" },
  { "ParameterKey": "AuthServiceUrl", "ParameterValue": "${AUTH_SERVICE_URL}" },
  { "ParameterKey": "AllowedOrigins", "ParameterValue": "${ALLOWED_ORIGINS}" },
  { "ParameterKey": "NpsHmacSecret", "ParameterValue": "${NPS_HMAC_SECRET}" },
  { "ParameterKey": "BrevoApiKey", "ParameterValue": "${BREVO_API_KEY}" },
  { "ParameterKey": "FounderNotificationEmail", "ParameterValue": "${FOUNDER_NOTIFICATION_EMAIL}" },
  { "ParameterKey": "RazorpayWebhookSecret", "ParameterValue": "${RAZORPAY_WEBHOOK_SECRET}" },
  { "ParameterKey": "BrevoFromEmail", "ParameterValue": "${BREVO_FROM_EMAIL}" },
  { "ParameterKey": "BrevoFromName", "ParameterValue": "${BREVO_FROM_NAME}" },
  { "ParameterKey": "HcaptchaSecretKey", "ParameterValue": "${HCAPTCHA_SECRET_KEY}" },
  { "ParameterKey": "ApiGatewayRoutesTemplateUrl", "ParameterValue": "${TEMPLATE_URL}" }
]
EOF

# -----------------------------------------------------------------------------
# 6. Deploy CloudFormation stack
# -----------------------------------------------------------------------------
echo "[6/6] Deploying CloudFormation stack: $STACK_NAME..."
PARAM_OVERRIDES=(
  "EnvironmentName=${ENVIRONMENT_NAME}"
  "LambdaRuntime=${LAMBDA_RUNTIME}"
  "LambdaMemorySize=${LAMBDA_MEMORY_SIZE}"
  "LambdaTimeout=${LAMBDA_TIMEOUT}"
  "DynamoDbTableName=${DYNAMODB_TABLE_NAME}"
  "CrmDynamoDbTableName=${CRM_DYNAMODB_TABLE_NAME}"
  "AgencyConfigTableName=${AGENCY_CONFIG_DYNAMODB_TABLE_NAME}"
  "EnquiriesTableNameCloudberry=${ENQUIRIES_DYNAMODB_TABLE_NAME}"
  "AreasTableName=${AREAS_DYNAMODB_TABLE_NAME}"
  "B2BLeadsTableName=${B2B_LEADS_TABLE}"
  "KhataTableName=${KHATA_TABLE_NAME}"
  "NotificationsTableName=${NOTIFICATIONS_TABLE_NAME}"
  "DevelopersTableName=${DEVELOPERS_TABLE_NAME}"
  "RealEstateAreasTableName=${REAL_ESTATE_AREAS_TABLE_NAME}"
  "ProjectsTableName=${PROJECTS_TABLE_NAME}"
  "S3BucketName=${S3_BUCKET_NAME}"
  "LambdaCodeS3Bucket=${ARTIFACT_BUCKET}"
  "PublicApiDomainName=${PUBLIC_API_DOMAIN_NAME}"
  "PublicApiBasePath=${PUBLIC_API_BASE_PATH}"
  "PublicApiStageName=${PUBLIC_API_STAGE_NAME}"
  "CrmApiDomainName=${CRM_API_DOMAIN_NAME}"
  "CrmApiBasePath=${CRM_API_BASE_PATH}"
  "CrmApiStageName=${CRM_API_STAGE_NAME}"
  "AuthServiceUrl=${AUTH_SERVICE_URL}"
  "AllowedOrigins=${ALLOWED_ORIGINS}"
  "NpsHmacSecret=${NPS_HMAC_SECRET}"
  "BrevoApiKey=${BREVO_API_KEY}"
  "FounderNotificationEmail=${FOUNDER_NOTIFICATION_EMAIL}"
  "RazorpayWebhookSecret=${RAZORPAY_WEBHOOK_SECRET}"
  "BrevoFromEmail=${BREVO_FROM_EMAIL}"
  "BrevoFromName=${BREVO_FROM_NAME}"
  "HcaptchaSecretKey=${HCAPTCHA_SECRET_KEY}"
  "ApiGatewayRoutesTemplateUrl=${TEMPLATE_URL}"
)

if [ "$DEPLOY_LAMBDA" = true ]; then
  PARAM_OVERRIDES+=("LambdaCodeS3Key=${S3_KEY}")
fi

"$AWS_BIN" cloudformation deploy \
  --template-file "$SCRIPT_DIR/cfn-backend.yaml" \
  --stack-name "$STACK_NAME" \
  --parameter-overrides "${PARAM_OVERRIDES[@]}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$AWS_REGION" \
  --no-cli-pager \
  --no-fail-on-empty-changeset

# Force API Gateway deployments
echo "Forcing API Gateway deployments..."
PUBLIC_API_ID=$("$AWS_BIN" cloudformation describe-stack-resources --region "$AWS_REGION" --stack-name "$STACK_NAME" --logical-resource-id RealEstatePublicRestApi --query "StackResources[0].PhysicalResourceId" --output text)
CRM_API_ID=$("$AWS_BIN" cloudformation describe-stack-resources --region "$AWS_REGION" --stack-name "$STACK_NAME" --logical-resource-id RealEstateCrmRestApi --query "StackResources[0].PhysicalResourceId" --output text)

# Retry helper for API Gateway create-deployment (handles TooManyRequestsException)
apigw_deploy_with_retry() {
  local api_id="$1"
  local stage_name="$2"
  local attempt=1
  local max_attempts=5
  local delay=5

  while [ $attempt -le $max_attempts ]; do
    if "$AWS_BIN" apigateway create-deployment --region "$AWS_REGION" --rest-api-id "$api_id" --stage-name "$stage_name" --description "deploy.sh $TIMESTAMP" > /dev/null 2>&1; then
      echo "  Deployment successful for API $api_id (stage: $stage_name)"
      return 0
    fi

    if [ $attempt -eq $max_attempts ]; then
      echo "  ERROR: API Gateway deployment failed for $api_id after $max_attempts attempts"
      return 1
    fi

    echo "  Rate limited on API $api_id, retrying in ${delay}s... (attempt $attempt/$max_attempts)"
    sleep $delay
    delay=$((delay * 2))
    attempt=$((attempt + 1))
  done
}

if [ "$PUBLIC_API_ID" != "None" ] && [ -n "$PUBLIC_API_ID" ]; then
  sleep 3
  apigw_deploy_with_retry "$PUBLIC_API_ID" "$PUBLIC_API_STAGE_NAME"
fi

if [ "$CRM_API_ID" != "None" ] && [ -n "$CRM_API_ID" ]; then
  sleep 5
  apigw_deploy_with_retry "$CRM_API_ID" "$CRM_API_STAGE_NAME"
fi

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
