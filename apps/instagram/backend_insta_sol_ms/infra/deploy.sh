#!/bin/bash
set -euo pipefail

# =============================================================================
# Instagram Solution microservice - Deployment Script
# =============================================================================
# Usage: ./infra/deploy.sh <dev|prod>
#
# Loads apps/instagram/backend_insta_sol_ms/.env.dev or .env.prod (never a plain .env) and
# FORCES ENVIRONMENT_NAME to match the CLI argument, so a stale env file can
# never silently deploy dev as prod or vice versa. dev and prod are separate
# stacks with separate physical resource names - no shared state.
#
# Every physical resource is named <env>-realestateflow-insta-<resource>
# (env first), matching prod-realestateflow-networking-common.
#
# cfn-params.json is a BUILD ARTIFACT, regenerated fresh on every run. Never
# hand-edit it; it is gitignored.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/params.sh"

# -----------------------------------------------------------------------------
# Windows Git Bash compatibility (same approach as apps/crm/server/infra/deploy.sh)
# -----------------------------------------------------------------------------
OS_UNAME="$(uname -s || echo '')"
NPM_BIN="npm"
AWS_BIN="aws"
case "$OS_UNAME" in
  MINGW*|MSYS*|CYGWIN*)
    if command -v npm.cmd >/dev/null 2>&1; then NPM_BIN="npm.cmd"; fi
    if command -v aws.exe >/dev/null 2>&1; then AWS_BIN="aws.exe"; fi
    ;;
esac

# AWS CLI v2 on Windows is a native process and cannot read /d/... paths, so any
# file:// URL has to be handed a D:/... path instead.
winpath() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"
  elif command -v wslpath >/dev/null 2>&1; then wslpath -m "$1"
  else echo "$1"; fi
}

for bin in "$NPM_BIN" "$AWS_BIN" zip; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: $bin not found in PATH"
    exit 1
  fi
done

echo "============================================="
echo " Instagram Solution backend - Deploy"
echo "============================================="

# -----------------------------------------------------------------------------
# 0. Require an explicit dev|prod argument
# -----------------------------------------------------------------------------
DEPLOY_ENV="${1:-}"
if [ "$DEPLOY_ENV" != "dev" ] && [ "$DEPLOY_ENV" != "prod" ]; then
  echo "ERROR: Usage: $0 <dev|prod>"
  echo "  e.g. ./infra/deploy.sh prod"
  exit 1
fi

ENV_FILE="$PROJECT_DIR/.env.${DEPLOY_ENV}"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found at $ENV_FILE"
  echo "Copy apps/instagram/backend_insta_sol_ms/.env.sample to $ENV_FILE and fill in the values."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# The CLI argument is the source of truth, not whatever the file happens to say.
ENVIRONMENT_NAME="$DEPLOY_ENV"

REQUIRED_VARS=(
  AWS_REGION
  AWS_PROFILE
  STACK_NAME
  ARTIFACT_BUCKET
  ARTIFACT_PREFIX
  AUTH_SERVICE_DOMAIN_NAME
  AUTH_SERVICE_BASE_PATH
  INSTA_DATA_TABLE_NAME
  INSTA_AUDIT_TABLE_NAME
  ALLOWED_ORIGINS
)
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Required env var $var is not set in $ENV_FILE"
    exit 1
  fi
done

# Naming convention guard. Catches a copy-pasted env file before it creates a
# stack that does not match anything else in the account.
if [[ "$STACK_NAME" != "${ENVIRONMENT_NAME}-realestateflow-"* ]]; then
  echo "ERROR: STACK_NAME ('$STACK_NAME') must start with '${ENVIRONMENT_NAME}-realestateflow-'"
  exit 1
fi
for tbl_var in INSTA_DATA_TABLE_NAME INSTA_AUDIT_TABLE_NAME; do
  if [[ "${!tbl_var}" != "${ENVIRONMENT_NAME}-realestateflow-insta-"* ]]; then
    echo "ERROR: $tbl_var ('${!tbl_var}') must start with '${ENVIRONMENT_NAME}-realestateflow-insta-'"
    exit 1
  fi
done

assert_custom_domain_vars
assert_instagram_app_vars

AWS_ARGS=(--region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager)

echo "Deploy target: $DEPLOY_ENV (env file: $(basename "$ENV_FILE"))"
echo "Region:        $AWS_REGION"
echo "Profile:       $AWS_PROFILE"
echo "Stack:         $STACK_NAME"
echo "Data table:    $INSTA_DATA_TABLE_NAME"
echo "Audit table:   $INSTA_AUDIT_TABLE_NAME"
echo "Auth API:      https://$AUTH_SERVICE_DOMAIN_NAME/$AUTH_SERVICE_BASE_PATH"
echo "CRM API:       https://$CRM_INTERNAL_API_DOMAIN_NAME/$CRM_INTERNAL_API_BASE_PATH"
echo "Insta API:     https://$INSTA_API_DOMAIN_NAME/$INSTA_API_BASE_PATH (mapping=${ENABLE_CUSTOM_DOMAIN_MAPPING:-false}, strip=${ENABLE_BASE_PATH_STRIP:-false})"
echo ""

# Confirm which account we are actually about to deploy into. This repo has
# historically had env files pointing at the wrong account, so print it rather
# than assume it.
CALLER_ACCOUNT="$("$AWS_BIN" sts get-caller-identity "${AWS_ARGS[@]}" --query Account --output text)"
echo "AWS account:   $CALLER_ACCOUNT"
echo ""

TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")

# -----------------------------------------------------------------------------
# 1. Install production dependencies
# -----------------------------------------------------------------------------
echo "[1/6] Installing production dependencies..."
cd "$PROJECT_DIR"
"$NPM_BIN" ci --omit=dev --no-audit --no-fund 2>/dev/null || "$NPM_BIN" install --omit=dev --no-audit --no-fund

# -----------------------------------------------------------------------------
# 2. Package the Lambda bundle
# -----------------------------------------------------------------------------
echo "[2/6] Packaging function.zip..."
rm -f "$PROJECT_DIR/function.zip"
cd "$PROJECT_DIR"
zip -r -q -1 function.zip \
  node_modules package.json lambda.js server.js logger.js \
  routes/ middleware/ services/ config/ \
  -x "node_modules/.cache/*" "node_modules/**/*.ts" "node_modules/**/*.map" \
     "node_modules/**/*.d.ts" "node_modules/**/*.md" "node_modules/**/README*" \
     "node_modules/**/CHANGELOG*" "node_modules/**/LICENSE*" \
     "node_modules/**/test/*" "node_modules/**/tests/*" "node_modules/**/__tests__/*" \
     "node_modules/**/docs/*" "node_modules/**/examples/*" "node_modules/**/.github/*"

ZIP_BYTES=$(wc -c < "$PROJECT_DIR/function.zip")
echo "      function.zip: $((ZIP_BYTES / 1024)) KB"

# -----------------------------------------------------------------------------
# 3. Upload code + template to the artifact bucket
# -----------------------------------------------------------------------------
S3_KEY="${ARTIFACT_PREFIX}/function-${TIMESTAMP}.zip"
echo "[3/6] Uploading to s3://${ARTIFACT_BUCKET}/${S3_KEY}..."
"$AWS_BIN" s3 cp "$PROJECT_DIR/function.zip" "s3://${ARTIFACT_BUCKET}/${S3_KEY}" "${AWS_ARGS[@]}"

TEMPLATE_KEY="${ARTIFACT_PREFIX}/cfn-insta-sol-ms.yaml"
"$AWS_BIN" s3 cp "$SCRIPT_DIR/cfn-insta-sol-ms.yaml" "s3://${ARTIFACT_BUCKET}/${TEMPLATE_KEY}" "${AWS_ARGS[@]}"

# Record exactly what this run uploaded so the CI/CD wrapper can build a release
# manifest without recomputing a timestamp that would no longer match.
cat > "$SCRIPT_DIR/.last-deploy-artifacts.json" <<EOF
{
  "artifactBucket": "${ARTIFACT_BUCKET}",
  "codeS3Key": "${S3_KEY}",
  "templateS3Key": "${TEMPLATE_KEY}",
  "environment": "${ENVIRONMENT_NAME}",
  "stackName": "${STACK_NAME}",
  "timestamp": "${TIMESTAMP}"
}
EOF

# -----------------------------------------------------------------------------
# 4. Generate cfn-params.json (build artifact - regenerated every run)
# -----------------------------------------------------------------------------
echo "[4/6] Generating infra/cfn-params.json..."
compute_param_values "$S3_KEY"
write_cfn_params_json "$SCRIPT_DIR/cfn-params.json"

# Every template Parameter must appear above, or it silently falls back to its
# Default and the env file cannot override it. Check it rather than trusting it.
echo "      Cross-checking params against the template..."
node -e '
  const fs = require("fs");
  const tpl = fs.readFileSync(process.argv[1], "utf8");
  const params = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).map(p => p.ParameterKey);
  const section = tpl.split(/^Resources:/m)[0].split(/^Parameters:/m)[1] || "";
  const declared = [...section.matchAll(/^  ([A-Za-z0-9]+):$/gm)].map(m => m[1]);
  const missing = declared.filter(d => !params.includes(d));
  const extra = params.filter(p => !declared.includes(p));
  if (extra.length) {
    console.error("      ERROR: params not in template (deploy would hard-fail): " + extra.join(", "));
    process.exit(1);
  }
  if (missing.length) {
    console.error("      WARNING: template params never passed (will use Default): " + missing.join(", "));
  }
  console.log("      OK: " + params.length + " params, " + declared.length + " declared");
' "$SCRIPT_DIR/cfn-insta-sol-ms.yaml" "$SCRIPT_DIR/cfn-params.json"

# -----------------------------------------------------------------------------
# 5. Deploy the CloudFormation stack
# -----------------------------------------------------------------------------
echo "[5/6] Deploying stack $STACK_NAME..."

# One array element per Key=Value, so a value containing a space
# (WorkerScheduleExpression "rate(2 minutes)") stays a single argument.
mapfile -t PARAM_OVERRIDES < <(node -e '
  const p = require(process.argv[1]);
  for (const x of p) console.log(x.ParameterKey + "=" + x.ParameterValue);
' "$(winpath "$SCRIPT_DIR/cfn-params.json")" | tr -d '\r')

"$AWS_BIN" cloudformation deploy \
  --template-file "$(winpath "$SCRIPT_DIR/cfn-insta-sol-ms.yaml")" \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT_NAME" Service=realestateflow-insta \
  --parameter-overrides "${PARAM_OVERRIDES[@]}" \
  "${AWS_ARGS[@]}"

# -----------------------------------------------------------------------------
# 6. Force an API Gateway stage deployment and print outputs
# -----------------------------------------------------------------------------
echo "[6/6] Forcing API Gateway stage deployment..."
API_ID="$("$AWS_BIN" cloudformation describe-stacks --stack-name "$STACK_NAME" "${AWS_ARGS[@]}" \
  --query "Stacks[0].Outputs[?OutputKey=='InstaRestApiId'].OutputValue" --output text)"
if [ -n "$API_ID" ] && [ "$API_ID" != "None" ]; then
  "$AWS_BIN" apigateway create-deployment \
    --rest-api-id "$API_ID" \
    --stage-name "${API_STAGE_NAME:-v1}" \
    --description "deploy.sh $TIMESTAMP" \
    "${AWS_ARGS[@]}" >/dev/null
  echo "      Stage ${API_STAGE_NAME:-v1} redeployed."
fi

echo ""
echo "============================================="
echo " Deploy complete"
echo "============================================="
"$AWS_BIN" cloudformation describe-stacks --stack-name "$STACK_NAME" "${AWS_ARGS[@]}" \
  --query "Stacks[0].Outputs" --output table

echo ""
echo "Cleaning up function.zip..."
rm -f "$PROJECT_DIR/function.zip"
echo "Done."
