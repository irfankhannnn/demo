#!/bin/bash
set -euo pipefail

# =============================================================================
# property-pages-ms - Deployment Script
# =============================================================================
# Usage: ./infra/deploy.sh <dev|prod>
#
# Loads public-app/property-pages/.env.dev or .env.prod (never a plain .env) and FORCES
# ENVIRONMENT_NAME to match the CLI argument, so a stale env file can never
# silently deploy dev as prod. dev and prod are separate stacks with separate
# physical resource names.
#
# Every physical resource is named <env>-realestateflow-pages-<resource>.
#
# cfn-params.json is a BUILD ARTIFACT, regenerated on every run. Never
# hand-edit it; it is gitignored.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/params.sh"

# Windows Git Bash compatibility (same approach as agency-app/api/infra/deploy.sh)
OS_UNAME="$(uname -s || echo '')"
NPM_BIN="npm"
AWS_BIN="aws"
case "$OS_UNAME" in
  MINGW*|MSYS*|CYGWIN*)
    if command -v npm.cmd >/dev/null 2>&1; then NPM_BIN="npm.cmd"; fi
    if command -v aws.exe >/dev/null 2>&1; then AWS_BIN="aws.exe"; fi
    ;;
esac

# AWS CLI v2 on Windows is a native process and cannot read /d/... paths, so
# any file:// URL has to be handed a D:/... path instead.
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
echo " Public property pages - Deploy"
echo "============================================="

# -----------------------------------------------------------------------------
# 0. Require an explicit dev|prod argument
# -----------------------------------------------------------------------------
DEPLOY_ENV="${1:-}"
if [ "$DEPLOY_ENV" != "dev" ] && [ "$DEPLOY_ENV" != "prod" ]; then
  echo "ERROR: Usage: $0 <dev|prod>"
  exit 1
fi

ENV_FILE="$PROJECT_DIR/.env.${DEPLOY_ENV}"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found at $ENV_FILE"
  echo "Copy public-app/property-pages/.env.sample to $ENV_FILE and fill in the values."
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
  CRM_INTERNAL_API_DOMAIN_NAME
  CRM_INTERNAL_API_BASE_PATH
  PUBLIC_PAGES_INTERNAL_API_KEY
  VISIT_SESSION_SECRET
)
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Required env var $var is not set in $ENV_FILE"
    exit 1
  fi
done

# Naming convention guard — catches a copy-pasted env file before it creates a
# stack that matches nothing else in the account.
# Custom domain + base path only; raw execute-api hosts are refused.
if ! validate_custom_domain_vars; then
  echo "Fix the custom-domain settings in $ENV_FILE."
  exit 1
fi

if [[ "$STACK_NAME" != "${ENVIRONMENT_NAME}-realestateflow-"* ]]; then
  echo "ERROR: STACK_NAME ('$STACK_NAME') must start with '${ENVIRONMENT_NAME}-realestateflow-'"
  exit 1
fi

# A weak signing secret is worse than a missing one: it looks configured while
# leaving booking session tokens forgeable. The app refuses to start on this
# too, but failing here saves a full deploy cycle to discover it.
if [ "${#VISIT_SESSION_SECRET}" -lt 32 ]; then
  echo "ERROR: VISIT_SESSION_SECRET must be at least 32 characters."
  echo "       Generate one with: openssl rand -hex 32"
  exit 1
fi

# The captcha verifier fails closed, so a half-configured pair would demand a
# captcha that can never be satisfied and block every flagged booking.
if { [ -n "${HCAPTCHA_SITE_KEY:-}" ] && [ -z "${HCAPTCHA_SECRET_KEY:-}" ]; } ||
   { [ -z "${HCAPTCHA_SITE_KEY:-}" ] && [ -n "${HCAPTCHA_SECRET_KEY:-}" ]; }; then
  echo "ERROR: Set HCAPTCHA_SITE_KEY and HCAPTCHA_SECRET_KEY together, or neither."
  exit 1
fi

AWS_ARGS=(--region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager)

echo "Deploy target:  $DEPLOY_ENV (env file: $(basename "$ENV_FILE"))"
echo "Region:         $AWS_REGION"
echo "Profile:        $AWS_PROFILE"
echo "Stack:          $STACK_NAME"
echo "CRM API:        https://${CRM_INTERNAL_API_DOMAIN_NAME}/${CRM_INTERNAL_API_BASE_PATH}/api/internal/public-pages"
echo "Pages API:      https://${PAGES_API_DOMAIN_NAME}/${PAGES_API_BASE_PATH}"
echo "Base domain:    ${PUBLIC_PAGES_BASE_DOMAIN:-<none, path fallback only>}"
echo "CloudFront:     ${ENABLE_CLOUDFRONT:-true}"
echo ""

# This repo has historically had env files pointing at the wrong account, so
# print it rather than assume it.
CALLER_ACCOUNT="$("$AWS_BIN" sts get-caller-identity "${AWS_ARGS[@]}" --query Account --output text)"
echo "AWS account:    $CALLER_ACCOUNT"
echo ""

TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")

# -----------------------------------------------------------------------------
# 1. Test before packaging
# -----------------------------------------------------------------------------
# The suite covers escaping, session forgery/replay and the booking flow. None
# of it needs AWS, and shipping a broken escape into a public page is exactly
# the failure worth thirty seconds here.
echo "[1/7] Running tests..."
cd "$PROJECT_DIR"
# The suite needs devDependencies (the test runner's helpers), which step 2
# deliberately omits. A fresh checkout has no node_modules at all, so install
# the full set first; step 2 then prunes it back to production-only.
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo "      node_modules missing - installing full dependency set for the tests"
  "$NPM_BIN" ci --no-audit --no-fund 2>/dev/null || "$NPM_BIN" install --no-audit --no-fund
fi
"$NPM_BIN" test

# -----------------------------------------------------------------------------
# 2. Install production dependencies
# -----------------------------------------------------------------------------
echo "[2/7] Installing production dependencies..."
"$NPM_BIN" ci --omit=dev --no-audit --no-fund 2>/dev/null || "$NPM_BIN" install --omit=dev --no-audit --no-fund

# -----------------------------------------------------------------------------
# 3. Package the Lambda bundle
# -----------------------------------------------------------------------------
echo "[3/7] Packaging function.zip..."
rm -f "$PROJECT_DIR/function.zip"
zip -r -q -1 function.zip \
  node_modules package.json lambda.js server.js logger.js \
  routes/ middleware/ services/ config/ views/ \
  -x "node_modules/.cache/*" "node_modules/**/*.ts" "node_modules/**/*.map" \
     "node_modules/**/*.d.ts" "node_modules/**/*.md" "node_modules/**/README*" \
     "node_modules/**/CHANGELOG*" "node_modules/**/LICENSE*" \
     "node_modules/**/test/*" "node_modules/**/tests/*" "node_modules/**/__tests__/*" \
     "node_modules/**/docs/*" "node_modules/**/examples/*" "node_modules/**/.github/*"

ZIP_BYTES=$(wc -c < "$PROJECT_DIR/function.zip")
echo "      function.zip: $((ZIP_BYTES / 1024)) KB"

# -----------------------------------------------------------------------------
# 4. Upload code + template to the artifact bucket
# -----------------------------------------------------------------------------
S3_KEY="${ARTIFACT_PREFIX}/function-${TIMESTAMP}.zip"
echo "[4/7] Uploading to s3://${ARTIFACT_BUCKET}/${S3_KEY}..."
"$AWS_BIN" s3 cp "$PROJECT_DIR/function.zip" "s3://${ARTIFACT_BUCKET}/${S3_KEY}" "${AWS_ARGS[@]}"

TEMPLATE_KEY="${ARTIFACT_PREFIX}/cfn-property-pages.yaml"
"$AWS_BIN" s3 cp "$SCRIPT_DIR/cfn-property-pages.yaml" "s3://${ARTIFACT_BUCKET}/${TEMPLATE_KEY}" "${AWS_ARGS[@]}"

# Record exactly what this run uploaded so the CI/CD wrapper can build a
# release manifest without recomputing a timestamp that would no longer match.
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
# 5. Generate cfn-params.json (build artifact - regenerated every run)
# -----------------------------------------------------------------------------
echo "[5/7] Generating infra/cfn-params.json..."
compute_param_values "$S3_KEY"
write_cfn_params_json "$SCRIPT_DIR/cfn-params.json"

# Every template Parameter must appear above, or it silently falls back to its
# Default and the env file cannot override it. Check rather than trust.
echo "      Cross-checking params against the template..."
node -e '
  const fs = require("fs");
  const tpl = fs.readFileSync(process.argv[1], "utf8");
  const params = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).map(p => p.ParameterKey);
  const section = tpl.split(/^(?:Rules|Conditions|Resources):/m)[0].split(/^Parameters:/m)[1] || "";
  const declared = [...section.matchAll(/^  ([A-Za-z0-9]+):\r?$/gm)].map(m => m[1]);
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
' "$(winpath "$SCRIPT_DIR/cfn-property-pages.yaml")" "$(winpath "$SCRIPT_DIR/cfn-params.json")"

# -----------------------------------------------------------------------------
# 6. Deploy the CloudFormation stack
# -----------------------------------------------------------------------------
echo "[6/7] Deploying stack $STACK_NAME..."
if [ "${ENABLE_CLOUDFRONT:-true}" = "true" ]; then
  echo "      (a first CloudFront distribution takes 5-15 minutes to propagate)"
fi

PARAM_OVERRIDES=$(node -e '
  const p = require(process.argv[1]);
  console.log(p.map(x => x.ParameterKey + "=" + x.ParameterValue).join(" "));
' "$(winpath "$SCRIPT_DIR/cfn-params.json")")

# shellcheck disable=SC2086
"$AWS_BIN" cloudformation deploy \
  --template-file "$(winpath "$SCRIPT_DIR/cfn-property-pages.yaml")" \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT_NAME" Service=realestateflow-pages \
  --parameter-overrides $PARAM_OVERRIDES \
  "${AWS_ARGS[@]}"

# -----------------------------------------------------------------------------
# 7. Force an API Gateway stage deployment and print outputs
# -----------------------------------------------------------------------------
echo "[7/7] Forcing API Gateway stage deployment..."
API_ID="$("$AWS_BIN" cloudformation describe-stacks --stack-name "$STACK_NAME" "${AWS_ARGS[@]}" \
  --query "Stacks[0].Outputs[?OutputKey=='PagesRestApiId'].OutputValue" --output text)"
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
