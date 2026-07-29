#!/bin/bash
set -euo pipefail

# =============================================================================
# RealtyFlow MCP Microservice — Deployment Script
#
# Deploys the MCP Server to AWS Lambda + API Gateway
#
# Usage: ./infra/deploy.sh [OPTIONS] [dev|test|prod]
#
# Options:
#   --skip-package   Skip Lambda packaging (npm install, build, zip, upload).
#                    Only generates cfn-params.json and deploys CloudFormation.
#                    Useful when Lambda code hasn't changed and you only want
#                    to update stack parameters/resources.
#   --skip-cfn       Skip CloudFormation deployment. Only packages and uploads
#                    the Lambda code, then forces a Lambda code update.
#                    Useful for rapid code-only iterations.
#   --skip-lambda-update
#                    Skip the direct Lambda code update call after S3 upload.
#                    By default the script forces a Lambda code update after
#                    uploading the zip; use this to rely solely on CFN.
#   -h, --help       Show this help message.
#
# Examples:
#   ./infra/deploy.sh                       # Full deploy (package + CFN)
#   ./infra/deploy.sh --skip-package        # CFN only (no build/zip/upload)
#   ./infra/deploy.sh --skip-cfn            # Package only (no CFN deploy)
#   ./infra/deploy.sh prod --skip-package   # CFN only, env=prod
#
# Prerequisites: .env file, AWS CLI, Node.js 20.x, zip
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# -----------------------------------------------------------------------------
# Parse flags
# -----------------------------------------------------------------------------
SKIP_PACKAGE=false
SKIP_CFN=false
SKIP_LAMBDA_UPDATE=false
POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-package)
      SKIP_PACKAGE=true
      shift
      ;;
    --skip-cfn)
      SKIP_CFN=true
      shift
      ;;
    --skip-lambda-update)
      SKIP_LAMBDA_UPDATE=true
      shift
      ;;
    -h|--help)
      sed -n '3,30p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    -*)
      echo "ERROR: Unknown option: $1"
      echo "Run './infra/deploy.sh --help' for usage."
      exit 1
      ;;
    *)
      POSITIONAL_ARGS+=("$1")
      shift
      ;;
  esac
done

# Allow optional positional env arg (dev|test|prod) — overrides .env ENV
ENV_ARG="${POSITIONAL_ARGS[0]:-}"

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

if ! command -v "$AWS_BIN" >/dev/null 2>&1; then
  echo "ERROR: $AWS_BIN not found in PATH (AWS CLI required)"
  exit 1
fi

# zip/npm only required when packaging
if [ "$SKIP_PACKAGE" = false ]; then
  if ! command -v "$NPM_BIN" >/dev/null 2>&1; then
    echo "ERROR: $NPM_BIN not found in PATH (required for packaging; use --skip-package to skip)"
    exit 1
  fi
  if ! command -v zip >/dev/null 2>&1; then
    echo "ERROR: zip not found in PATH (required for packaging; use --skip-package to skip)"
    exit 1
  fi
fi

# -----------------------------------------------------------------------------
# Load .env
# -----------------------------------------------------------------------------
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "ERROR: .env file not found at $PROJECT_DIR/.env"
  echo "Copy sample.env to .env and fill in the values."
  exit 1
fi

set -a
source "$PROJECT_DIR/.env"
set +a

# CLI positional arg overrides .env ENV
if [ -n "$ENV_ARG" ]; then
  ENV="$ENV_ARG"
fi

ENV="${ENV:-dev}"
SERVICE_NAME="${SERVICE_NAME:-realtyflow-mcp}"
REGION="${AWS_REGION:-ap-south-1}"
LAMBDA_PACKAGES_BUCKET="${LAMBDA_PACKAGES_BUCKET_NAME:-realestate-flow-lambda-packages}"
LAMBDA_CODE_S3_KEY="${SERVICE_NAME}/function.zip"
STACK_NAME="${ENV}-${SERVICE_NAME}-stack"
CFN_TEMPLATE="$SCRIPT_DIR/cfn-backend.yaml"

echo "============================================="
echo " RealtyFlow MCP — Deploy"
echo "============================================="
echo "Region:           $REGION"
echo "Stack:            $STACK_NAME"
echo "Service:          $SERVICE_NAME"
echo "Env:              $ENV"
echo "Skip package:     $SKIP_PACKAGE"
echo "Skip CFN:         $SKIP_CFN"
echo "Skip Lambda update: $SKIP_LAMBDA_UPDATE"
echo ""

# -----------------------------------------------------------------------------
# 1-4. Package Lambda (npm install, build, zip, upload to S3)
# -----------------------------------------------------------------------------
if [ "$SKIP_PACKAGE" = true ]; then
  echo "[1/6] Skipping npm install (--skip-package)"
  echo "[2/6] Skipping build (--skip-package)"
  echo "[3/6] Skipping zip (--skip-package)"
  echo "[4/6] Skipping S3 upload (--skip-package)"
else
  echo "[1/6] Installing dependencies..."
  cd "$PROJECT_DIR"
  "$NPM_BIN" ci

  echo "[2/6] Building TypeScript..."
  "$NPM_BIN" run build

  echo "[3/6] Packaging function.zip..."
  rm -f "$PROJECT_DIR/function.zip"
  cd "$PROJECT_DIR"
  zip -r function.zip node_modules dist package.json \
    -x "node_modules/.cache/*" "node_modules/typescript/*" "node_modules/ts-node/*"

  echo "[4/6] Uploading function.zip to s3://${LAMBDA_PACKAGES_BUCKET}/${LAMBDA_CODE_S3_KEY}..."
  "$AWS_BIN" s3 cp "$PROJECT_DIR/function.zip" \
    "s3://${LAMBDA_PACKAGES_BUCKET}/${LAMBDA_CODE_S3_KEY}" \
    --region "$REGION" --no-cli-pager

  if [ "$SKIP_LAMBDA_UPDATE" = false ]; then
    echo "[4b/6] Forcing Lambda code update..."
    LAMBDA_NAME="${SERVICE_NAME}-${ENV}-mcp"
    "$AWS_BIN" lambda update-function-code \
      --function-name "$LAMBDA_NAME" \
      --s3-bucket "$LAMBDA_PACKAGES_BUCKET" \
      --s3-key "$LAMBDA_CODE_S3_KEY" \
      --region "$REGION" \
      --no-cli-pager || echo "Note: Lambda may not exist yet (first deploy)"
  else
    echo "[4b/6] Skipping direct Lambda code update (--skip-lambda-update)"
  fi
fi

# -----------------------------------------------------------------------------
# 5. Generate cfn-params.json from .env (for reference/debugging)
#    CloudFormation deploy uses inline --parameter-overrides instead of
#    file:// to avoid Windows path issues with aws.exe (native Windows binary
#    can't resolve Git Bash's /d/... Unix-style paths in file:// URIs).
# -----------------------------------------------------------------------------
echo "[5/6] Generating infra/cfn-params.json (reference)..."
cat > "$SCRIPT_DIR/cfn-params.json" <<EOF
[
  { "ParameterKey": "ServiceName", "ParameterValue": "${SERVICE_NAME}" },
  { "ParameterKey": "Env", "ParameterValue": "${ENV}" },
  { "ParameterKey": "LambdaMemorySize", "ParameterValue": "${LAMBDA_MEMORY_SIZE:-512}" },
  { "ParameterKey": "LambdaTimeout", "ParameterValue": "${LAMBDA_TIMEOUT:-30}" },
  { "ParameterKey": "LogRetentionInDays", "ParameterValue": "${LOG_RETENTION_IN_DAYS:-30}" },
  { "ParameterKey": "LambdaPackagesBucketName", "ParameterValue": "${LAMBDA_PACKAGES_BUCKET}" },
  { "ParameterKey": "LambdaCodeS3Key", "ParameterValue": "${LAMBDA_CODE_S3_KEY}" },
  { "ParameterKey": "OAuthCodesTableName", "ParameterValue": "${OAUTH_CODES_TABLE_NAME:-realtyflow-oauth-codes}" },
  { "ParameterKey": "OAuthConnectionsTableName", "ParameterValue": "${OAUTH_CONNECTIONS_TABLE:-realtyflow-oauth-connections}" },
  { "ParameterKey": "JWTSecret", "ParameterValue": "${JWT_SECRET}" },
  { "ParameterKey": "JWTRefreshSecret", "ParameterValue": "${JWT_REFRESH_SECRET}" },
  { "ParameterKey": "CrmApiUrl", "ParameterValue": "${CRM_API_URL}" },
  { "ParameterKey": "CrmApiInternalKey", "ParameterValue": "${CRM_API_INTERNAL_KEY:-}" },
  { "ParameterKey": "AuthServiceUrl", "ParameterValue": "${AUTH_SERVICE_URL:-}" },
  { "ParameterKey": "AllowedOrigins", "ParameterValue": "${ALLOWED_ORIGINS:-http://localhost:3000,http://localhost:5173}" },
  { "ParameterKey": "FrontendUrl", "ParameterValue": "${FRONTEND_URL:-http://localhost:3000}" },
  { "ParameterKey": "DomainName", "ParameterValue": "${DOMAIN_NAME:-}" }
]
EOF

# Build inline parameter overrides array (avoids file:// path issues on Windows)
PARAM_OVERRIDES=(
  "ServiceName=${SERVICE_NAME}"
  "Env=${ENV}"
  "LambdaMemorySize=${LAMBDA_MEMORY_SIZE:-512}"
  "LambdaTimeout=${LAMBDA_TIMEOUT:-30}"
  "LogRetentionInDays=${LOG_RETENTION_IN_DAYS:-30}"
  "LambdaPackagesBucketName=${LAMBDA_PACKAGES_BUCKET}"
  "LambdaCodeS3Key=${LAMBDA_CODE_S3_KEY}"
  "OAuthCodesTableName=${OAUTH_CODES_TABLE_NAME:-realtyflow-oauth-codes}"
  "OAuthConnectionsTableName=${OAUTH_CONNECTIONS_TABLE:-realtyflow-oauth-connections}"
  "JWTSecret=${JWT_SECRET}"
  "JWTRefreshSecret=${JWT_REFRESH_SECRET}"
  "CrmApiUrl=${CRM_API_URL}"
  "CrmApiInternalKey=${CRM_API_INTERNAL_KEY:-}"
  "AuthServiceUrl=${AUTH_SERVICE_URL:-}"
  "AllowedOrigins=${ALLOWED_ORIGINS:-http://localhost:3000,http://localhost:5173}"
  "FrontendUrl=${FRONTEND_URL:-http://localhost:3000}"
  "DomainName=${DOMAIN_NAME:-}"
)

# -----------------------------------------------------------------------------
# 6. Deploy CloudFormation stack
# -----------------------------------------------------------------------------

# Helper: wait for stack to be in a stable state before deploying
wait_for_stack_stable() {
  local stack_name="$1"
  local max_wait=300
  local waited=0

  while [ $waited -lt $max_wait ]; do
    local status
    status=$("$AWS_BIN" cloudformation describe-stacks \
      --stack-name "$stack_name" \
      --region "$REGION" \
      --no-cli-pager \
      --query "Stacks[0].StackStatus" \
      --output text 2>/dev/null || echo "NOT_FOUND")

    case "$status" in
      CREATE_COMPLETE|UPDATE_COMPLETE|UPDATE_ROLLBACK_COMPLETE|ROLLBACK_COMPLETE|DELETE_COMPLETE|NOT_FOUND)
        return 0
        ;;
      UPDATE_ROLLBACK_IN_PROGRESS|UPDATE_IN_PROGRESS|CREATE_IN_PROGRESS|DELETE_IN_PROGRESS|ROLLBACK_IN_PROGRESS|UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS|UPDATE_COMPLETE_CLEANUP_IN_PROGRESS)
        echo "  Stack is in state: $status, waiting 10s... (${waited}s elapsed)"
        sleep 10
        waited=$((waited + 10))
        ;;
      UPDATE_ROLLBACK_FAILED|ROLLBACK_FAILED|CREATE_FAILED|DELETE_FAILED)
        echo "  ERROR: Stack is in failed state: $status"
        echo "  Run: aws cloudformation describe-stack-events --stack-name $stack_name --region $REGION"
        return 1
        ;;
      *)
        echo "  Unknown stack state: $status, waiting 10s..."
        sleep 10
        waited=$((waited + 10))
        ;;
    esac
  done

  echo "  ERROR: Timed out waiting for stack to become stable"
  return 1
}

# Helper: deploy CloudFormation with retry for transient failures
cfn_deploy_with_retry() {
  local max_attempts=3
  local attempt=1
  local delay=30

  while [ $attempt -le $max_attempts ]; do
    echo "  Attempt $attempt/$max_attempts..."

    if "$AWS_BIN" cloudformation deploy \
      --template-file "$CFN_TEMPLATE" \
      --stack-name "$STACK_NAME" \
      --parameter-overrides "${PARAM_OVERRIDES[@]}" \
      --capabilities CAPABILITY_NAMED_IAM \
      --region "$REGION" \
      --no-fail-on-empty-changeset 2>&1; then
      echo "  CloudFormation deploy successful"
      return 0
    fi

    if [ $attempt -eq $max_attempts ]; then
      echo "  ERROR: CloudFormation deploy failed after $max_attempts attempts"
      return 1
    fi

    echo "  Deploy failed, waiting ${delay}s before retry..."
    sleep "$delay"

    if ! wait_for_stack_stable "$STACK_NAME"; then
      echo "  ERROR: Stack is not in a stable state, cannot retry"
      return 1
    fi

    delay=$((delay * 2))
    attempt=$((attempt + 1))
  done
}

if [ "$SKIP_CFN" = true ]; then
  echo "[6/6] Skipping CloudFormation deployment (--skip-cfn)"
else
  echo "[6/6] Deploying CloudFormation stack: $STACK_NAME..."

  # Pre-check: ensure stack is in a stable state before deploying
  echo "  Checking stack status..."
  if ! wait_for_stack_stable "$STACK_NAME"; then
    echo "  ERROR: Stack is not stable. Fix the stack state before deploying."
    exit 1
  fi

  cfn_deploy_with_retry
fi

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------
if [ "$SKIP_CFN" = true ]; then
  echo ""
  echo "============================================="
  echo "Deployment Complete (CFN skipped)"
  echo "============================================="
  echo ""
  echo "Stack:  $STACK_NAME (not deployed this run)"
  echo "Lambda: code updated via direct update-function-code"
else
  echo ""
  echo "Retrieving stack outputs..."
  MCP_API_URL=$("$AWS_BIN" cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`McpApiUrl`].OutputValue' \
    --output text 2>/dev/null || echo "N/A")
  OAUTH_AUTHORIZE_URL=$("$AWS_BIN" cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`OAuthAuthorizeUrl`].OutputValue' \
    --output text 2>/dev/null || echo "N/A")
  OAUTH_TOKEN_URL=$("$AWS_BIN" cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`OAuthTokenUrl`].OutputValue' \
    --output text 2>/dev/null || echo "N/A")
  OAUTH_REGISTER_URL=$("$AWS_BIN" cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`OAuthRegisterUrl`].OutputValue' \
    --output text 2>/dev/null || echo "N/A")
  OAUTH_METADATA_URL=$("$AWS_BIN" cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`OAuthMetadataUrl`].OutputValue' \
    --output text 2>/dev/null || echo "N/A")

  echo ""
  echo "============================================="
  echo "Deployment Complete!"
  echo "============================================="
  echo ""
  echo "Stack:             $STACK_NAME"
  echo "MCP API URL:       $MCP_API_URL"
  echo "OAuth Authorize:   $OAUTH_AUTHORIZE_URL"
  echo "OAuth Token:       $OAUTH_TOKEN_URL"
  echo "OAuth Register:    $OAUTH_REGISTER_URL"
  echo "OAuth Metadata:    $OAUTH_METADATA_URL"
  echo ""
  echo "Next Steps:"
  echo "1. Test the MCP endpoint:"
  echo "   curl -X POST $MCP_API_URL \\"
  echo "     -H 'Content-Type: application/json' \\"
  echo "     -H 'Authorization: Bearer <JWT_TOKEN>' \\"
  echo "     -d '{\"jsonrpc\":\"2.0\",\"method\":\"tools/list\",\"id\":1}'"
  echo ""
fi

# -----------------------------------------------------------------------------
# Cleanup
# -----------------------------------------------------------------------------
if [ "$SKIP_PACKAGE" = false ]; then
  echo "Cleaning up..."
  rm -f "$PROJECT_DIR/function.zip"
  echo "✓ Cleanup complete"
fi
echo ""
echo "Deployment finished successfully!"
