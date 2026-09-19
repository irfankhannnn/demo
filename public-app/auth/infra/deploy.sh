#!/bin/bash
set -euo pipefail

# =============================================================================
# marketplace-authentication — Deployment Script
# =============================================================================
# Usage: ./infra/deploy.sh <dev|prod>
#   Loads .env.dev or .env.prod (never a plain .env) and forces ENV to match
#   the argument, so every physical resource is named
#   <dev|prod>-realestateflow-marketplace-auth-* and the stack is
#   <dev|prod>-realestateflow-marketplace-auth-stack. dev and prod are
#   separate stacks.
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

# winpath <posix path> — the AWS CLI on Windows wants C:\... paths for
# file:// and --template-file arguments; a no-op elsewhere.
winpath() {
  case "$OS_UNAME" in
    MINGW*|MSYS*|CYGWIN*)
      if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else echo "$1"; fi
      ;;
    *) echo "$1" ;;
  esac
}

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
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found in PATH"
  exit 1
fi

echo "============================================="
echo " marketplace-authentication — Deploy"
echo "============================================="

# -----------------------------------------------------------------------------
# 0. Require an explicit dev|prod argument and load the matching env file
# -----------------------------------------------------------------------------
DEPLOY_ENV="${1:-}"
if [ "$DEPLOY_ENV" != "dev" ] && [ "$DEPLOY_ENV" != "prod" ]; then
  echo "ERROR: Usage: $0 <dev|prod>"
  exit 1
fi

ENV_FILE="$PROJECT_DIR/.env.${DEPLOY_ENV}"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found at $ENV_FILE"
  echo "Copy sample.env to $ENV_FILE and fill in the values."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# The CLI argument is the source of truth, not whatever the env file says.
ENV="$DEPLOY_ENV"
ENVIRONMENT_NAME="$DEPLOY_ENV"
export ENV ENVIRONMENT_NAME

echo "Deploy target: $DEPLOY_ENV (env file: $(basename "$ENV_FILE"))"
echo ""

REQUIRED_VARS=(
  AWS_REGION
  SERVICE_NAME
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
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
if [[ "$LAMBDA_PACKAGES_BUCKET_NAME" != "${ENV}-realestateflow-artifacts" ]]; then
  echo "ERROR: LAMBDA_PACKAGES_BUCKET_NAME ('$LAMBDA_PACKAGES_BUCKET_NAME') must be ${ENV}-realestateflow-artifacts for a $ENV deploy"
  exit 1
fi
if [ "$ENV" = "prod" ] && [ "${TEST_OTP_ENABLED:-false}" = "true" ]; then
  echo "ERROR: TEST_OTP_ENABLED=true in .env.prod — a fixed OTP in prod is a login bypass. Refusing."
  exit 1
fi
if [ -z "${AUTH_CALLER_API_KEY:-}" ]; then
  echo "WARNING: AUTH_CALLER_API_KEY is empty — DELETE /auth/me will skip the marketplace-api purge (logged, not fatal)."
fi

validate_custom_domain_vars

STACK_NAME="${ENV}-${SERVICE_NAME}-stack"

echo "Region:     $AWS_REGION"
echo "Stack:      $STACK_NAME"
echo "Service:    $SERVICE_NAME"
echo "Env:        $ENV"
echo ""

# -----------------------------------------------------------------------------
# 1. Params ↔ template cross-check (before spending time on a build)
# -----------------------------------------------------------------------------
echo "[1/7] Cross-checking infra/lib/params.sh against cfn-backend.yaml..."
compute_param_values
check_params_match_template "$SCRIPT_DIR/cfn-backend.yaml"

# -----------------------------------------------------------------------------
# 2. Install dependencies and build
# -----------------------------------------------------------------------------
echo "[2/7] Installing dependencies..."
cd "$PROJECT_DIR"
"$NPM_BIN" ci --no-audit --no-fund

echo "[3/7] Building TypeScript..."
"$NPM_BIN" run build

# -----------------------------------------------------------------------------
# 3. Package Lambda bundle (production deps only — tests and fakes excluded)
# -----------------------------------------------------------------------------
echo "[4/7] Packaging function.zip..."
rm -f "$PROJECT_DIR/function.zip"
cd "$PROJECT_DIR"
zip -r -q function.zip node_modules dist package.json \
  -x "node_modules/.cache/*" "node_modules/typescript/*" "node_modules/ts-node/*" \
     "node_modules/@types/*" "node_modules/rimraf/*" \
     "dist/*.test.js" "dist/**/*.test.js" "dist/**/*.test.js.map" "dist/testing/*"

# -----------------------------------------------------------------------------
# 4. Upload to S3
# -----------------------------------------------------------------------------
S3_KEY="${SERVICE_NAME}/function.zip"
echo "[5/7] Uploading function.zip to s3://${LAMBDA_PACKAGES_BUCKET_NAME}/${S3_KEY}..."
"$AWS_BIN" s3 cp "$(winpath "$PROJECT_DIR/function.zip")" "s3://${LAMBDA_PACKAGES_BUCKET_NAME}/${S3_KEY}" --region "$AWS_REGION" --no-cli-pager

echo "[5b/7] Forcing Lambda code update (no-op on first deploy)..."
LAMBDA_NAME="${ENV}-${SERVICE_NAME}-lambda"
"$AWS_BIN" lambda update-function-code \
  --function-name "$LAMBDA_NAME" \
  --s3-bucket "$LAMBDA_PACKAGES_BUCKET_NAME" \
  --s3-key "$S3_KEY" \
  --region "$AWS_REGION" \
  --no-cli-pager >/dev/null || echo "Note: Lambda $LAMBDA_NAME does not exist yet (first deploy) — CloudFormation will create it."

# -----------------------------------------------------------------------------
# 5. Generate cfn-params.json from .env
# -----------------------------------------------------------------------------
echo "[6/7] Generating infra/cfn-params.json..."
write_cfn_params_json "$SCRIPT_DIR/cfn-params.json"

# -----------------------------------------------------------------------------
# 6. Deploy CloudFormation stack
# -----------------------------------------------------------------------------
echo "[7/7] Deploying CloudFormation stack: $STACK_NAME..."
PARAM_OVERRIDES=()
for key in "${PARAM_KEYS[@]}"; do
  PARAM_OVERRIDES+=("${key}=${PARAM_VALUES[$key]}")
done
"$AWS_BIN" cloudformation deploy \
  --template-file "$(winpath "$SCRIPT_DIR/cfn-backend.yaml")" \
  --stack-name "$STACK_NAME" \
  --parameter-overrides "${PARAM_OVERRIDES[@]}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$AWS_REGION" \
  --no-cli-pager \
  --no-fail-on-empty-changeset

# AWS::ApiGateway::Deployment does not reliably republish on content
# changes; always publish a fresh deployment to the stage explicitly.
REST_API_ID="$("$AWS_BIN" cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='RestApiId'].OutputValue" \
  --output text --no-cli-pager)"
echo "[7b/7] Publishing fresh API Gateway deployment to stage '$ENV' (rest api $REST_API_ID)..."
"$AWS_BIN" apigateway create-deployment \
  --rest-api-id "$REST_API_ID" \
  --stage-name "$ENV" \
  --description "infra/deploy.sh $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --region "$AWS_REGION" \
  --no-cli-pager >/dev/null

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
echo "Cleaning up function.zip..."
rm -f "$PROJECT_DIR/function.zip"
echo "Done."
