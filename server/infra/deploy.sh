#!/bin/bash
set -euo pipefail

# =============================================================================
# CRM Backend Microservice â€” Deployment Script
# =============================================================================
# Usage: ./infra/deploy.sh <dev|prod>
#   Loads server/.env.dev or server/.env.prod (never a plain server/.env) and
#   forces ENVIRONMENT_NAME to match the argument, so every physical resource
#   this stack creates is named <dev|prod>-realestateflow-*. dev and prod are
#   separate stacks (separate STACK_NAME per env file) — there is no shared
#   state between them.
# Toggle deployment steps here:
#   DEPLOY_LAMBDA=true  = deploy Lambda code + API Gateway
#   DEPLOY_LAMBDA=false = deploy API Gateway only
#   DEPLOY_INSTALL=true = run npm install
#   DEPLOY_INSTALL=false = skip npm install
#   DEPLOY_ZIP=true     = create and upload function.zip
#   DEPLOY_ZIP=false    = skip zip creation/upload
#   DEPLOY_CFN=true     = deploy CloudFormation stack
#   DEPLOY_CFN=false    = skip CloudFormation deployment (Lambda update only)
# Set these manually before running the script.
#
# Defaulting to false keeps the deploy API Gateway-only by default.
# Requires: .env file in project root with all required variables
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/generate-cfn-params.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/validate-service-endpoints.sh"

DEPLOY_LAMBDA=true
DEPLOY_INSTALL=true
DEPLOY_ZIP=true
DEPLOY_CFN=true


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

# aws.exe (AWS CLI v2) is a self-contained/frozen Python binary that reads
# local files (e.g. --template-file) using the system codepage on Windows
# (cp1252 here), not UTF-8 — confirmed PYTHONUTF8=1 has no effect on it
# (unlike a normal python.exe), so the only real fix is keeping
# cfn-backend.yaml free of non-ASCII bytes that land in cp1252's undefined
# range (comment banners using box-drawing characters have hit this: "
# 'charmap' codec can't decode byte 0x90..." mid-deploy). Keep template
# comments/strings plain ASCII.

# Convert a POSIX path to a Windows-style path when running under Git Bash/MSYS/Cygwin.
# AWS CLI (a Windows process) cannot read /d/... paths, so file:// URLs need D:/... paths.
winpath() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  elif command -v wslpath >/dev/null 2>&1; then
    wslpath -m "$1"
  else
    echo "$1"
  fi
}

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
echo " CRM Backend â€” Deploy"
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
  echo "Copy server/.env.sample to $ENV_FILE and fill in the values."
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

# The CLI argument is the source of truth, not whatever ENVIRONMENT_NAME the
# env file happens to set — this is what stops a dev deploy from silently
# reusing prod's stack/table names (or vice versa) if the file drifts.
ENVIRONMENT_NAME="$DEPLOY_ENV"

echo "Deploy target: $DEPLOY_ENV (env file: $(basename "$ENV_FILE"))"
echo ""

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

echo "Region:     $AWS_REGION"
echo "Stack:      $STACK_NAME"
echo "Auth API:   https://${AUTH_SERVICE_DOMAIN_NAME}/${AUTH_SERVICE_BASE_PATH}"
if [ -n "${MCP_API_DOMAIN_NAME:-}" ]; then
  echo "MCP API:    https://${MCP_API_DOMAIN_NAME}/${MCP_API_BASE_PATH}"
else
  echo "MCP API:    (not configured)"
fi
echo "OAuth Code Table:      ${OAUTH_CODES_TABLE_NAME:-realestate-flow-${ENVIRONMENT_NAME}-oauth-codes}"
echo "OAuth Connection Table: ${OAUTH_CONNECTIONS_TABLE:-realestate-flow-${ENVIRONMENT_NAME}-oauth-connections}"
echo ""
echo "NOTE: This stack requires the MCP OAuth tables to exist before deployment."
echo "      Deploy the reality-flow-mcp stack first, or create these tables manually."
echo ""

# Generate timestamp for deployment descriptions
TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")

# -----------------------------------------------------------------------------
# 2. Install dependencies
# -----------------------------------------------------------------------------
if [ "$DEPLOY_LAMBDA" = true ] && [ "$DEPLOY_INSTALL" = true ]; then
  echo "[1/8] Installing dependencies..."
  cd "$PROJECT_DIR"
  "$NPM_BIN" ci --omit=dev --no-audit --no-fund
elif [ "$DEPLOY_LAMBDA" = true ] && [ "$DEPLOY_INSTALL" = false ]; then
  echo "[1/8] Skipping npm install (DEPLOY_INSTALL=false)."
fi

# -----------------------------------------------------------------------------
# 3. Package Lambda bundle
# -----------------------------------------------------------------------------
if [ "$DEPLOY_LAMBDA" = true ] && [ "$DEPLOY_ZIP" = true ]; then
  echo "[2/8] Packaging function.zip..."
  rm -f "$PROJECT_DIR/function.zip"
  cd "$PROJECT_DIR"
  # Use compression level 1 for fast packaging. Level 0 (store) is even faster but larger.
  # Excluding node_modules TypeScript sources, source maps, docs, and metadata saves ~60+ MB and thousands of files.
  zip -r -q -1 function.zip node_modules package.json *.js routes/ middleware/ utils/ validation/ public/ lib/ scripts/ shared/ normalizers/ services/ constants/ domain/ aiViewBuilders/ oauth/ workers/ bailey.js emailService.js creditConfig.js creditService.js razorpayOrders.js teamAnalyticsService.js skillInvoker.js dataQualityService.js whatsappAuditService.js agents/ observability/ config/ \
    -x "node_modules/.cache/*" "node_modules/typescript/*" "node_modules/ts-node/*" \
       "node_modules/**/*.ts" "node_modules/**/*.map" "node_modules/**/*.d.ts" \
       "node_modules/**/*.md" "node_modules/**/*.markdown" "node_modules/**/*.yml" "node_modules/**/*.yaml" \
       "node_modules/**/*.tsbuildinfo" "node_modules/**/*.flow" \
       "node_modules/**/.npmignore" "node_modules/**/.eslintrc*" "node_modules/**/.editorconfig" \
       "node_modules/**/.gitkeep" "node_modules/**/.gitattributes" "node_modules/**/.nycrc" \
       "node_modules/**/.jshintrc" "node_modules/**/.bnf" "node_modules/**/.github/*" "node_modules/**/.bin/*" \
       "node_modules/**/README*" "node_modules/**/CHANGELOG*" "node_modules/**/LICENSE*" \
       "node_modules/**/AUTHORS*" "node_modules/**/CONTRIBUTORS*" "node_modules/**/HISTORY*" "node_modules/**/NOTICE*" \
       "node_modules/**/docs/*" "node_modules/**/tests/*" "node_modules/**/test/*" "node_modules/**/__tests__/*" \
       "node_modules/**/coverage/*" "node_modules/**/examples/*" "node_modules/**/benchmarks/*" \
       "deploy*.ps1" "deploy.ps1" "*.md" ".git*" "cfn/*" "infra/*" "mcp-server/*"

  # -----------------------------------------------------------------------------
  # 4. Upload to S3
  # -----------------------------------------------------------------------------
  S3_KEY="${ARTIFACT_PREFIX}/function-${TIMESTAMP}.zip"
  echo "[3/8] Uploading function.zip to s3://${ARTIFACT_BUCKET}/${S3_KEY}..."
  "$AWS_BIN" s3 cp "$PROJECT_DIR/function.zip" "s3://${ARTIFACT_BUCKET}/${S3_KEY}" --region "$AWS_REGION" --no-cli-pager
elif [ "$DEPLOY_LAMBDA" = true ] && [ "$DEPLOY_ZIP" = false ]; then
  echo "[2/8] Skipping zip creation (DEPLOY_ZIP=false)."
  echo "[3/8] Skipping S3 upload (DEPLOY_ZIP=false)."
elif [ "$DEPLOY_LAMBDA" = false ]; then
  echo "[1/8] Skipping Lambda deployment (DEPLOY_LAMBDA=false)."
fi

# Upload nested route templates (split to stay under CloudFormation 500-resource limit)
NESTED_TEMPLATE_KEY="${ARTIFACT_PREFIX}/apigw-explicit-routes-part1.yaml"
NESTED_TEMPLATE_KEY_PART2="${ARTIFACT_PREFIX}/apigw-explicit-routes-part2.yaml"
echo "[4/8] Uploading nested route templates to s3://${ARTIFACT_BUCKET}/..."
"$AWS_BIN" s3 cp "$SCRIPT_DIR/apigw-explicit-routes-part1.yaml" "s3://${ARTIFACT_BUCKET}/${NESTED_TEMPLATE_KEY}" --region "$AWS_REGION" --no-cli-pager
"$AWS_BIN" s3 cp "$SCRIPT_DIR/apigw-explicit-routes-part2.yaml" "s3://${ARTIFACT_BUCKET}/${NESTED_TEMPLATE_KEY_PART2}" --region "$AWS_REGION" --no-cli-pager

TEMPLATE_URL="https://s3.${AWS_REGION}.amazonaws.com/${ARTIFACT_BUCKET}/${NESTED_TEMPLATE_KEY}"
TEMPLATE_URL_PART2="https://s3.${AWS_REGION}.amazonaws.com/${ARTIFACT_BUCKET}/${NESTED_TEMPLATE_KEY_PART2}"

# Upload main template (required if >51.2KB)
MAIN_TEMPLATE_KEY="${ARTIFACT_PREFIX}/cfn-backend.yaml"
echo "[4/8] Uploading main template to s3://${ARTIFACT_BUCKET}/${MAIN_TEMPLATE_KEY}..."
"$AWS_BIN" s3 cp "$SCRIPT_DIR/cfn-backend.yaml" "s3://${ARTIFACT_BUCKET}/${MAIN_TEMPLATE_KEY}" --region "$AWS_REGION" --no-cli-pager

MAIN_TEMPLATE_URL="https://s3.${AWS_REGION}.amazonaws.com/${ARTIFACT_BUCKET}/${MAIN_TEMPLATE_KEY}"

# Record the exact S3 keys this run used, for the CI/CD wrapper
# (cfn-templates-cicd/server/deploy.sh) to read afterward — it needs these
# to build a release manifest, but can't safely recompute S3_KEY itself
# (it's timestamped at the moment this script reaches this line, not when
# the wrapper's own shell would evaluate `date`). Build artifact, not
# source — see .gitignore.
cat > "$SCRIPT_DIR/.last-deploy-artifacts.json" <<EOF
{
  "artifactBucket": "${ARTIFACT_BUCKET}",
  "codeS3Key": "${S3_KEY:-}",
  "mainTemplateS3Key": "${MAIN_TEMPLATE_KEY}",
  "routesTemplatePart1S3Key": "${NESTED_TEMPLATE_KEY}",
  "routesTemplatePart2S3Key": "${NESTED_TEMPLATE_KEY_PART2}"
}
EOF

# -----------------------------------------------------------------------------
# 5. Generate cfn-params.json from .env
# -----------------------------------------------------------------------------
echo "[5/8] Generating infra/cfn-params.json..."
if [ "$DEPLOY_LAMBDA" = true ] && [ "$DEPLOY_ZIP" = true ]; then
  write_cfn_params_json "$SCRIPT_DIR/cfn-params.json" "$S3_KEY" "$TEMPLATE_URL" "$TEMPLATE_URL_PART2" "true"
else
  write_cfn_params_json "$SCRIPT_DIR/cfn-params.json" "" "$TEMPLATE_URL" "$TEMPLATE_URL_PART2" "true"
fi

# -----------------------------------------------------------------------------
# 6. Sync config to SSM Parameter Store
# -----------------------------------------------------------------------------
# Must run before the Lambda deploy below (step 8) — both Lambdas fetch their
# config from SSM at cold start (config/ssmBootstrap.js), so the values need
# to already be in place before either one starts running the new code.
echo "[6/8] Syncing config to SSM Parameter Store..."
"$SCRIPT_DIR/sync-ssm-params.sh" "$ENVIRONMENT_NAME"

# -----------------------------------------------------------------------------
# 7. Check for dependent MCP OAuth tables
# -----------------------------------------------------------------------------
OAUTH_CODES_TABLE="${OAUTH_CODES_TABLE_NAME:-realestate-flow-${ENVIRONMENT_NAME}-oauth-codes}"
OAUTH_CONNECTIONS_TABLE="${OAUTH_CONNECTIONS_TABLE:-realestate-flow-${ENVIRONMENT_NAME}-oauth-connections}"

if [ "$DEPLOY_CFN" = true ]; then
  echo "[7/8] Checking for dependent MCP OAuth tables..."
  if ! "$AWS_BIN" dynamodb describe-table --table-name "$OAUTH_CODES_TABLE" --region "$AWS_REGION" > /dev/null 2>&1; then
    echo "WARNING: OAuth codes table '$OAUTH_CODES_TABLE' does not exist. Deploy the MCP stack first or create the table manually."
  fi
  if ! "$AWS_BIN" dynamodb describe-table --table-name "$OAUTH_CONNECTIONS_TABLE" --region "$AWS_REGION" > /dev/null 2>&1; then
    echo "WARNING: OAuth connections table '$OAUTH_CONNECTIONS_TABLE' does not exist. Deploy the MCP stack first or create the table manually."
  fi
fi

# -----------------------------------------------------------------------------
# 7. Deploy CloudFormation stack or update Lambda directly
# -----------------------------------------------------------------------------

# Helper: wait for stack to be in a stable state before deploying
wait_for_stack_stable() {
  local stack_name="$1"
  local max_wait=300  # 5 minutes
  local waited=0

  while [ $waited -lt $max_wait ]; do
    local status
    status=$("$AWS_BIN" cloudformation describe-stacks \
      --stack-name "$stack_name" \
      --region "$AWS_REGION" \
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
        echo "  Run: aws cloudformation describe-stack-events --stack-name $stack_name --region $AWS_REGION"
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

# Helper: deploy CloudFormation with retry for transient API Gateway failures
cfn_deploy_with_retry() {
  local max_attempts=3
  local attempt=1
  local delay=30

  while [ $attempt -le $max_attempts ]; do
    echo "  Attempt $attempt/$max_attempts..."

    if "$AWS_BIN" cloudformation deploy \
      --template-file "$SCRIPT_DIR/cfn-backend.yaml" \
      --stack-name "$STACK_NAME" \
      --s3-bucket "$ARTIFACT_BUCKET" \
      --s3-prefix "${ARTIFACT_PREFIX}" \
      --parameter-overrides file://$(winpath "$SCRIPT_DIR")/cfn-params.json \
      --capabilities CAPABILITY_NAMED_IAM \
      --region "$AWS_REGION" \
      --no-cli-pager \
      --no-fail-on-empty-changeset 2>&1; then
      echo "  CloudFormation deploy successful"
      return 0
    fi

    if [ $attempt -eq $max_attempts ]; then
      echo "  ERROR: CloudFormation deploy failed after $max_attempts attempts"
      return 1
    fi

    echo "  Deploy failed, waiting ${delay}s before retry..."
    echo "  Checking if stack is rolling back..."
    sleep "$delay"

    # Wait for rollback to complete before retrying
    if ! wait_for_stack_stable "$STACK_NAME"; then
      echo "  ERROR: Stack is not in a stable state, cannot retry"
      return 1
    fi

    delay=$((delay * 2))
    attempt=$((attempt + 1))
  done
}

set_route_part2_parameter() {
  local enabled="$1"

  python - "$SCRIPT_DIR/cfn-params.json" "$enabled" <<'PY'
import json
import sys

params_path, enabled = sys.argv[1:]
with open(params_path, encoding="utf-8") as params_file:
    params = json.load(params_file)

for parameter in params:
    if parameter["ParameterKey"] == "DeployApiRoutePart2":
        parameter["ParameterValue"] = enabled
        break
else:
    params.append({
        "ParameterKey": "DeployApiRoutePart2",
        "ParameterValue": enabled,
    })

with open(params_path, "w", encoding="utf-8") as params_file:
    json.dump(params, params_file, indent=2)
    params_file.write("\n")
PY
}

route_split_migration_required() {
  local part2_stacks
  part2_stacks=$("$AWS_BIN" cloudformation list-stack-resources \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "StackResourceSummaries[?LogicalResourceId=='PublicApiResourcesStackPart2' || LogicalResourceId=='CrmApiResourcesStackPart2'].LogicalResourceId" \
    --output text \
    --no-cli-pager)

  [ -z "$part2_stacks" ] || [ "$part2_stacks" = "None" ]
}

if [ "$DEPLOY_CFN" = true ]; then
  echo "[8/8] Deploying CloudFormation stack: $STACK_NAME..."

  # Pre-check: ensure stack is in a stable state before deploying
  echo "  Checking stack status..."
  if ! wait_for_stack_stable "$STACK_NAME"; then
    echo "  ERROR: Stack is not stable. Fix the stack state before deploying."
    exit 1
  fi

  if route_split_migration_required; then
    echo "  Migrating explicit API routes: updating existing Part 1 stacks first..."
    echo "  The /api proxy remains available while the old route resources are moved."
    set_route_part2_parameter false
    cfn_deploy_with_retry

    echo "  Creating explicit API route Part 2 stacks..."
    set_route_part2_parameter true
    cfn_deploy_with_retry
  else
    cfn_deploy_with_retry
  fi
elif [ "$DEPLOY_CFN" = false ] && [ "$DEPLOY_LAMBDA" = true ] && [ "$DEPLOY_ZIP" = true ]; then
  echo "[8/8] Skipping CloudFormation deployment (DEPLOY_CFN=false)."
  echo "[8/8] Updating Lambda function directly..."
  "$AWS_BIN" lambda update-function-code \
    --function-name "${ENVIRONMENT_NAME}-realestateflow-api" \
    --s3-bucket "${ARTIFACT_BUCKET}" \
    --s3-key "${S3_KEY}" \
    --region "$AWS_REGION" \
    --no-cli-pager

  # The call recording worker ships the same zip with a different handler, so a
  # code-only deploy has to refresh it too or the two drift apart.
  CALL_RECORDING_WORKER_NAME="${ENVIRONMENT_NAME}-realestateflow-call-recording-worker"
  if "$AWS_BIN" lambda get-function --function-name "$CALL_RECORDING_WORKER_NAME" --region "$AWS_REGION" > /dev/null 2>&1; then
    echo "[8/8] Updating call recording worker Lambda ($CALL_RECORDING_WORKER_NAME)..."
    "$AWS_BIN" lambda update-function-code \
      --function-name "$CALL_RECORDING_WORKER_NAME" \
      --s3-bucket "${ARTIFACT_BUCKET}" \
      --s3-key "${S3_KEY}" \
      --region "$AWS_REGION" \
      --no-cli-pager
  else
    echo "[8/8] Call recording worker Lambda not found ($CALL_RECORDING_WORKER_NAME); run a CloudFormation deploy to create it."
  fi
elif [ "$DEPLOY_CFN" = false ] && [ "$DEPLOY_LAMBDA" = true ] && [ "$DEPLOY_ZIP" = false ]; then
  echo "[8/8] Skipping CloudFormation deployment (DEPLOY_CFN=false)."
  echo "[8/8] Skipping Lambda update (DEPLOY_ZIP=false)."
else
  echo "[8/8] Skipping CloudFormation deployment (DEPLOY_CFN=false)."
fi

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
